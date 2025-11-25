import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface FunnelStage {
  etapa: string;
  leads: number;
  conversao: number;
  meta: number;
}

export const useFunnelData = (startDate?: Date, endDate?: Date) => {
  return useQuery({
    queryKey: ['funnel-data', startDate?.toISOString(), endDate?.toISOString()],
    queryFn: async () => {
      // Buscar semanas no período
      let query = supabase
        .from('weekly_metrics')
        .select('*')
        .order('start_date', { ascending: false });
      
      if (startDate) {
        query = query.gte('start_date', startDate.toISOString().split('T')[0]);
      }
      if (endDate) {
        query = query.lte('end_date', endDate.toISOString().split('T')[0]);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      if (!data || data.length === 0) return [];

      // Agregar dados de todas as semanas do período
      const aggregated: Record<string, { actual: number; rate: number; target: number; count: number }> = {};
      
      for (let i = 1; i <= 8; i++) {
        const stageNum = String(i).padStart(2, '0');
        aggregated[stageNum] = { actual: 0, rate: 0, target: 0, count: 0 };
      }
      
      data.forEach(week => {
        for (let i = 1; i <= 8; i++) {
          const stageNum = String(i).padStart(2, '0');
          aggregated[stageNum].actual += week[`stage_${stageNum}_actual`] || 0;
          aggregated[stageNum].rate += week[`stage_${stageNum}_rate`] || 0;
          aggregated[stageNum].target += week[`stage_${stageNum}_target`] || 0;
          aggregated[stageNum].count += 1;
        }
      });

      // Montar dados do funil
      const funnelStages: FunnelStage[] = [];
      
      for (let i = 1; i <= 8; i++) {
        const stageNum = String(i).padStart(2, '0');
        const agg = aggregated[stageNum];
        
        funnelStages.push({
          etapa: `Etapa ${stageNum}`,
          leads: agg.actual,
          conversao: agg.count > 0 ? agg.rate / agg.count : 0,
          meta: agg.target,
        });
      }

      return funnelStages;
    },
  });
};

export const useA010Funnel = (startDate?: Date, endDate?: Date) => {
  const { data: stages, isLoading, error } = useFunnelData(startDate, endDate);
  
  // Filtrar apenas as etapas do funil A010 (etapas 1, 3, 4, 5)
  const a010Stages = stages?.filter((stage, index) => 
    index === 0 || index === 2 || index === 3 || index === 4
  ) || [];
  
  return {
    data: a010Stages,
    isLoading,
    error,
  };
};

export const useInstagramFunnel = (startDate?: Date, endDate?: Date) => {
  const { data: stages, isLoading, error } = useFunnelData(startDate, endDate);
  
  // Usar as primeiras 4 etapas para o funil Instagram
  const instagramStages = stages?.slice(0, 4) || [];
  
  return {
    data: instagramStages,
    isLoading,
    error,
  };
};
