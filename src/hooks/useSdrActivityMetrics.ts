import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSdrsFromSquad } from './useSdrsFromSquad';
import { useCallClassificationThresholds, CallThresholds, DEFAULT_THRESHOLDS } from './useCallClassificationThresholds';
import { sonaxDurationSeconds } from '@/lib/sonaxRecording';

export interface SdrActivityMetrics {
  sdrEmail: string;
  sdrName: string;
  sdrUserId: string | null;
  /** Motor de discagem configurado para o SDR (Fase 1 do rollout Sonax) */
  source: 'twilio' | 'sonax';
  ramal: string | null;
  /** Só no Sonax: eventos de desligamento com status_atendimento inválido/placeholder */
  pendingOutcomeCalls: number;
  /** Discagens contadas via `calls` (Twilio) ou `sonax_call_events` (Sonax) */

  
  // Atividades do período
  totalCalls: number;
  answeredCalls: number;
  notAnsweredCalls: number;
  ringDropCalls: number;
  voicemailCalls: number;
  effectiveCalls: number;
  qualifiedCalls: number;
  connectionRate: number; // (atendidas) / total
  qualificationRate: number; // qualified / total
  notesAdded: number;
  stageChanges: number;
  whatsappSent: number;
  
  // Leads trabalhados
  uniqueLeadsWorked: number;
  
  // Calculado
  avgCallsPerLead: number;
}

export type CallCategory = 'not_answered' | 'ring_drop' | 'voicemail' | 'effective' | 'qualified';

// Faixas heurísticas padrão (segundos) — fallback quando não há config no banco.
export const CALL_THRESHOLDS = {
  ringDropMax: 10,
  voicemailMax: 30,
  effectiveMax: 60,
} as const;

/**
 * Classifica uma ligação outbound em uma categoria.
 * Prioriza answered_by (AMD do Twilio) quando presente; caso contrário usa duração.
 */
export function classifyCall(
  status: string | null | undefined,
  durationSeconds: number | null | undefined,
  answeredBy: string | null | undefined,
  thresholds: { ringDropMax: number; voicemailMax: number; effectiveMax: number } = CALL_THRESHOLDS
): CallCategory {
  const duration = durationSeconds ?? 0;
  const notAnsweredStatuses = ['no-answer', 'failed', 'busy', 'initiated', 'canceled'];
  if (!status || notAnsweredStatuses.includes(status) || duration === 0) {
    return 'not_answered';
  }

  // AMD do Twilio (se ligado no futuro)
  if (answeredBy) {
    if (answeredBy === 'machine_start' || answeredBy === 'fax' || answeredBy.startsWith('machine')) {
      return 'voicemail';
    }
    if (answeredBy === 'human') {
      return duration > thresholds.effectiveMax ? 'qualified' : 'effective';
    }
  }

  // Heurística por duração
  if (duration <= thresholds.ringDropMax) return 'ring_drop';
  if (duration <= thresholds.voicemailMax) return 'voicemail';
  if (duration <= thresholds.effectiveMax) return 'effective';
  return 'qualified';
}

export function useSdrActivityMetrics(
  startDate: Date,
  endDate: Date,
  originId?: string,
  squad: string = 'incorporador'
) {
  const sdrsQuery = useSdrsFromSquad(squad);
  const thresholdsQuery = useCallClassificationThresholds(squad);
  
  return useQuery({
    queryKey: [
      'sdr-activity-metrics',
      startDate.toISOString(),
      endDate.toISOString(),
      originId,
      squad,
      thresholdsQuery.data?.ring_drop_max,
      thresholdsQuery.data?.voicemail_max,
      thresholdsQuery.data?.effective_max,
    ],
    queryFn: async (): Promise<SdrActivityMetrics[]> => {
      const t: CallThresholds = thresholdsQuery.data || DEFAULT_THRESHOLDS;
      const thresholds = {
        ringDropMax: t.ring_drop_max,
        voicemailMax: t.voicemail_max,
        effectiveMax: t.effective_max,
      };
      const sdrs = sdrsQuery.data || [];
      // Motor de discagem por SDR (Fase 1: só piloto está em Sonax)
      const { data: ramalRows } = await supabase
        .from('sdr_ramal_mapping')
        .select('sdr_email, sdr_name, ramal, auto_dialer_engine, active');
      const engineByEmail = new Map<string, { engine: 'twilio' | 'sonax'; ramal: string | null }>();
      const emailByRamal = new Map<string, string>();
      (ramalRows || []).forEach((r: any) => {
        if (!r.sdr_email) return;
        const email = String(r.sdr_email).toLowerCase();
        const isSonax = r.auto_dialer_engine === 'sonax';
        const existing = engineByEmail.get(email);
        // Sonax prevalece se houver múltiplas linhas para o mesmo e-mail
        if (existing?.engine === 'sonax' && !isSonax) return;
        engineByEmail.set(email, {
          engine: isSonax ? 'sonax' : 'twilio',
          ramal: r.ramal ?? existing?.ramal ?? null,
        });
        const ramalKey = String(r.ramal ?? '').replace(/\D/g, '');
        if (ramalKey && !emailByRamal.has(ramalKey)) {
          emailByRamal.set(ramalKey, email);
        }
      });

      // Complemento ADITIVO: SDRs no motor Sonax que não vieram da listagem padrão
      // (ex.: quem acumula role de closer é filtrado em useSdrsFromSquad).
      const sdrList: { email: string; name: string }[] = sdrs.map(s => ({
        email: s.email as string,
        name: s.name,
      }));
      const knownEmails = new Set(sdrList.map(s => s.email.toLowerCase()));
      const extraSonaxEmails = (ramalRows || [])
        .filter((r: any) => r.auto_dialer_engine === 'sonax' && r.sdr_email)
        .map((r: any) => ({ email: String(r.sdr_email).toLowerCase(), name: r.sdr_name || r.sdr_email }));
      const sonaxSquadCheck = new Map<string, boolean>();
      if (extraSonaxEmails.some(e => !knownEmails.has(e.email))) {
        const { data: sdrRows } = await supabase
          .from('sdr')
          .select('email, name, squad, role_type, active')
          .in('email', extraSonaxEmails.map(e => e.email));
        (sdrRows || []).forEach((row: any) => {
          if (!row.email) return;
          const ok = row.active === true && row.role_type === 'sdr' && row.squad === squad;
          const key = String(row.email).toLowerCase();
          sonaxSquadCheck.set(key, sonaxSquadCheck.get(key) === true ? true : ok);
          if (ok) {
            const idx = extraSonaxEmails.findIndex(e => e.email === key);
            if (idx >= 0 && row.name) extraSonaxEmails[idx].name = row.name;
          }
        });
        extraSonaxEmails.forEach(e => {
          if (!knownEmails.has(e.email) && sonaxSquadCheck.get(e.email)) {
            sdrList.push({ email: e.email, name: e.name });
            knownEmails.add(e.email);
          }
        });
      }

      const validSdrEmails = new Set(sdrList.map(s => s.email.toLowerCase()));
      
      const startIso = startDate.toISOString();
      const endIso = endDate.toISOString();
      
      // Helper: fetch all rows with pagination (bypasses 1000-row limit)
      const PAGE = 1000;
      
      // 1. Buscar TODAS as ligações outbound no período
      const allCalls: any[] = [];
      let callsFrom = 0;
      while (true) {
        const { data } = await supabase
          .from('calls')
          .select('user_id, status, outcome, deal_id, duration_seconds, answered_by')
          .eq('direction', 'outbound')
          .gte('created_at', startIso)
          .lte('created_at', endIso)
          .range(callsFrom, callsFrom + PAGE - 1);
        if (!data || data.length === 0) break;
        allCalls.push(...data);
        if (data.length < PAGE) break;
        callsFrom += PAGE;
      }
      
      // 2. Buscar TODAS as deal_activities no período
      const allActivities: any[] = [];
      let actFrom = 0;
      while (true) {
        const { data } = await supabase
          .from('deal_activities')
          .select('user_id, activity_type, deal_id, metadata, created_at')
          .gte('created_at', startIso)
          .lte('created_at', endIso)
          .range(actFrom, actFrom + PAGE - 1);
        if (!data || data.length === 0) break;
        allActivities.push(...data);
        if (data.length < PAGE) break;
        actFrom += PAGE;
      }
      
      // 2b. Buscar TODOS os eventos de desligamento Sonax no período (fonte automática)
      const allSonaxEvents: any[] = [];
      let sonaxFrom = 0;
      while (true) {
        const { data } = await supabase
          .from('sonax_call_events')
          .select('sdr_email, aliasramal, deal_id, status_atendimento, duracao_chamada, created_at')
          .eq('evento', 'desligamento')
          .gte('created_at', startIso)
          .lte('created_at', endIso)
          .range(sonaxFrom, sonaxFrom + PAGE - 1);
        if (!data || data.length === 0) break;
        allSonaxEvents.push(...data);
        if (data.length < PAGE) break;
        sonaxFrom += PAGE;
      }
      
      console.log(`[SdrActivityMetrics] Fetched ${allCalls.length} outbound calls, ${allActivities.length} activities, ${allSonaxEvents.length} sonax events`);
      
      // 3. Buscar profiles para mapear user_id -> email
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email, full_name');
      
      const profileMap = new Map<string, { email: string; name: string }>();
      const emailToUserId = new Map<string, string>();
      profiles?.forEach(p => {
        if (p.email) {
          profileMap.set(p.id, { email: p.email.toLowerCase(), name: p.full_name || p.email });
          emailToUserId.set(p.email.toLowerCase(), p.id);
        }
      });
      
      // 4. Inicializar métricas para SDRs conhecidos (do banco de dados)
      const metricsMap = new Map<string, SdrActivityMetrics>();
      sdrList.forEach(sdr => {
        const cfg = engineByEmail.get(sdr.email.toLowerCase());
        metricsMap.set(sdr.email.toLowerCase(), {
          sdrEmail: sdr.email,
          sdrName: sdr.name,
          sdrUserId: emailToUserId.get(sdr.email.toLowerCase()) || null,
          source: cfg?.engine || 'twilio',
          ramal: cfg?.ramal || null,
          pendingOutcomeCalls: 0,
          totalCalls: 0,
          answeredCalls: 0,
          notAnsweredCalls: 0,
          ringDropCalls: 0,
          voicemailCalls: 0,
          effectiveCalls: 0,
          qualifiedCalls: 0,
          connectionRate: 0,
          qualificationRate: 0,
          notesAdded: 0,
          stageChanges: 0,
          whatsappSent: 0,
          uniqueLeadsWorked: 0,
          avgCallsPerLead: 0,
        });
      });
      
      // Sets para rastrear leads únicos por SDR
      const leadsWorkedBySdr = new Map<string, Set<string>>();
      sdrList.forEach(sdr => {
        leadsWorkedBySdr.set(sdr.email.toLowerCase(), new Set());
      });
      
      // 5. Agregar ligações
      allCalls.forEach(call => {
        if (!call.user_id) return;
        
        const profile = profileMap.get(call.user_id);
        if (!profile) return;
        
        const email = profile.email.toLowerCase();
        if (!validSdrEmails.has(email)) return;
        
        const metrics = metricsMap.get(email);
        if (!metrics) return;

        // SDRs migrados para Sonax contam exclusivamente por `deal_activities`.
        if (metrics.source === 'sonax') return;

        metrics.totalCalls++;

        const category = classifyCall(call.status, call.duration_seconds, call.answered_by, thresholds);
        switch (category) {
          case 'not_answered': metrics.notAnsweredCalls++; break;
          case 'ring_drop': metrics.ringDropCalls++; break;
          case 'voicemail': metrics.voicemailCalls++; break;
          case 'effective': metrics.effectiveCalls++; break;
          case 'qualified': metrics.qualifiedCalls++; break;
        }
        if (category !== 'not_answered') {
          metrics.answeredCalls++;
        }
        
        if (call.deal_id) {
          leadsWorkedBySdr.get(email)?.add(call.deal_id);
        }
      });
      
      // 6. Agregar atividades
      allActivities.forEach(activity => {
        if (!activity.user_id) return;
        
        const profile = profileMap.get(activity.user_id);
        if (!profile) return;
        
        const email = profile.email.toLowerCase();
        if (!validSdrEmails.has(email)) return;
        
        const metrics = metricsMap.get(email);
        if (!metrics) return;
        
        switch (activity.activity_type) {
          case 'note':
            metrics.notesAdded++;
            break;
          case 'stage_change':
            metrics.stageChanges++;
            break;
          case 'whatsapp_sent':
            metrics.whatsappSent++;
            break;
        }
        
        if (activity.deal_id) {
          leadsWorkedBySdr.get(email)?.add(activity.deal_id);
        }
      });
      
      // 6b. Agregar ligações Sonax (fonte automática — sem depender de outcome manual do SDR)
      allSonaxEvents.forEach(ev => {
        // Reserva: quando o Sonax manda o evento sem sdr_email, descobrimos o SDR
        // pelo ramal (aliasramal) via sdr_ramal_mapping. Sem isso essas ligações
        // eram descartadas e sumiam do painel.
        let email = ev.sdr_email ? String(ev.sdr_email).toLowerCase() : '';
        if (!email) {
          const ramalKey = String(ev.aliasramal ?? '').replace(/\D/g, '');
          email = ramalKey ? (emailByRamal.get(ramalKey) ?? '') : '';
        }
        if (!email) return;
        if (!validSdrEmails.has(email)) return;

        const metrics = metricsMap.get(email);
        if (!metrics || metrics.source !== 'sonax') return;

        metrics.totalCalls++;

        const status = String(ev.status_atendimento || '').trim().toUpperCase();
        if (status === 'N') {
          metrics.notAnsweredCalls++;
        } else if (status === 'S') {
          metrics.answeredCalls++;
          const duration = sonaxDurationSeconds(ev.duracao_chamada);
          if (duration <= 0) {
            // Duração ausente/placeholder malformado, mas status confirma que atendeu.
            metrics.effectiveCalls++;
          } else if (duration <= thresholds.ringDropMax) {
            metrics.ringDropCalls++;
          } else if (duration <= thresholds.voicemailMax) {
            metrics.voicemailCalls++;
          } else if (duration <= thresholds.effectiveMax) {
            metrics.effectiveCalls++;
          } else {
            metrics.qualifiedCalls++;
          }
        } else {
          // status_atendimento vazio ou placeholder não substituído pela Sonax (bug conhecido do lado deles).
          metrics.pendingOutcomeCalls++;
        }

        if (ev.deal_id) {
          leadsWorkedBySdr.get(email)?.add(ev.deal_id);
        }
      });
      
      
      // 7. Calcular métricas finais
      const results: SdrActivityMetrics[] = [];
      metricsMap.forEach((metrics, email) => {
        const leadsSet = leadsWorkedBySdr.get(email);
        metrics.uniqueLeadsWorked = leadsSet?.size || 0;
        metrics.avgCallsPerLead = metrics.uniqueLeadsWorked > 0 
          ? Math.round((metrics.totalCalls / metrics.uniqueLeadsWorked) * 10) / 10
          : 0;
        metrics.connectionRate = metrics.totalCalls > 0
          ? Math.round((metrics.answeredCalls / metrics.totalCalls) * 1000) / 10
          : 0;
        metrics.qualificationRate = metrics.totalCalls > 0
          ? Math.round((metrics.qualifiedCalls / metrics.totalCalls) * 1000) / 10
          : 0;
        
        // Incluir apenas SDRs com alguma atividade
        if (metrics.totalCalls > 0 || metrics.notesAdded > 0 || metrics.stageChanges > 0 || metrics.whatsappSent > 0 || metrics.pendingOutcomeCalls > 0) {
          results.push(metrics);
        }
      });
      
      // Ordenar por total de ligações (desc)
      return results.sort((a, b) => b.totalCalls - a.totalCalls);
    },
    enabled: !!startDate && !!endDate && sdrsQuery.isSuccess && thresholdsQuery.isSuccess,
    staleTime: 5 * 60 * 1000, // 5 minutos
  });
}
