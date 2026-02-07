import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfMonth, endOfMonth, format } from 'date-fns';
import { getDeduplicatedGross } from '@/lib/incorporadorPricing';

export interface BUMetrics {
  bu: 'incorporador' | 'consorcio' | 'credito' | 'leilao';
  value: number;
  target: number;
}

// Default targets (monthly values) - used as fallback if no team_monthly_goals configured
const DEFAULT_TARGETS: Record<string, number> = {
  ultrameta_incorporador: 2500000,  // 2.5M
  ultrameta_consorcio: 15000000,    // 15M em cartas
  ultrameta_credito: 500000,
  ultrameta_leilao: 200000,
};

// Format date for RPC query with timezone
const formatDateForQuery = (date: Date, isEndOfDay = false): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const time = isEndOfDay ? '23:59:59' : '00:00:00';
  return `${year}-${month}-${day}T${time}-03:00`;
};

export function useUltrametaByBU() {
  return useQuery({
    queryKey: ['ultrameta-by-bu'],
    queryFn: async (): Promise<BUMetrics[]> => {
      const now = new Date();
      const monthStart = startOfMonth(now);
      const monthEnd = endOfMonth(now);
      const currentAnoMes = format(now, 'yyyy-MM');

      // 1. Fetch first transaction IDs for deduplication
      const { data: firstIdsData } = await supabase.rpc('get_first_transaction_ids');
      const firstIdSet = new Set((firstIdsData || []).map((r: { id: string }) => r.id));

      // 2. Fetch all data in parallel (including team_monthly_goals)
      const [
        incorporadorResult,
        consorcioResult,
        leilaoResult,
        targetsResult,
        teamGoalsResult,
      ] = await Promise.all([
        // Incorporador: use RPC with monthly period
        supabase.rpc('get_all_hubla_transactions', {
          p_start_date: formatDateForQuery(monthStart),
          p_end_date: formatDateForQuery(monthEnd, true),
          p_limit: 10000,
          p_search: null,
          p_products: null,
        }),

        // Consórcio: consortium_cards valor_credito (NOT valor_comissao)
        supabase
          .from('consortium_cards')
          .select('valor_credito')
          .gte('data_contratacao', monthStart.toISOString().split('T')[0])
          .lte('data_contratacao', monthEnd.toISOString().split('T')[0])
          .not('valor_credito', 'is', null),

        // Leilão: hubla_transactions with product_category = 'clube_arremate'
        supabase
          .from('hubla_transactions')
          .select('net_value, product_price, gross_override')
          .eq('product_category', 'clube_arremate')
          .gte('sale_date', monthStart.toISOString())
          .lte('sale_date', monthEnd.toISOString()),

        // Legacy targets from team_targets (fallback)
        supabase
          .from('team_targets')
          .select('target_type, target_value')
          .in('target_type', [
            'ultrameta_incorporador',
            'ultrameta_consorcio',
            'ultrameta_credito',
            'ultrameta_leilao',
          ]),

        // NEW: Fetch team_monthly_goals for current month
        supabase
          .from('team_monthly_goals')
          .select('*')
          .eq('ano_mes', currentAnoMes),
      ]);

      // 3. Calculate Incorporador with deduplication
      const incorporadorValue = (incorporadorResult.data || []).reduce((sum: number, t: any) => {
        const isFirst = firstIdSet.has(t.id);
        const transaction = {
          product_name: t.product_name,
          product_price: t.product_price,
          installment_number: t.installment_number,
          gross_override: t.gross_override,
        };
        return sum + getDeduplicatedGross(transaction, isFirst);
      }, 0);

      // 4. Calculate Consórcio using valor_credito
      const consorcioValue = consorcioResult.data?.reduce(
        (sum, row) => sum + (row.valor_credito || 0),
        0
      ) || 0;

      // 5. Calculate Leilão
      const leilaoValue = (leilaoResult.data || []).reduce((sum: number, row: any) => {
        const value = row.gross_override ?? row.product_price ?? row.net_value ?? 0;
        return sum + value;
      }, 0);

      // Crédito placeholder (no data source yet)
      const creditoValue = 0;

      // Build legacy targets map (fallback)
      const legacyTargetsMap: Record<string, number> = {};
      targetsResult.data?.forEach((t) => {
        legacyTargetsMap[t.target_type] = t.target_value;
      });

      // Build team_monthly_goals map by BU
      const teamGoalsMap: Record<string, any> = {};
      (teamGoalsResult.data || []).forEach((goal: any) => {
        teamGoalsMap[goal.bu] = goal;
      });

      // Helper to get target with priority: team_monthly_goals > team_targets > DEFAULT
      const getTarget = (bu: string, legacyKey: string): number => {
        // Priority 1: team_monthly_goals (ultrameta_valor)
        if (teamGoalsMap[bu]?.ultrameta_valor) {
          return teamGoalsMap[bu].ultrameta_valor;
        }
        // Priority 2: team_targets
        if (legacyTargetsMap[legacyKey]) {
          return legacyTargetsMap[legacyKey];
        }
        // Priority 3: DEFAULT
        return DEFAULT_TARGETS[legacyKey] || 0;
      };

      return [
        {
          bu: 'incorporador',
          value: incorporadorValue,
          target: getTarget('incorporador', 'ultrameta_incorporador'),
        },
        {
          bu: 'consorcio',
          value: consorcioValue,
          target: getTarget('consorcio', 'ultrameta_consorcio'),
        },
        {
          bu: 'credito',
          value: creditoValue,
          target: getTarget('credito', 'ultrameta_credito'),
        },
        {
          bu: 'leilao',
          value: leilaoValue,
          target: getTarget('leilao', 'ultrameta_leilao'),
        },
      ];
    },
    staleTime: 60 * 1000, // 1 minute
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });
}
