import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

export interface OutsideForaDoFunilItem {
  transaction_id: string;
  customer_email: string;
  customer_name: string | null;
  offer_name: string | null;
  source: string | null;
  contrato_em: string;
  net_value: number | null;
}

/**
 * Vendas de contrato que não passaram pelo time: fora do MCF Pay (checkout do
 * time) e fora dos links pessoais de closer (ofertas CLS). Régua vive na função
 * outside_fora_do_funil() no Postgres. É a lista completa de Outside do
 * período — não deve ser somada a nenhum outro cálculo.
 */
export function useOutsideForaDoFunil(startDate: Date, endDate: Date, bu: string = 'incorporador') {
  return useQuery({
    queryKey: ['outside-fora-do-funil', format(startDate, 'yyyy-MM-dd'), format(endDate, 'yyyy-MM-dd'), bu],
    queryFn: async (): Promise<OutsideForaDoFunilItem[]> => {
      // O conceito de Outside só existe no Incorporador.
      if (bu !== 'incorporador') return [];
      const { data, error } = await (supabase as any).rpc('outside_fora_do_funil', {
        p_from: format(startDate, 'yyyy-MM-dd'),
        p_to: format(endDate, 'yyyy-MM-dd'),
      });
      if (error) throw error;
      return (data as OutsideForaDoFunilItem[]) ?? [];
    },
    staleTime: 30_000,
  });
}
