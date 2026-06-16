import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { classifyCall, CallCategory } from './useSdrActivityMetrics';
import { useCallClassificationThresholds, DEFAULT_THRESHOLDS } from './useCallClassificationThresholds';

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
  firstCallAt: string | null;
  lastCallAt: string | null;
  totalDurationSeconds: number;
}

function normalizePhone(p: string | null | undefined): string {
  if (!p) return '';
  const digits = String(p).replace(/\D/g, '');
  return digits.slice(-9); // last 9 digits, alinhado com regra do projeto
}

export function useSdrCallsByLead(
  sdrUserId: string | null,
  startDate: Date,
  endDate: Date,
  squad: string = 'incorporador',
  enabled: boolean = true,
) {
  const thresholdsQuery = useCallClassificationThresholds(squad);

  return useQuery({
    queryKey: ['sdr-calls-by-lead', sdrUserId, startDate.toISOString(), endDate.toISOString(), squad],
    enabled: enabled && !!sdrUserId && thresholdsQuery.isSuccess,
    staleTime: 2 * 60 * 1000,
    queryFn: async (): Promise<LeadCallBreakdown[]> => {
      if (!sdrUserId) return [];
      const t = thresholdsQuery.data || DEFAULT_THRESHOLDS;
      const thresholds = {
        ringDropMax: t.ring_drop_max,
        voicemailMax: t.voicemail_max,
        effectiveMax: t.effective_max,
      };

      const PAGE = 1000;
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

      // Buscar nomes dos leads via crm_deals (por deal_id)
      const dealIds = Array.from(new Set(allCalls.map(c => c.deal_id).filter(Boolean)));
      const dealMap = new Map<string, string>();
      if (dealIds.length > 0) {
        // pagina em blocos para evitar limite de IN
        const CHUNK = 200;
        for (let i = 0; i < dealIds.length; i += CHUNK) {
          const slice = dealIds.slice(i, i + CHUNK);
          const { data } = await supabase
            .from('crm_deals')
            .select('id, lead_name, phone')
            .in('id', slice);
          data?.forEach((d: any) => {
            if (d.lead_name) dealMap.set(d.id, d.lead_name);
          });
        }
      }

      const groups = new Map<string, LeadCallBreakdown>();
      for (const c of allCalls) {
        const normalized = normalizePhone(c.to_number);
        const key = normalized || `__deal:${c.deal_id ?? c.id}`;
        let g = groups.get(key);
        if (!g) {
          g = {
            phone: c.to_number || '(sem telefone)',
            phoneNormalized: normalized,
            leadName: c.deal_id ? dealMap.get(c.deal_id) || null : null,
            dealId: c.deal_id || null,
            totalAttempts: 0,
            notAnswered: 0,
            ringDrop: 0,
            voicemail: 0,
            effective: 0,
            qualified: 0,
            firstCallAt: null,
            lastCallAt: null,
            totalDurationSeconds: 0,
          };
          groups.set(key, g);
        }
        if (!g.leadName && c.deal_id) {
          g.leadName = dealMap.get(c.deal_id) || g.leadName;
          g.dealId = g.dealId || c.deal_id;
        }
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