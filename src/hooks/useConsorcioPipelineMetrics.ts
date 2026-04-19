import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, format } from 'date-fns';
import { CONSORCIO_WEEK_STARTS_ON } from '@/lib/businessDays';
import { CONSORCIO_PROPOSTA_STAGE_IDS } from '@/lib/consorcioStages';

interface PeriodCounts {
  propostaEnviada: number;
}

export interface ConsorcioPipelineMetrics {
  day: PeriodCounts;
  week: PeriodCounts;
  month: PeriodCounts;
  isLoading: boolean;
}

export function useConsorcioPipelineMetrics(): ConsorcioPipelineMetrics {
  const today = new Date();
  const todayNormalized = startOfDay(today);

  const dayStart = format(startOfDay(today), "yyyy-MM-dd'T'HH:mm:ss");
  const dayEnd = format(endOfDay(today), "yyyy-MM-dd'T'HH:mm:ss");
  const weekStart = format(startOfWeek(todayNormalized, { weekStartsOn: CONSORCIO_WEEK_STARTS_ON }), "yyyy-MM-dd'T'HH:mm:ss");
  const weekEnd = format(endOfWeek(todayNormalized, { weekStartsOn: CONSORCIO_WEEK_STARTS_ON }), "yyyy-MM-dd'T'HH:mm:ss");
  const monthStart = format(startOfMonth(today), "yyyy-MM-dd'T'HH:mm:ss");
  const monthEnd = format(endOfMonth(today), "yyyy-MM-dd'T'HH:mm:ss");

  const { data, isLoading } = useQuery({
    queryKey: ['consorcio-pipeline-metrics-v2', monthStart],
    queryFn: async () => {
      // Stage moves (Proposta Enviada VdA)
      const { data: deals, error } = await supabase
        .from('crm_deals')
        .select('id, stage_moved_at')
        .in('stage_id', CONSORCIO_PROPOSTA_STAGE_IDS)
        .gte('stage_moved_at', monthStart)
        .lte('stage_moved_at', monthEnd);
      if (error) throw error;

      // consorcio_proposals
      const { data: proposals, error: pError } = await supabase
        .from('consorcio_proposals')
        .select('deal_id, created_at')
        .gte('created_at', monthStart)
        .lte('created_at', monthEnd);
      if (pError) throw pError;

      return {
        deals: deals || [],
        proposals: (proposals || []).filter((p) => p.deal_id),
      };
    },
  });

  const countDistinct = (start: string, end: string): number => {
    if (!data) return 0;
    const set = new Set<string>();
    data.deals
      .filter((d) => d.stage_moved_at >= start && d.stage_moved_at <= end)
      .forEach((d) => set.add(d.id));
    data.proposals
      .filter((p) => p.created_at >= start && p.created_at <= end)
      .forEach((p) => p.deal_id && set.add(p.deal_id));
    return set.size;
  };

  return {
    day: { propostaEnviada: countDistinct(dayStart, dayEnd) },
    week: { propostaEnviada: countDistinct(weekStart, weekEnd) },
    month: { propostaEnviada: countDistinct(monthStart, monthEnd) },
    isLoading,
  };
}
