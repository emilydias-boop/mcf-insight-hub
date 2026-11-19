import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getFirstTransactionIdsCached } from '@/lib/firstTransactionIds';
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

      // 1. Fetch everything in parallel. The first transaction IDs are only needed
      //    to post-process the Incorporador result, not as input of any request.
      const [
        firstIdsResult,
        incorporadorResult,
        consorcioResult,
        targetsResult,
        teamGoalsResult,
      ] = await Promise.all([
        // First transaction IDs for deduplication (shared 5 min cache)
        getFirstTransactionIdsCached(),
        // Incorporador: use RPC with monthly period
        supabase.rpc('get_hubla_transactions_by_bu', {
          p_bu: 'incorporador',
          p_start_date: formatDateForQuery(monthStart),
          p_end_date: formatDateForQuery(monthEnd, true),
          p_limit: 10000,
          p_search: null,
        }),

        // Consórcio: consortium_cards valor_credito (NOT valor_comissao)
        supabase
          .from('consortium_cards')
          .select('valor_credito')
          .gte('data_contratacao', monthStart.toISOString().split('T')[0])
          .lte('data_contratacao', monthEnd.toISOString().split('T')[0])
          .not('valor_credito', 'is', null),

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

      const firstIdSet = new Set((firstIdsResult.data || []).map((r: { id: string }) => r.id));

      // 3. Calculate Incorporador with deduplication
      const incorporadorValue = (incorporadorResult.data || []).reduce((sum: number, t: any) => {
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

      // 4. Calculate Consórcio using valor_credito
      const consorcioValue = consorcioResult.data?.reduce(
        (sum, row) => sum + (row.valor_credito || 0),
        0
      ) || 0;

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
      ];
    },
    staleTime: 60 * 1000, // 1 minute
  });
}
