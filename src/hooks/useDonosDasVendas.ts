import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const LOTE = 1500;

/**
 * Identidade do cliente por venda via RPC `donos_das_vendas`.
 * Chave = transaction_id → dono_key (contato do lead vinculado; senão contato
 * cujo e-mail/e-mail alternativo bate; senão o próprio e-mail).
 */
export function useDonosDasVendas(ids: string[]) {
  const ordenados = useMemo(
    () => Array.from(new Set(ids.filter(Boolean))).sort(),
    [ids],
  );
  const idsKey = useMemo(() => ordenados.join(','), [ordenados]);

  const { data, isLoading } = useQuery<{ transaction_id: string; dono_key: string }[]>({
    queryKey: ['donos-das-vendas', idsKey],
    enabled: ordenados.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const lotes: string[][] = [];
      for (let i = 0; i < ordenados.length; i += LOTE) lotes.push(ordenados.slice(i, i + LOTE));
      const results = await Promise.all(
        lotes.map(async (p_ids) => {
          const { data, error } = await (supabase.rpc as any)('donos_das_vendas', { p_ids });
          if (error) throw error;
          return Array.isArray(data) ? data : [];
        }),
      );
      return results.flat();
    },
  });

  const map = useMemo(() => {
    const m = new Map<string, string>();
    (data || []).forEach((d) => {
      if (d.transaction_id && d.dono_key) m.set(d.transaction_id, d.dono_key);
    });
    return m;
  }, [data]);

  return { map, isLoading: ordenados.length > 0 && isLoading };
}
