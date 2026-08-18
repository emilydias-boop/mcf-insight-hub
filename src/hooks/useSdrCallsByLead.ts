import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { classifyCall, CallCategory } from './useSdrActivityMetrics';
import { useCallClassificationThresholds, DEFAULT_THRESHOLDS } from './useCallClassificationThresholds';
import { sonaxDurationSeconds } from '@/lib/sonaxRecording';

export interface LeadCallBreakdown {
  phone: string;
  phoneNormalized: string;
  leadName: string | null;
  dealId: string | null;
  totalAttempts: number;
  notAnswered: number;
  ringDrop: number;
  voicemail: number;
  effective: number;
  qualified: number;
  /** Só Sonax: status_atendimento vazio/placeholder (bug conhecido do lado deles). */
  pending: number;
  firstCallAt: string | null;
  lastCallAt: string | null;
  totalDurationSeconds: number;
}

function normalizePhone(p: string | null | undefined): string {
  if (!p) return '';
  const digits = String(p).replace(/\D/g, '');
  return digits.slice(-9); // last 9 digits, alinhado com regra do projeto
}

/** Classifica um evento Sonax (status_atendimento S/N + duração) na mesma lógica de useSdrActivityMetrics. */
function classifySonaxEvent(
  statusAtendimento: string | null | undefined,
  duracaoChamada: string | null | undefined,
  thresholds: { ringDropMax: number; voicemailMax: number; effectiveMax: number },
): CallCategory | 'pending' {
  const status = String(statusAtendimento || '').trim().toUpperCase();
  if (status === 'N') return 'not_answered';
  if (status === 'S') {
    const duration = sonaxDurationSeconds(duracaoChamada);
    // Duração zero com status "atendido" é caixa postal ou queda imediata —
    // nunca conversa. Antes caía em 'effective' e inflava as Efetivas.
    if (duration <= 0) return 'voicemail';
    if (duration <= thresholds.ringDropMax) return 'ring_drop';
    if (duration <= thresholds.voicemailMax) return 'voicemail';
    if (duration <= thresholds.effectiveMax) return 'effective';
    return 'qualified';
  }
  return 'pending';
}

export function useSdrCallsByLead(
  sdrUserId: string | null,
  startDate: Date,
  endDate: Date,
  squad: string = 'incorporador',
  enabled: boolean = true,
  sdrEmail: string | null = null,
  source: 'twilio' | 'sonax' = 'twilio',
) {
  const thresholdsQuery = useCallClassificationThresholds(squad);

  return useQuery({
    queryKey: [
      'sdr-calls-by-lead',
      sdrUserId,
      sdrEmail,
      source,
      startDate.toISOString(),
      endDate.toISOString(),
      squad,
    ],
    enabled:
      enabled &&
      thresholdsQuery.isSuccess &&
      (source === 'sonax' ? !!sdrEmail : !!sdrUserId),
    staleTime: 2 * 60 * 1000,
    queryFn: async (): Promise<LeadCallBreakdown[]> => {
      const t = thresholdsQuery.data || DEFAULT_THRESHOLDS;
      const thresholds = {
        ringDropMax: t.ring_drop_max,
        voicemailMax: t.voicemail_max,
        effectiveMax: t.effective_max,
      };

      const PAGE = 1000;
      const groups = new Map<string, LeadCallBreakdown>();
      const dealIdsUsed = new Set<string>();

      const ensureGroup = (phone: string | null, dealId: string | null) => {
        const normalized = normalizePhone(phone);
        const key = normalized || `__deal:${dealId ?? Math.random()}`;
        let g = groups.get(key);
        if (!g) {
          g = {
            phone: phone || '(sem telefone)',
            phoneNormalized: normalized,
            leadName: null,
            dealId: dealId || null,
            totalAttempts: 0,
            notAnswered: 0,
            ringDrop: 0,
            voicemail: 0,
            effective: 0,
            qualified: 0,
            pending: 0,
            firstCallAt: null,
            lastCallAt: null,
            totalDurationSeconds: 0,
          };
          groups.set(key, g);
        }
        if (!g.dealId && dealId) g.dealId = dealId;
        if (dealId) dealIdsUsed.add(dealId);
        return g;
      };

      if (source === 'sonax') {
        if (!sdrEmail) return [];
        const allEvents: any[] = [];
        let from = 0;
        while (true) {
          const { data, error } = await supabase
            .from('sonax_call_events')
            .select('deal_id, numero, status_atendimento, duracao_chamada, created_at')
            .eq('evento', 'desligamento')
            .ilike('sdr_email', sdrEmail)
            .gte('created_at', startDate.toISOString())
            .lte('created_at', endDate.toISOString())
            .order('created_at', { ascending: true })
            .range(from, from + PAGE - 1);
          if (error) throw error;
          if (!data || data.length === 0) break;
          allEvents.push(...data);
          if (data.length < PAGE) break;
          from += PAGE;
        }

        for (const ev of allEvents) {
          const g = ensureGroup(ev.numero, ev.deal_id);
          const duration = sonaxDurationSeconds(ev.duracao_chamada);
          g.totalAttempts++;
          g.totalDurationSeconds += duration;
          if (!g.firstCallAt || ev.created_at < g.firstCallAt) g.firstCallAt = ev.created_at;
          if (!g.lastCallAt || ev.created_at > g.lastCallAt) g.lastCallAt = ev.created_at;
          const cat = classifySonaxEvent(ev.status_atendimento, ev.duracao_chamada, thresholds);
          switch (cat) {
            case 'not_answered': g.notAnswered++; break;
            case 'ring_drop': g.ringDrop++; break;
            case 'voicemail': g.voicemail++; break;
            case 'effective': g.effective++; break;
            case 'qualified': g.qualified++; break;
            case 'pending': g.pending++; break;
          }
        }
      } else {
        if (!sdrUserId) return [];
        const allCalls: any[] = [];
        let from = 0;
        while (true) {
          const { data, error } = await supabase
            .from('calls')
            .select('id, deal_id, to_number, status, duration_seconds, answered_by, created_at')
            .eq('direction', 'outbound')
            .eq('user_id', sdrUserId)
            .gte('created_at', startDate.toISOString())
            .lte('created_at', endDate.toISOString())
            .order('created_at', { ascending: true })
            .range(from, from + PAGE - 1);
          if (error) throw error;
          if (!data || data.length === 0) break;
          allCalls.push(...data);
          if (data.length < PAGE) break;
          from += PAGE;
        }

        for (const c of allCalls) {
          const g = ensureGroup(c.to_number, c.deal_id);
          g.totalAttempts++;
          g.totalDurationSeconds += c.duration_seconds || 0;
          if (!g.firstCallAt || c.created_at < g.firstCallAt) g.firstCallAt = c.created_at;
          if (!g.lastCallAt || c.created_at > g.lastCallAt) g.lastCallAt = c.created_at;
          const cat: CallCategory = classifyCall(c.status, c.duration_seconds, c.answered_by, thresholds);
          switch (cat) {
            case 'not_answered': g.notAnswered++; break;
            case 'ring_drop': g.ringDrop++; break;
            case 'voicemail': g.voicemail++; break;
            case 'effective': g.effective++; break;
            case 'qualified': g.qualified++; break;
          }
        }
      }

      // Buscar nomes dos leads via crm_deals (por deal_id) — comum às duas fontes
      const dealIds = Array.from(dealIdsUsed);
      const dealMap = new Map<string, string>();
      if (dealIds.length > 0) {
        const CHUNK = 200;
        for (let i = 0; i < dealIds.length; i += CHUNK) {
          const slice = dealIds.slice(i, i + CHUNK);
          const { data } = await supabase
            .from('crm_deals')
            .select('id, name')
            .in('id', slice);
          data?.forEach((d: any) => {
            if (d.name) dealMap.set(d.id, d.name);
          });
        }
      }
      groups.forEach(g => {
        if (g.dealId) g.leadName = dealMap.get(g.dealId) || g.leadName;
      });

      return Array.from(groups.values()).sort((a, b) => b.totalAttempts - a.totalAttempts);
    },
  });
}

export function exportLeadBreakdownToCsv(
  rows: LeadCallBreakdown[],
  sdrName: string,
  startDate: Date,
  endDate: Date,
) {
  const headers = [
    'Lead',
    'Telefone',
    'Tentativas',
    'Nao atendidas',
    'Ring drop',
    'Caixa postal',
    'Efetivas',
    'Qualificadas',
    'Pendentes',
    'Duracao total (s)',
    'Primeira ligacao',
    'Ultima ligacao',
    'Deal ID',
  ];
  const escape = (v: any) => {
    const s = v == null ? '' : String(v);
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(';')];
  rows.forEach(r => {
    lines.push([
      r.leadName || '(sem nome)',
      r.phone,
      r.totalAttempts,
      r.notAnswered,
      r.ringDrop,
      r.voicemail,
      r.effective,
      r.qualified,
      r.pending,
      r.totalDurationSeconds,
      r.firstCallAt || '',
      r.lastCallAt || '',
      r.dealId || '',
    ].map(escape).join(';'));
  });
  const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  a.href = url;
  a.download = `ligacoes-por-lead_${sdrName.replace(/\s+/g, '-')}_${fmt(startDate)}_${fmt(endDate)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
