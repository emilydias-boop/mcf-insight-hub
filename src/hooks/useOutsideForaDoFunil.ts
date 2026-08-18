import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

export interface OutsideForaDoFunilItem {
  customer_email: string;
  customer_name: string | null;
  contrato_em: string;
  motivo: string;
}

/**
 * Contratos que entraram completamente fora do funil no período:
 * cliente sem nenhum contato no CRM, ou com contato mas sem nenhuma reunião.
 * Não têm closer possível, então somam apenas no total do time — nunca na
 * tabela por closer. O caso "pagou antes da R1" NÃO vem daqui: ele já é
 * contado por useR1CloserMetrics e atribuído ao closer da R1.
 * Regra vive na função outside_fora_do_funil() no Postgres.
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
