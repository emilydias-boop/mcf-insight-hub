import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Fonte ÚNICA de "quanto esse cliente já comprou da gente".
 * Toda a regra (carrinho Hubla, NewSale, duplicatas make, aliases, todas as BUs)
 * vive na RPC `get_totais_por_cliente`. Nada é recalculado no front e não há
 * fallback lendo `hubla_transactions` — se a RPC falhar, mostramos vazio.
 */

export interface TotaisCliente {
  cliente_email: string;
  total_liquido_pago: number;
  qtd_produtos: number;
  qtd_pagamentos: number;
  primeira_compra: string | null;
  ultima_compra: string | null;
  tem_reembolso: boolean;
  produtos: string[];
}

export const normalizarEmail = (email?: string | null): string =>
  (email || '').trim().toLowerCase();

export async function fetchTotaisPorCliente(emails: string[]): Promise<Map<string, TotaisCliente>> {
  const lista = Array.from(new Set(emails.map(normalizarEmail).filter(Boolean)));
  const mapa = new Map<string, TotaisCliente>();
  if (lista.length === 0) return mapa;

  const { data, error } = await supabase.rpc('get_totais_por_cliente', { p_emails: lista });
  if (error) throw error;

  for (const row of (data || []) as any[]) {
    const email = normalizarEmail(row.cliente_email);
    if (!email) continue;
    mapa.set(email, {
      cliente_email: email,
      total_liquido_pago: Number(row.total_liquido_pago) || 0,
      qtd_produtos: Number(row.qtd_produtos) || 0,
      qtd_pagamentos: Number(row.qtd_pagamentos) || 0,
      primeira_compra: row.primeira_compra ?? null,
      ultima_compra: row.ultima_compra ?? null,
      tem_reembolso: !!row.tem_reembolso,
      produtos: (row.produtos || []) as string[],
    });
  }
  return mapa;
}

/** Lote — usado pelo Kanban (uma chamada por board, não por card). */
export function useTotaisPorCliente(emails: (string | null | undefined)[]) {
  const lista = Array.from(
    new Set((emails || []).map(normalizarEmail).filter(Boolean)),
  ).sort();

  return useQuery({
    queryKey: ['totais-por-cliente', lista],
    enabled: lista.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: () => fetchTotaisPorCliente(lista),
  });
}

/** Um cliente só — mesmo número da versão em lote. */
export function useTotalCliente(email?: string | null) {
  const normalizado = normalizarEmail(email);

  return useQuery({
    queryKey: ['totais-por-cliente', [normalizado]],
    enabled: !!normalizado,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => (await fetchTotaisPorCliente([normalizado])).get(normalizado) ?? null,
  });
}
