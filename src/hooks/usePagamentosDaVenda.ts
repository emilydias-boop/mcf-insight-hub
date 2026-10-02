import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PagamentoDaVenda {
  pago: number;
  cobrancas: number;
}

const LOTE = 1500;

/**
 * Recebido/A receber de uma venda. O bruto (getDeduplicatedGross) segue contando o valor cheio;
 * aqui só mostramos quanto já entrou. Sem dado de pagamento → considera tudo recebido.
 */
export function calcRecebimento(gross: number, pago: number | undefined) {
  const recebido = gross > 0 ? Math.min(pago ?? gross, gross) : 0;
  const aReceber = gross > 0 ? Math.max(gross - (pago ?? gross), 0) : 0;
  return { recebido, aReceber };
}

/** Pagamentos por venda via RPC `pagamentos_da_venda`. Chave = transaction_id. */
export function usePagamentosDaVenda(transactionIds: string[]) {
  const ids = useMemo(
    () => Array.from(new Set(transactionIds.filter(Boolean))).sort(),
    [transactionIds],
  );
  const idsKey = useMemo(() => ids.join(','), [ids]);

  const { data, isLoading } = useQuery<{ transaction_id: string; pago: number; cobrancas: number }[]>({
    queryKey: ['pagamentos-da-venda', idsKey],
    enabled: ids.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const lotes: string[][] = [];
      for (let i = 0; i < ids.length; i += LOTE) lotes.push(ids.slice(i, i + LOTE));
      const results = await Promise.all(
        lotes.map(async (p_ids) => {
          const { data, error } = await (supabase.rpc as any)('pagamentos_da_venda', { p_ids });
          if (error) throw error;
          return Array.isArray(data) ? data : [];
        }),
      );
      return results.flat();
    },
  });

  const map = useMemo(() => {
    const m = new Map<string, PagamentoDaVenda>();
    (data || []).forEach((p) =>
      m.set(p.transaction_id, { pago: Number(p.pago) || 0, cobrancas: Number(p.cobrancas) || 0 }),
    );
    return m;
  }, [data]);

  return { map, isLoading: ids.length > 0 && isLoading };
}
