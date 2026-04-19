import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, format } from 'date-fns';
import { CONSORCIO_WEEK_STARTS_ON } from '@/lib/businessDays';
import { CONSORCIO_FECHAMENTO_STAGE_IDS } from '@/lib/consorcioStages';

export interface ProdutoFechadoMetric {
  id: string;
  label: string;
  day: number;
  week: number;
  month: number;
}

export interface ConsorcioProdutosFechadosMetrics {
  products: ProdutoFechadoMetric[];
  totalDay: number;
  totalWeek: number;
  totalMonth: number;
  isLoading: boolean;
}

export function useConsorcioProdutosFechadosMetrics(): ConsorcioProdutosFechadosMetrics {
  const today = new Date();
  const todayNormalized = startOfDay(today);

  const dayStart = format(startOfDay(today), "yyyy-MM-dd'T'HH:mm:ss");
  const dayEnd = format(endOfDay(today), "yyyy-MM-dd'T'HH:mm:ss");
  const weekStart = format(startOfWeek(todayNormalized, { weekStartsOn: CONSORCIO_WEEK_STARTS_ON }), "yyyy-MM-dd'T'HH:mm:ss");
  const weekEnd = format(endOfWeek(todayNormalized, { weekStartsOn: CONSORCIO_WEEK_STARTS_ON }), "yyyy-MM-dd'T'HH:mm:ss");
  const monthStart = format(startOfMonth(today), "yyyy-MM-dd'T'HH:mm:ss");
  const monthEnd = format(endOfMonth(today), "yyyy-MM-dd'T'HH:mm:ss");

  const { data: options = [], isLoading: optionsLoading } = useQuery({
    queryKey: ['produto-fechado-options-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('consorcio_produto_adquirido_options' as any)
        .select('id, label, name')
        .eq('is_active', true)
        .order('display_order', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as { id: string; label: string; name: string }[];
    },
  });

  const { data, isLoading: recordsLoading } = useQuery({
    queryKey: ['produtos-fechados-metrics-v2', monthStart],
    queryFn: async () => {
      const { data: prods, error } = await supabase
        .from('deal_produtos_adquiridos' as any)
        .select('id, produto_option_id, deal_id, created_at')
        .gte('created_at', monthStart)
        .lte('created_at', monthEnd);
      if (error) throw error;

      const { data: stageDeals, error: dError } = await supabase
        .from('crm_deals')
        .select('id, stage_moved_at')
        .in('stage_id', CONSORCIO_FECHAMENTO_STAGE_IDS)
        .gte('stage_moved_at', monthStart)
        .lte('stage_moved_at', monthEnd);
      if (dError) throw dError;

      return {
        records: (prods || []) as unknown as { id: string; produto_option_id: string; deal_id: string; created_at: string }[],
        stageDeals: (stageDeals || []) as { id: string; stage_moved_at: string }[],
      };
    },
  });

  const records = data?.records || [];
  const stageDeals = data?.stageDeals || [];

  const products: ProdutoFechadoMetric[] = options.map((opt) => {
    const optRecords = records.filter((r) => r.produto_option_id === opt.id);
    return {
      id: opt.id,
      label: opt.label,
      day: optRecords.filter((r) => r.created_at >= dayStart && r.created_at <= dayEnd).length,
      week: optRecords.filter((r) => r.created_at >= weekStart && r.created_at <= weekEnd).length,
      month: optRecords.length,
    };
  });

  // Totals = DISTINCT deal_id from records ∪ stageDeals per period
  const distinctInPeriod = (start: string, end: string): number => {
    const set = new Set<string>();
    records
      .filter((r) => r.created_at >= start && r.created_at <= end && r.deal_id)
      .forEach((r) => set.add(r.deal_id));
    stageDeals
      .filter((d) => d.stage_moved_at >= start && d.stage_moved_at <= end)
      .forEach((d) => set.add(d.id));
    return set.size;
  };

  return {
    products,
    totalDay: distinctInPeriod(dayStart, dayEnd),
    totalWeek: distinctInPeriod(weekStart, weekEnd),
    totalMonth: distinctInPeriod(monthStart, monthEnd),
    isLoading: optionsLoading || recordsLoading,
  };
}
