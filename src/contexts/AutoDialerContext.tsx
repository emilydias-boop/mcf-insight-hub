import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { useTwilio } from './TwilioContext';
import { supabase } from '@/integrations/supabase/client';
import { normalizePhoneNumber } from '@/lib/phoneUtils';
import { toast } from 'sonner';

export type AutoDialerState = 'idle' | 'running' | 'paused-in-call' | 'paused-qualifying' | 'finished';

export interface AutoDialerLead {
  dealId: string;
  contactId: string | null;
  originId: string | null;
  name: string;
  phone: string;
}

export type LeadResult = 'pending' | 'in-progress' | 'answered' | 'no-answer' | 'failed' | 'skipped';

export interface AutoDialerStats {
  total: number;
  called: number;
  answered: number;
  noAnswer: number;
  failed: number;
}

interface AutoDialerContextType {
  state: AutoDialerState;
  queue: AutoDialerLead[];
  results: Record<string, LeadResult>;
  currentIndex: number;
  currentLead: AutoDialerLead | null;
  stats: AutoDialerStats;
  ringTimeoutMs: number;
  betweenCallsMs: number;
  maxAttemptsPerLead: number;
  retryDelayMs: number;
  setRingTimeoutMs: (ms: number) => void;
  setBetweenCallsMs: (ms: number) => void;
  setMaxAttemptsPerLead: (n: number) => void;
  setRetryDelayMs: (ms: number) => void;
  loadQueue: (leads: AutoDialerLead[]) => void;
  attempts: Record<string, number>;
  start: () => void;
  pause: () => void;
  resume: () => void;
  skipCurrent: () => void;
  stop: () => void;
  inCallDrawerOpen: boolean;
  setInCallDrawerOpen: (open: boolean) => void;
}

const AutoDialerContext = createContext<AutoDialerContextType | null>(null);

const MAX_QUEUE = 100;

export function AutoDialerProvider({ children }: { children: ReactNode }) {
  const {
    callStatus,
    currentCallId,
    makeCall,
    hangUp,
    deviceStatus,
    initializeDevice,
    qualificationModalOpen,
    openQualificationModal,
  } = useTwilio();

  const [state, setState] = useState<AutoDialerState>('idle');
  const [queue, setQueue] = useState<AutoDialerLead[]>([]);
  const [results, setResults] = useState<Record<string, LeadResult>>({});
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [ringTimeoutMs, setRingTimeoutMs] = useState(25000);
  const [betweenCallsMs, setBetweenCallsMs] = useState(2000);
  const [maxAttemptsPerLead, setMaxAttemptsPerLead] = useState(3);
  const [retryDelayMs, setRetryDelayMs] = useState(5000);
  const [attempts, setAttempts] = useState<Record<string, number>>({});
  const [inCallDrawerOpen, setInCallDrawerOpen] = useState(false);

  const ringTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCallStatusRef = useRef(callStatus);
  const wasInProgressRef = useRef(false);
  const stateRef = useRef(state);
  const currentIndexRef = useRef(currentIndex);
  const queueRef = useRef(queue);
  const isAdvancingRef = useRef(false);
  const attemptsRef = useRef<Record<string, number>>({});
  const maxAttemptsRef = useRef(maxAttemptsPerLead);
  const retryDelayRef = useRef(retryDelayMs);

  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { currentIndexRef.current = currentIndex; }, [currentIndex]);
  useEffect(() => { queueRef.current = queue; }, [queue]);
  useEffect(() => { attemptsRef.current = attempts; }, [attempts]);
  useEffect(() => { maxAttemptsRef.current = maxAttemptsPerLead; }, [maxAttemptsPerLead]);
  useEffect(() => { retryDelayRef.current = retryDelayMs; }, [retryDelayMs]);

  const currentLead = currentIndex >= 0 && currentIndex < queue.length ? queue[currentIndex] : null;

  const stats: AutoDialerStats = {
    total: queue.length,
    called: Object.values(results).filter(r => r !== 'pending').length,
    answered: Object.values(results).filter(r => r === 'answered').length,
    noAnswer: Object.values(results).filter(r => r === 'no-answer').length,
    failed: Object.values(results).filter(r => r === 'failed').length,
  };

  const clearTimers = useCallback(() => {
    if (ringTimerRef.current) { clearTimeout(ringTimerRef.current); ringTimerRef.current = null; }
    if (advanceTimerRef.current) { clearTimeout(advanceTimerRef.current); advanceTimerRef.current = null; }
  }, []);

  const setLeadResult = useCallback((dealId: string, result: LeadResult) => {
    setResults(prev => ({ ...prev, [dealId]: result }));
  }, []);

  const dialIndex = useCallback(async (idx: number) => {
    const lead = queueRef.current[idx];
    if (!lead) return;

    if (deviceStatus !== 'ready') {
      const ok = await initializeDevice();
      if (!ok) {
        toast.error('Não foi possível inicializar o telefone');
        setState('idle');
        return;
      }
    }

    setLeadResult(lead.dealId, 'in-progress');
    wasInProgressRef.current = false;
    // incrementa contagem de tentativas para este lead
    setAttempts(prev => {
      const next = { ...prev, [lead.dealId]: (prev[lead.dealId] || 0) + 1 };
      attemptsRef.current = next;
      return next;
    });

    try {
      const normalized = normalizePhoneNumber(lead.phone);
      await makeCall(normalized, lead.dealId, lead.contactId || undefined, lead.originId || undefined);
    } catch (e) {
      console.error('[autodialer] makeCall error', e);
      setLeadResult(lead.dealId, 'failed');
    }
  }, [deviceStatus, initializeDevice, makeCall, setLeadResult]);

  const retryCurrent = useCallback(() => {
    if (isAdvancingRef.current) return;
    isAdvancingRef.current = true;
    clearTimers();
    advanceTimerRef.current = setTimeout(() => {
      isAdvancingRef.current = false;
      if (stateRef.current !== 'running') return;
      const idx = currentIndexRef.current;
      dialIndex(idx);
    }, retryDelayRef.current);
  }, [clearTimers, dialIndex]);

  const advanceToNext = useCallback(() => {
    if (isAdvancingRef.current) return;
    isAdvancingRef.current = true;
    clearTimers();
    advanceTimerRef.current = setTimeout(() => {
      isAdvancingRef.current = false;
      const next = currentIndexRef.current + 1;
      if (next >= queueRef.current.length) {
        setState('finished');
        toast.success('Fila concluída');
        return;
      }
      if (stateRef.current !== 'running') return;
      setCurrentIndex(next);
      dialIndex(next);
    }, betweenCallsMs);
  }, [betweenCallsMs, clearTimers, dialIndex]);

  // Reage a transições do callStatus
  useEffect(() => {
    const prev = lastCallStatusRef.current;
    lastCallStatusRef.current = callStatus;

    if (stateRef.current === 'idle' || stateRef.current === 'finished') return;
    const lead = queueRef.current[currentIndexRef.current];
    if (!lead) return;

    // RINGING — inicia timer de "não atende"
    if (callStatus === 'ringing' && stateRef.current === 'running') {
      if (ringTimerRef.current) clearTimeout(ringTimerRef.current);
      ringTimerRef.current = setTimeout(() => {
        // Se ainda estiver ringing/connecting, encerra como no-answer
        if (callStatus === 'ringing' || callStatus === 'connecting') {
          hangUp();
        }
      }, ringTimeoutMs);
    }

    // ATENDEU
    if (callStatus === 'in-progress' && prev !== 'in-progress') {
      wasInProgressRef.current = true;
      if (ringTimerRef.current) { clearTimeout(ringTimerRef.current); ringTimerRef.current = null; }
      setState('paused-in-call');
      setLeadResult(lead.dealId, 'answered');
      // Abre automaticamente o drawer rico do lead
      setInCallDrawerOpen(true);
    }

    // ENCERROU (completed/failed) — decide próximo passo
    if ((callStatus === 'completed' || callStatus === 'failed') && prev !== callStatus) {
      if (ringTimerRef.current) { clearTimeout(ringTimerRef.current); ringTimerRef.current = null; }

      if (wasInProgressRef.current) {
        // Atendeu → abre qualificação e pausa (não tenta de novo)
        setState('paused-qualifying');
        setInCallDrawerOpen(false);
        openQualificationModal(lead.dealId, lead.name);
      } else {
        // Não atendeu / falhou
        const result: LeadResult = callStatus === 'failed' ? 'failed' : 'no-answer';
        setLeadResult(lead.dealId, result);

        // Registra atividade de tentativa
        if (currentCallId) {
          const currentAttempt = attemptsRef.current[lead.dealId] || 1;
          supabase.from('deal_activities').insert({
            deal_id: lead.dealId,
            activity_type: 'call_result',
            description: `Tentativa automática ${currentAttempt}/${maxAttemptsRef.current} — não atendeu`,
            metadata: { result: 'nao_atendeu', auto_dialer: true, attempt: currentAttempt, max_attempts: maxAttemptsRef.current } as any,
          }).then(({ error }) => { if (error) console.warn('[autodialer] activity insert error', error); });
        }

        if (stateRef.current === 'running') {
          const attemptCount = attemptsRef.current[lead.dealId] || 1;
          if (attemptCount < maxAttemptsRef.current) {
            // ainda tem tentativas → re-disca o mesmo lead
            setLeadResult(lead.dealId, 'pending');
            retryCurrent();
          } else {
            // esgotou tentativas → próximo lead
            advanceToNext();
          }
        }
      }
    }
  }, [callStatus, currentCallId, hangUp, openQualificationModal, ringTimeoutMs, setLeadResult, advanceToNext, retryCurrent]);

  // Quando o modal de qualificação fecha, retoma a fila
  useEffect(() => {
    if (stateRef.current !== 'paused-qualifying') return;
    if (!qualificationModalOpen) {
      setState('running');
      advanceToNext();
    }
  }, [qualificationModalOpen, advanceToNext]);

  // ===== API =====
  const loadQueue = useCallback((leads: AutoDialerLead[]) => {
    if (state === 'running' || state === 'paused-in-call') {
      toast.error('Pause ou pare a fila atual antes de carregar outra');
      return;
    }
    const trimmed = leads.slice(0, MAX_QUEUE);
    setQueue(trimmed);
    setResults(Object.fromEntries(trimmed.map(l => [l.dealId, 'pending' as LeadResult])));
    setAttempts({});
    attemptsRef.current = {};
    setCurrentIndex(-1);
    setState('idle');
  }, [state]);

  const start = useCallback(() => {
    if (queue.length === 0) { toast.error('Fila vazia'); return; }
    if (state === 'running') return;
    setState('running');
    const startIdx = currentIndex < 0 ? 0 : currentIndex;
    setCurrentIndex(startIdx);
    dialIndex(startIdx);
  }, [queue.length, state, currentIndex, dialIndex]);

  const pause = useCallback(() => {
    if (state === 'running') {
      setState('idle');
      clearTimers();
      setInCallDrawerOpen(false);
      toast.info('Fila pausada');
    }
  }, [state, clearTimers]);

  const resume = useCallback(() => {
    if (state === 'idle' && queue.length > 0 && currentIndex >= 0 && currentIndex < queue.length - 1) {
      setState('running');
      advanceToNext();
    }
  }, [state, queue.length, currentIndex, advanceToNext]);

  const skipCurrent = useCallback(() => {
    const lead = queueRef.current[currentIndexRef.current];
    if (lead) setLeadResult(lead.dealId, 'skipped');
    if (callStatus === 'ringing' || callStatus === 'connecting' || callStatus === 'in-progress') {
      hangUp();
    }
    setInCallDrawerOpen(false);
    advanceToNext();
  }, [callStatus, hangUp, advanceToNext, setLeadResult]);

  const stop = useCallback(() => {
    clearTimers();
    if (callStatus === 'ringing' || callStatus === 'connecting' || callStatus === 'in-progress') {
      hangUp();
    }
    setState('idle');
    setCurrentIndex(-1);
    setQueue([]);
    setResults({});
    setAttempts({});
    attemptsRef.current = {};
    setInCallDrawerOpen(false);
    isAdvancingRef.current = false;
  }, [callStatus, hangUp, clearTimers]);

  return (
    <AutoDialerContext.Provider value={{
      state, queue, results, currentIndex, currentLead, stats,
      ringTimeoutMs, betweenCallsMs, maxAttemptsPerLead, retryDelayMs,
      setRingTimeoutMs, setBetweenCallsMs, setMaxAttemptsPerLead, setRetryDelayMs,
      attempts,
      loadQueue, start, pause, resume, skipCurrent, stop,
      inCallDrawerOpen, setInCallDrawerOpen,
    }}>
      {children}
    </AutoDialerContext.Provider>
  );
}

export function useAutoDialer() {
  const ctx = useContext(AutoDialerContext);
  if (!ctx) throw new Error('useAutoDialer must be used within AutoDialerProvider');
  return ctx;
}
