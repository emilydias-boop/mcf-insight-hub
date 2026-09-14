import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

export interface SugestaoVinculo {
  transaction_id: string;
  customer_name: string | null;
  valor: number | null;
  sale_date: string | null;
  deal_id: string;
  attendee_id: string;
  closer_id: string | null;
  closer_name: string | null;
  meeting_type: string | null;
  scheduled_at: string | null;
  status_attendee: string | null;
  criterio: string;
  forca: 'forte' | 'media' | 'fraca';
  r1_antes_do_pagamento: boolean;
  qtd_candidatos: number;
}

/**
 * Candidatos de reunião para cada transação de contrato ainda sem vínculo.
 * Fonte: RPC somente-leitura public.sugerir_vinculo_contrato(). Nada é gravado
 * aqui — a escrita só acontece no clique do usuário (useAtribuirVinculoContrato).
 */
export function useSugestoesVinculoContrato(
  startDate: Date,
  endDate: Date,
  bu: string = 'incorporador',
  enabled = true,
) {
  return useQuery({
    queryKey: ['sugestoes-vinculo-contrato', format(startDate, 'yyyy-MM-dd'), format(endDate, 'yyyy-MM-dd'), bu],
    enabled,
    staleTime: 60_000,
    queryFn: async (): Promise<Map<string, SugestaoVinculo[]>> => {
      const { data, error } = await (supabase as any).rpc('sugerir_vinculo_contrato', {
        p_ini: format(startDate, 'yyyy-MM-dd'),
        p_fim: format(endDate, 'yyyy-MM-dd'),
        p_bu: bu,
      });
      if (error) throw error;

      const map = new Map<string, SugestaoVinculo[]>();
      ((data as SugestaoVinculo[]) || []).forEach((row) => {
        const list = map.get(row.transaction_id) || [];
        list.push(row);
        map.set(row.transaction_id, list);
      });
      // Ordena por confiança dentro de cada transação (forte → média → fraca).
      const peso = { forte: 0, media: 1, fraca: 2 } as const;
      map.forEach((list) => list.sort((a, b) => peso[a.forca] - peso[b.forca]));
      return map;
    },
  });
}
