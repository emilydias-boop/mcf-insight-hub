import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { parse, startOfMonth, endOfMonth } from 'date-fns';
import { getDeduplicatedGross } from '@/lib/incorporadorPricing';

// Format date for RPC query with timezone
const formatDateForQuery = (date: Date, isEndOfDay = false): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const time = isEndOfDay ? '23:59:59' : '00:00:00';
  return `${year}-${month}-${day}T${time}-03:00`;
};

/**
 * Hook to calculate team revenue for a specific month and BU.
 * Uses the same logic as useUltrametaByBU but respects the selected anoMes.
 */
export function useTeamRevenueByMonth(anoMes: string, bu: string) {
  return useQuery({
    queryKey: ['team-revenue-by-month', anoMes, bu],
    queryFn: async (): Promise<number> => {
      // Parse anoMes (e.g., "2026-01") to get month boundaries
      const monthDate = parse(anoMes, 'yyyy-MM', new Date());
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);

      if (bu === 'incorporador') {
        // 1. Fetch first transaction IDs for deduplication
        const { data: firstIdsData } = await supabase.rpc('get_first_transaction_ids');
        const firstIdSet = new Set((firstIdsData || []).map((r: { id: string }) => r.id));

        // 2. Fetch transactions for the selected month
        const { data: transactions } = await supabase.rpc('get_hubla_transactions_by_bu', {
          p_bu: 'incorporador',
          p_search: null,
          p_start_date: formatDateForQuery(monthStart),
          p_end_date: formatDateForQuery(monthEnd, true),
          p_limit: 10000,
        });

        // 3. Calculate with deduplication
        const value = (transactions || []).reduce((sum: number, t: any) => {
          const isFirst = firstIdSet.has(t.id);
          const transaction = {
            product_name: t.product_name,
            product_price: t.product_price,
            installment_number: t.installment_number,
            gross_override: t.gross_override,
            reference_price: t.reference_price,
          };
          return sum + getDeduplicatedGross(transaction, isFirst);
        }, 0);

        return value;
      }

      if (bu === 'consorcio') {
        // Consórcio: consortium_cards valor_credito
        const { data } = await supabase
          .from('consortium_cards')
          .select('valor_credito')
          .gte('data_contratacao', monthStart.toISOString().split('T')[0])
          .lte('data_contratacao', monthEnd.toISOString().split('T')[0])
          .not('valor_credito', 'is', null);

        return data?.reduce((sum, row) => sum + (row.valor_credito || 0), 0) || 0;
      }

      if (bu === 'leilao') {
        // Leilão: hubla_transactions with product_category = 'clube_arremate'
        const { data } = await supabase
          .from('hubla_transactions')
          .select('net_value, product_price, gross_override')
          .eq('product_category', 'clube_arremate')
          .gte('sale_date', monthStart.toISOString())
          .lte('sale_date', monthEnd.toISOString());

        return (data || []).reduce((sum: number, row: any) => {
          const value = row.gross_override ?? row.product_price ?? row.net_value ?? 0;
          return sum + value;
        }, 0);
      }

      // Default: no data for unknown BU
      return 0;
    },
    staleTime: 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
}
