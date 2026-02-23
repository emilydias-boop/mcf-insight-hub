import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, format } from 'date-fns';
import { CONSORCIO_WEEK_STARTS_ON } from '@/lib/businessDays';

// Stage ID for Viver de Aluguel pipeline (origin 4e2b810a)
const PROPOSTA_ENVIADA_STAGE_ID = '09a0a99e-feee-46df-a817-bc4d0e1ac3d9';

interface PeriodCounts {
  propostaEnviada: number;
}

export interface ConsorcioPipelineMetrics {
  day: PeriodCounts;
  week: PeriodCounts;
  month: PeriodCounts;
  isLoading: boolean;
}

function countByStage(deals: any[]): PeriodCounts {
  return {
    propostaEnviada: deals.filter(d => d.stage_id === PROPOSTA_ENVIADA_STAGE_ID).length,
  };
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
    queryKey: ['consorcio-pipeline-metrics', monthStart],
    queryFn: async () => {
      const { data: deals, error } = await supabase
        .from('crm_deals')
        .select('id, stage_id, stage_moved_at')
        .eq('stage_id', PROPOSTA_ENVIADA_STAGE_ID)
        .gte('stage_moved_at', monthStart)
        .lte('stage_moved_at', monthEnd);

      if (error) throw error;
      return deals || [];
    },
  });

  const metrics: ConsorcioPipelineMetrics = {
    day: countByStage((data || []).filter(d => d.stage_moved_at >= dayStart && d.stage_moved_at <= dayEnd)),
    week: countByStage((data || []).filter(d => d.stage_moved_at >= weekStart && d.stage_moved_at <= weekEnd)),
    month: countByStage(data || []),
    isLoading,
  };

  return metrics;
}
