import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Atribuicao {
  transaction_id: string;
  closer_id: string;
  closer_nome: string;
  closer_bu: string | null;
  outra_bu: boolean;
  attendee_id: string | null;
  deal_id: string | null;
  deal_tags: string[];
  r1_at: string | null;
  is_outside: boolean;
  regra: 'vinculo' | 'r1_contrato_pago' | 'r1_anterior' | 'r1_posterior' | 'manual';
  sdr_profile_id: string | null;
}

const LOTE = 1500;

/** Atribuição de closer por venda via RPC `atribuicao_closer_vendas`. Chave = transaction_id. */
export function useAtribuicaoCloser(transactionIds: string[], bu?: string) {
  const ids = useMemo(
    () => Array.from(new Set(transactionIds.filter(Boolean))).sort(),
    [transactionIds],
  );
  const idsKey = useMemo(() => ids.join(','), [ids]);

  const { data, isLoading } = useQuery<Atribuicao[]>({
    queryKey: ['atribuicao-closer', bu ?? null, idsKey],
    enabled: ids.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const lotes: string[][] = [];
      for (let i = 0; i < ids.length; i += LOTE) lotes.push(ids.slice(i, i + LOTE));
      const results = await Promise.all(
        lotes.map(async (p_ids) => {
          const { data, error } = await (supabase.rpc as any)('atribuicao_closer_vendas', {
            p_ids,
            p_bu: bu ?? null,
          });
          if (error) throw error;
          return (Array.isArray(data) ? data : []) as Atribuicao[];
        }),
      );
      return results.flat();
    },
  });

  const map = useMemo(() => {
    const m = new Map<string, Atribuicao>();
    (data || []).forEach((a) => m.set(a.transaction_id, a));
    return m;
  }, [data]);

  return { map, isLoading: ids.length > 0 && isLoading };
}
