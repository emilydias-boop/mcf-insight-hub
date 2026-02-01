import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfWeek, endOfWeek } from 'date-fns';

export interface BUMetrics {
  bu: 'incorporador' | 'consorcio' | 'credito' | 'leilao';
  value: number;
  target: number;
}

// Default targets (used if not configured in team_targets)
const DEFAULT_TARGETS: Record<string, number> = {
  ultrameta_incorporador: 500000,
  ultrameta_consorcio: 150000,
  ultrameta_credito: 100000,
  ultrameta_leilao: 50000,
};

export function useUltrametaByBU() {
  return useQuery({
    queryKey: ['ultrameta-by-bu'],
    queryFn: async (): Promise<BUMetrics[]> => {
      const now = new Date();
      const weekStart = startOfWeek(now, { weekStartsOn: 6 }); // Saturday
      const weekEnd = endOfWeek(now, { weekStartsOn: 6 }); // Friday

      // Fetch all data in parallel
      const [
        incorporadorResult,
        consorcioResult,
        leilaoResult,
        targetsResult,
      ] = await Promise.all([
        // Incorporador: hubla_transactions with product_category = 'incorporador'
        // Use gross_override if available, otherwise product_price
        supabase
          .from('hubla_transactions')
          .select('net_value, product_price, gross_override')
          .eq('product_category', 'incorporador')
          .gte('sale_date', weekStart.toISOString())
          .lte('sale_date', weekEnd.toISOString()),

        // Consórcio: consortium_cards valor_comissao
        supabase
          .from('consortium_cards')
          .select('valor_comissao')
          .gte('data_contratacao', weekStart.toISOString().split('T')[0])
          .lte('data_contratacao', weekEnd.toISOString().split('T')[0])
          .not('valor_comissao', 'is', null),

        // Leilão: hubla_transactions with product_category = 'clube_arremate'
        supabase
          .from('hubla_transactions')
          .select('net_value, product_price, gross_override')
          .eq('product_category', 'clube_arremate')
          .gte('sale_date', weekStart.toISOString())
          .lte('sale_date', weekEnd.toISOString()),

        // Targets from team_targets
        supabase
          .from('team_targets')
          .select('target_type, target_value')
          .in('target_type', [
            'ultrameta_incorporador',
            'ultrameta_consorcio',
            'ultrameta_credito',
            'ultrameta_leilao',
          ]),
      ]);

      // Helper to calculate gross value from hubla transactions
      const calcGrossValue = (data: { net_value: number | null; product_price: number | null; gross_override: number | null }[] | null) => {
        if (!data) return 0;
        return data.reduce((sum, row) => {
          // Priority: gross_override > product_price > net_value
          const value = row.gross_override ?? row.product_price ?? row.net_value ?? 0;
          return sum + value;
        }, 0);
      };

      // Calculate totals
      const incorporadorValue = calcGrossValue(incorporadorResult.data);

      const consorcioValue = consorcioResult.data?.reduce(
        (sum, row) => sum + (row.valor_comissao || 0),
        0
      ) || 0;

      // For Crédito, we'll use a placeholder since credit_operations may not exist
      // TODO: Replace with actual credit metrics when table is confirmed
      const creditoValue = 0;

      const leilaoValue = calcGrossValue(leilaoResult.data);

      // Build targets map
      const targetsMap: Record<string, number> = {};
      targetsResult.data?.forEach((t) => {
        targetsMap[t.target_type] = t.target_value;
      });

      const getTarget = (key: string) => targetsMap[key] || DEFAULT_TARGETS[key] || 0;

      return [
        {
          bu: 'incorporador',
          value: incorporadorValue,
          target: getTarget('ultrameta_incorporador'),
        },
        {
          bu: 'consorcio',
          value: consorcioValue,
          target: getTarget('ultrameta_consorcio'),
        },
        {
          bu: 'credito',
          value: creditoValue,
          target: getTarget('ultrameta_credito'),
        },
        {
          bu: 'leilao',
          value: leilaoValue,
          target: getTarget('ultrameta_leilao'),
        },
      ];
    },
    staleTime: 60 * 1000, // 1 minute
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });
}
