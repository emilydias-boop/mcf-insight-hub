import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { normalizarEmail } from './useTotaisPorCliente';

/**
 * Compras REAIS do cliente (todos os gateways, todas as BUs).
 * Fonte única: RPC `get_compras_do_cliente`. Nada é lido de
 * `hubla_transactions` direto e nada é recalculado no front.
 */
export interface CompraCliente {
  produto: string;
  bu: string | null;
  gateway: string | null;
  sale_date: string | null;
  liquido: number;
  bruto: number;
  parcela: number | null;
  total_parcelas: number | null;
  reembolsado: boolean;
}

export function useComprasDoCliente(email?: string | null) {
  const normalizado = normalizarEmail(email);

  return useQuery({
    queryKey: ['compras-do-cliente', normalizado],
    enabled: !!normalizado,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<CompraCliente[]> => {
      const { data, error } = await supabase.rpc('get_compras_do_cliente' as any, {
        p_email: normalizado,
      });
      if (error) throw error;

      return ((data || []) as any[]).map((row) => ({
        produto: row.produto || 'Produto',
        bu: row.bu ?? null,
        gateway: row.gateway ?? null,
        sale_date: row.sale_date ?? null,
        liquido: Number(row.liquido) || 0,
        bruto: Number(row.bruto) || 0,
        parcela: row.parcela ?? null,
        total_parcelas: row.total_parcelas ?? null,
        reembolsado: !!row.reembolsado,
      }));
    },
  });
}
