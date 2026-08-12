import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { useTwilio } from './TwilioContext';
import { supabase } from '@/integrations/supabase/client';
import { normalizePhoneNumber } from '@/lib/phoneUtils';
import { toast } from 'sonner';
import { useDialerEngine, type DialerEngine } from '@/hooks/useDialerEngine';
import { isAnsweredOutcome, isQualifiedOutcome } from '@/lib/callOutcomes';

export type AutoDialerState = 'idle' | 'running' | 'paused' | 'paused-in-call' | 'paused-qualifying' | 'awaiting-outcome' | 'finished';

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

export interface PendingOutcome {
  dealId: string;
  activityId: string | null;
  name: string;
  phone: string;
  ramal: string | null;
  startedAt: number;
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
  /** Motor de discagem do usuário logado (Fase 1 do rollout Sonax) */
  engine: DialerEngine;
  ramal: string | null;
  /** Preenchido apenas no motor Sonax: chamada disparada, aguardando outcome manual */
  pendingOutcome: PendingOutcome | null;
  registerOutcome: (outcome: string, notes?: string) => Promise<void>;
}

const AutoDialerContext = createContext<AutoDialerContextType | null>(null);

const MAX_QUEUE = 10000;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isUuid = (value: string | null | undefined) => !!value && UUID_REGEX.test(value);

export function AutoDialerProvider({ children }: { children: ReactNode }) {
  const {
    callStatus,
    currentCallId,
    makeCall,
    hangUp,
    deviceStatus,
    initializeDevice,
  } = useTwilio();

  const { data: engineConfig } = useDialerEngine();
  const engine: DialerEngine = engineConfig?.engine || 'twilio';
  const ramal = engineConfig?.ramal ?? null;
  const engineRef = useRef<DialerEngine>(engine);
  useEffect(() => { engineRef.current = engine; }, [engine]);

  const [state, setState] = useState<AutoDialerState>('idle');
  const [queue, setQueue] = useState<AutoDialerLead[]>([]);
  const [results, setResults] = useState<Record<string, LeadResult>>({});
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [ringTimeoutMs, setRingTimeoutMs] = useState(25000);
  const [betweenCallsMs, setBetweenCallsMs] = useState(10000);
  const [maxAttemptsPerLead, setMaxAttemptsPerLead] = useState(3);
  const [retryDelayMs, setRetryDelayMs] = useState(10000);
  const [attempts, setAttempts] = useState<Record<string, number>>({});
  const [inCallDrawerOpen, setInCallDrawerOpen] = useState(false);
  const [pendingOutcome, setPendingOutcome] = useState<PendingOutcome | null>(null);
  const pendingOutcomeRef = useRef<PendingOutcome | null>(null);
  useEffect(() => { pendingOutcomeRef.current = pendingOutcome; }, [pendingOutcome]);

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

    const isSonax = engineRef.current === 'sonax';

    if (!isSonax && deviceStatus !== 'ready') {
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
    let attemptNumber = 1;
    setAttempts(prev => {
      const next = { ...prev, [lead.dealId]: (prev[lead.dealId] || 0) + 1 };
      attemptNumber = next[lead.dealId];
      attemptsRef.current = next;
      return next;
    });

    try {
      const normalized = normalizePhoneNumber(lead.phone);
      const crmDealId = isUuid(lead.dealId) ? lead.dealId : undefined;
      const crmContactId = isUuid(lead.contactId) ? lead.contactId : undefined;
      const crmOriginId = isUuid(lead.originId) ? lead.originId : undefined;

      if (isSonax) {
        // ===== Motor Sonax: origina direto no widget de webfone (sonax:makeCall) =====
        const digits = toSonaxWidgetDigits(lead.phone || normalized);
        let data: any = null;
        let error: any = null;
        if (!digits) {
          error = new Error('numero_invalido');
        } else {
          window.dispatchEvent(new CustomEvent('sonax:makeCall', { detail: { numero: digits } }));
          const res = await supabase.functions.invoke('sonax-click-to-call', {
            body: { log_only: true, numero: digits, deal_id: crmDealId, origin: 'auto_dialer', attempt: attemptNumber },
          });
          data = res.data;
          error = res.error;
        }
        const activityId = (data as any)?.activity_id ?? null;

        if (error || (data as any)?.error) {
          console.error('[autodialer] sonax dial error', error || (data as any)?.error);
          setLeadResult(lead.dealId, 'failed');
          toast.error(`Falha ao discar ${lead.name} (verifique se o softphone está registrado)`);
          if (stateRef.current === 'running') {
            if (attemptNumber < maxAttemptsRef.current) {
              setLeadResult(lead.dealId, 'pending');
              retryCurrentRef.current?.();
            } else {
              advanceToNextRef.current?.();
            }
          }
          return;
        }

        // Disparo aceito: aguarda o SDR atender no softphone e registrar o outcome
        stateRef.current = 'awaiting-outcome';
        setState('awaiting-outcome');
        setPendingOutcome({
          dealId: lead.dealId,
          activityId,
          name: lead.name,
          phone: lead.phone,
          ramal: (data as any)?.ramal ?? ramal,
          startedAt: Date.now(),
        });
      } else {
        await makeCall(normalized, crmDealId, crmContactId, crmOriginId);
      }

      // Carimba a última discagem automática para excluir o lead nos próximos
      // carregamentos do dia (regra: discado HOJE não volta na fila; após
      // virar o dia, volta a aparecer).
      if (crmDealId) {
        supabase
          .from('crm_deals')
          .update({ last_auto_dialer_call_at: new Date().toISOString() })
          .eq('id', crmDealId)
          .then(({ error }) => {
            if (error) console.warn('[autodialer] stamp last_auto_dialer_call_at error', error);
          });
      }
    } catch (e) {
      console.error('[autodialer] dial error', e);
      setLeadResult(lead.dealId, 'failed');
    }
  }, [deviceStatus, initializeDevice, makeCall, setLeadResult, ramal]);

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
  const retryCurrentRef = useRef<(() => void) | null>(null);
  useEffect(() => { retryCurrentRef.current = retryCurrent; }, [retryCurrent]);

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
  const advanceToNextRef = useRef<(() => void) | null>(null);
  useEffect(() => { advanceToNextRef.current = advanceToNext; }, [advanceToNext]);

  // ===== Motor Sonax: registro manual do resultado da ligação =====
  const registerOutcome = useCallback(async (outcome: string, notes?: string) => {
    const pending = pendingOutcomeRef.current;
    if (!pending) return;
    const answered = isAnsweredOutcome(outcome);

    if (pending.activityId) {
      try {
        const { data } = await supabase
          .from('deal_activities')
          .select('metadata')
          .eq('id', pending.activityId)
          .maybeSingle();
        const meta = ((data as any)?.metadata || {}) as Record<string, unknown>;
        const { error } = await supabase
          .from('deal_activities')
          .update({
            metadata: {
              ...meta,
              outcome,
              answered,
              qualified: isQualifiedOutcome(outcome),
              outcome_notes: notes || null,
              outcome_at: new Date().toISOString(),
            } as any,
          })
          .eq('id', pending.activityId);
        if (error) console.warn('[autodialer] outcome update error', error);
      } catch (e) {
        console.warn('[autodialer] outcome update failed', e);
      }
    }

    setLeadResult(pending.dealId, answered ? 'answered' : 'no-answer');
    setPendingOutcome(null);
    pendingOutcomeRef.current = null;
    setInCallDrawerOpen(false);

    if (stateRef.current !== 'awaiting-outcome') return;
    stateRef.current = 'running';
    setState('running');

    const attemptCount = attemptsRef.current[pending.dealId] || 1;
    const retryable = ['sem_contato', 'ocupado', 'caixa_postal'].includes(outcome);
    if (retryable && attemptCount < maxAttemptsRef.current) {
      setLeadResult(pending.dealId, 'pending');
      retryCurrentRef.current?.();
    } else {
      advanceToNextRef.current?.();
    }
  }, [setLeadResult]);

  // Reage a transições do callStatus
  useEffect(() => {
    // Motor Sonax não tem eventos de chamada no navegador
    if (engineRef.current === 'sonax') return;
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

      // 🔓 LIBERA O BANNER IMEDIATAMENTE: assim que a chamada termina,
      // o estado sai de 'paused-in-call' e o banner verde "atendeu!" some.
      // A decisão de próximo lead / voicemail acontece em background.
      if (stateRef.current === 'paused-in-call') {
        setState('running');
      }
      setInCallDrawerOpen(false);

      // Verifica se foi caixa postal (AMD do Twilio detectou máquina e o webhook
      // já derrubou a chamada). Pequeno delay garante que o AMD callback chegou.
      const handleCompletion = async () => {
        let isVoicemail = false;
        if (currentCallId) {
          try {
            const { data } = await supabase
              .from('calls')
              .select('outcome, answered_by')
              .eq('id', currentCallId)
              .maybeSingle();
            const ansBy = (data as any)?.answered_by as string | null | undefined;
            if ((data as any)?.outcome === 'voicemail' || (ansBy && ansBy !== 'human')) {
              isVoicemail = true;
            }
          } catch (e) {
            console.warn('[autodialer] failed to check voicemail status', e);
          }
        }

        if (wasInProgressRef.current && !isVoicemail) {
          // Atendeu (humano) → NÃO abre qualificação automaticamente.
          // O SDR aciona o modal manualmente quando/se precisar.
          if (stateRef.current === 'running') {
            advanceToNext();
          }
          // Se estiver pausado, o avanço ocorrerá no resume().
          return;
        }

        // Caixa postal OU não atendeu / falhou
        const result: LeadResult = (!isVoicemail && callStatus === 'failed') ? 'failed' : 'no-answer';
        setLeadResult(lead.dealId, result);

        // Registra atividade de tentativa
        const crmDealId = isUuid(lead.dealId) ? lead.dealId : null;
        if (currentCallId && crmDealId) {
          const currentAttempt = attemptsRef.current[lead.dealId] || 1;
          const description = isVoicemail
            ? `Tentativa automática ${currentAttempt}/${maxAttemptsRef.current} — caixa postal detectada`
            : `Tentativa automática ${currentAttempt}/${maxAttemptsRef.current} — não atendeu`;
          const resultTag = isVoicemail ? 'caixa_postal' : 'nao_atendeu';
          supabase.from('deal_activities').insert({
            deal_id: crmDealId,
            activity_type: 'call_result',
            description,
            metadata: { result: resultTag, auto_dialer: true, attempt: currentAttempt, max_attempts: maxAttemptsRef.current, voicemail: isVoicemail } as any,
          }).then(({ error }) => { if (error) console.warn('[autodialer] activity insert error', error); });
        }

        if (isVoicemail) {
          toast.info(`📭 Caixa postal — ${lead.name}`);
        }

        if (stateRef.current === 'running') {
          const attemptCount = attemptsRef.current[lead.dealId] || 1;
          if (attemptCount < maxAttemptsRef.current) {
            setLeadResult(lead.dealId, 'pending');
            retryCurrent();
          } else {
            advanceToNext();
          }
        }
        // Se estiver 'paused', apenas registramos o resultado;
        // o resume() decide se redisca o atual ou avança.
      };

      // Delay de 1.5s para garantir que o AMD callback do Twilio chegue antes
      setTimeout(() => { handleCompletion(); }, 1500);
    }
  }, [callStatus, currentCallId, hangUp, ringTimeoutMs, setLeadResult, advanceToNext, retryCurrent, engine]);

  // (Removido) A retomada da fila após qualificação não é mais necessária:
  // o modal de qualificação não abre mais automaticamente — o SDR aciona
  // manualmente quando precisar.

  // ===== API =====
  const loadQueue = useCallback((leads: AutoDialerLead[]) => {
    if (state === 'running' || state === 'paused' || state === 'paused-in-call' || state === 'paused-qualifying' || state === 'awaiting-outcome') {
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
    if (engine === 'sonax' && !ramal) {
      toast.error('Seu ramal Sonax não está configurado — fale com o gestor');
      return;
    }
    if (engine === 'sonax') {
      toast.info('A ligação vai tocar no seu ramal/softphone — mantenha ele aberto');
    }
    setState('running');
    const startIdx = currentIndex < 0 ? 0 : currentIndex;
    setCurrentIndex(startIdx);
    dialIndex(startIdx);
  }, [queue.length, state, currentIndex, dialIndex, engine, ramal]);

  const pause = useCallback(() => {
    if (state !== 'running' && state !== 'awaiting-outcome') return;
    clearTimers();
    isAdvancingRef.current = false;
    // Cancela chamada que ainda está tocando/conectando (não derruba uma já atendida)
    if (engine !== 'sonax' && (callStatus === 'ringing' || callStatus === 'connecting')) {
      try { hangUp(); } catch (e) { console.warn('[autodialer] hangUp on pause failed', e); }
    }
    // Se o lead atual estava 'in-progress' mas não foi atendido, devolve para 'pending'
    const lead = queueRef.current[currentIndexRef.current];
    if (lead) {
      setResults(prev => {
        const cur = prev[lead.dealId];
        if (cur === 'in-progress') {
          return { ...prev, [lead.dealId]: 'pending' as LeadResult };
        }
        return prev;
      });
    }
    setInCallDrawerOpen(false);
    setState('paused');
    toast.info('Fila pausada');
  }, [state, clearTimers, callStatus, hangUp, engine]);

  const resume = useCallback(() => {
    if (state !== 'paused') return;
    if (queue.length === 0 || currentIndex < 0) return;
    const lead = queue[currentIndex];
    if (!lead) return;
    const currentResult = results[lead.dealId];
    setState('running');
    if (currentResult === 'pending' || currentResult === 'in-progress' || currentResult === undefined) {
      // Redisca o lead atual
      dialIndex(currentIndex);
    } else {
      // Já finalizado — avança para o próximo (ou marca finished se for o último)
      if (currentIndex >= queue.length - 1) {
        setState('finished');
        toast.success('Fila concluída');
      } else {
        advanceToNext();
      }
    }
  }, [state, queue, currentIndex, results, dialIndex, advanceToNext]);

  const skipCurrent = useCallback(() => {
    const lead = queueRef.current[currentIndexRef.current];
    if (lead) setLeadResult(lead.dealId, 'skipped');
    setPendingOutcome(null);
    pendingOutcomeRef.current = null;
    if (engine !== 'sonax' && (callStatus === 'ringing' || callStatus === 'connecting' || callStatus === 'in-progress')) {
      hangUp();
    }
    if (stateRef.current === 'awaiting-outcome') { stateRef.current = 'running'; setState('running'); }
    setInCallDrawerOpen(false);
    advanceToNext();
  }, [callStatus, hangUp, advanceToNext, setLeadResult, engine]);

  const stop = useCallback(() => {
    clearTimers();
    if (engine !== 'sonax' && (callStatus === 'ringing' || callStatus === 'connecting' || callStatus === 'in-progress')) {
      hangUp();
    }
    setState('idle');
    setPendingOutcome(null);
    pendingOutcomeRef.current = null;
    setCurrentIndex(-1);
    setQueue([]);
    setResults({});
    setAttempts({});
    attemptsRef.current = {};
    setInCallDrawerOpen(false);
    isAdvancingRef.current = false;
  }, [callStatus, hangUp, clearTimers, engine]);

  return (
    <AutoDialerContext.Provider value={{
      state, queue, results, currentIndex, currentLead, stats,
      ringTimeoutMs, betweenCallsMs, maxAttemptsPerLead, retryDelayMs,
      setRingTimeoutMs, setBetweenCallsMs, setMaxAttemptsPerLead, setRetryDelayMs,
      attempts,
      loadQueue, start, pause, resume, skipCurrent, stop,
      inCallDrawerOpen, setInCallDrawerOpen,
      engine, ramal, pendingOutcome, registerOutcome,
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
