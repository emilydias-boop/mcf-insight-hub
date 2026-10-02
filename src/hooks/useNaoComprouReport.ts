import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

export type R2Desfecho =
  | 'comprou'
  | 'nao_comprou'
  | 'reprovado'
  | 'proxima_semana'
  | 'desistente'
  | 'reembolso'
  | 'cancelado'
  | 'em_analise';

export interface R2DesfechoRow {
  attendee_id: string;
  deal_id: string | null;
  lead_name: string | null;
  email: string | null;
  phone: string | null;
  r2_at: string | null;
  closer_r2_id: string | null;
  closer_r2_name: string | null;
  closer_r1_name: string | null;
  r1_at: string | null;
  status_final: string | null;
  desfecho: R2Desfecho;
  estimado: boolean;
  parceria_produto: string | null;
  parceria_data: string | null;
  parceria_liquido: number | null;
}

export interface R2DesfechoExtras {
  attendee_id: string;
  closer_notes: string | null;
  r2_observations: string | null;
  tentativas_pos_r2: number | null;
  ultima_tentativa: string | null;
}

export type NaoComprouLead = R2DesfechoRow & {
  closer_notes: string | null;
  r2_observations: string | null;
  tentativas_pos_r2: number;
  ultima_tentativa: string | null;
};

export interface NaoComprouResumo {
  total: number;
  comprou: number;
  naoComprou: number;
  naoComprouEstimados: number;
  outros: number;
}

export interface NaoComprouReportData {
  rows: R2DesfechoRow[];
  leads: NaoComprouLead[];
  resumo: NaoComprouResumo;
}

interface Options {
  from: Date;
  to: Date;
  bu: string;
}

export function useNaoComprouReport({ from, to, bu }: Options) {
  const pFrom = format(from, 'yyyy-MM-dd');
  const pTo = format(to, 'yyyy-MM-dd');
  return useQuery({
    queryKey: ['nao-comprou-report', pFrom, pTo, bu],
    queryFn: async (): Promise<NaoComprouReportData> => {
      const { data, error } = await (supabase.rpc as any)('r2_desfecho', { p_from: pFrom, p_to: pTo, p_bu: bu });
      if (error) throw error;
      const rows = (data || []) as R2DesfechoRow[];

      const resumo: NaoComprouResumo = { total: rows.length, comprou: 0, naoComprou: 0, naoComprouEstimados: 0, outros: 0 };
      for (const r of rows) {
        if (r.desfecho === 'comprou') resumo.comprou++;
        else if (r.desfecho === 'nao_comprou') {
          resumo.naoComprou++;
          if (r.estimado) resumo.naoComprouEstimados++;
        } else resumo.outros++;
      }

      const nao = rows.filter(r => r.desfecho === 'nao_comprou');
      const ids = nao.map(r => r.attendee_id);
      const extrasMap = new Map<string, R2DesfechoExtras>();
      for (let i = 0; i < ids.length; i += 200) {
        const { data: ex, error: exErr } = await (supabase.rpc as any)('r2_desfecho_extras', { p_attendee_ids: ids.slice(i, i + 200) });
        if (exErr) throw exErr;
        ((ex || []) as R2DesfechoExtras[]).forEach(e => extrasMap.set(e.attendee_id, e));
      }

      const leads: NaoComprouLead[] = nao.map(r => {
        const e = extrasMap.get(r.attendee_id);
        return {
          ...r,
          closer_notes: e?.closer_notes ?? null,
          r2_observations: e?.r2_observations ?? null,
          tentativas_pos_r2: e?.tentativas_pos_r2 ?? 0,
          ultima_tentativa: e?.ultima_tentativa ?? null,
        };
      });

      return { rows, leads, resumo };
    },
  });
}
