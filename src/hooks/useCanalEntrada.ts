import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CanalEntrada {
  transaction_id: string;
  canal: string;
  fonte: 'compra' | 'tag' | 'lancamento' | 'nenhum';
  produto_entrada: string | null;
  data_entrada: string | null;
}

const LOTE = 1500;

/** Canal de entrada por venda via RPC `canal_entrada_vendas`. Chave = transaction_id. */
export function useCanalEntrada(transactionIds: string[], enabled: boolean) {
  const ids = useMemo(
    () => Array.from(new Set(transactionIds.filter(Boolean))).sort(),
    [transactionIds],
  );
  const idsKey = useMemo(() => ids.join(','), [ids]);

  const { data, isLoading } = useQuery<CanalEntrada[]>({
    queryKey: ['canal-entrada', idsKey],
    enabled: enabled && ids.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const lotes: string[][] = [];
      for (let i = 0; i < ids.length; i += LOTE) lotes.push(ids.slice(i, i + LOTE));
      const results = await Promise.all(
        lotes.map(async (p_ids) => {
          const { data, error } = await (supabase.rpc as any)('canal_entrada_vendas', { p_ids });
          if (error) throw error;
          return (Array.isArray(data) ? data : []) as CanalEntrada[];
        }),
      );
      return results.flat();
    },
  });

  const map = useMemo(() => {
    const m = new Map<string, CanalEntrada>();
    (data || []).forEach((c) => m.set(c.transaction_id, c));
    return m;
  }, [data]);

  return { map, isLoading: enabled && ids.length > 0 && isLoading };
}

/** Lista oficial e ordem de exibição dos canais de entrada via RPC `canais_entrada_lista`. */
export function useCanaisEntradaLista() {
  return useQuery<string[]>({
    queryKey: ['canais-entrada-lista'],
    staleTime: 60 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)('canais_entrada_lista');
      if (error) throw error;
      return (Array.isArray(data) ? data : []) as string[];
    },
  });
}
