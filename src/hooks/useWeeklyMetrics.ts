import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface WeeklyMetric {
  id: string;
  start_date: string;
  end_date: string;
  week_label: string;
  
  // Custos
  ads_cost: number;
  team_cost: number;
  office_cost: number;
  total_cost: number;
  
  // Vendas
  a010_revenue: number;
  a010_sales: number;
  ob_construir_revenue: number;
  ob_vitalicio_revenue: number;
  ob_evento_revenue: number;
  contract_revenue: number;
  
  // Métricas
  roi: number;
  roas: number;
  cpl: number;
  
  // Funil
  stage_01_actual: number;
  stage_02_actual: number;
  stage_03_actual: number;
  stage_04_actual: number;
  stage_05_actual: number;
  stage_06_actual: number;
  stage_07_actual: number;
  stage_08_actual: number;
}

export const useWeeklyMetrics = (limit: number = 12) => {
  return useQuery({
    queryKey: ['weekly-metrics', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('weekly_metrics')
        .select('*')
        .order('start_date', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      return data as WeeklyMetric[];
    },
  });
};

export const useLatestMetrics = () => {
  return useQuery({
    queryKey: ['latest-metrics'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('weekly_metrics')
        .select('*')
        .order('start_date', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      return data as WeeklyMetric | null;
    },
  });
};

export const useMetricsSummary = () => {
  return useQuery({
    queryKey: ['metrics-summary'],
    queryFn: async () => {
      // Buscar última semana
      const { data: latest, error: latestError } = await supabase
        .from('weekly_metrics')
        .select('*')
        .order('start_date', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (latestError) throw latestError;
      
      // Se não houver dados, retornar null
      if (!latest) return null;

      // Buscar semana anterior para calcular variação
      const { data: previous } = await supabase
        .from('weekly_metrics')
        .select('*')
        .order('start_date', { ascending: false })
        .range(1, 1)
        .maybeSingle();

      const calculateChange = (current: number, prev: number) => {
        if (!prev) return 0;
        return ((current - prev) / prev) * 100;
      };

      // Calcular totais
      const totalRevenue = 
        (latest.a010_revenue || 0) +
        (latest.ob_construir_revenue || 0) +
        (latest.ob_vitalicio_revenue || 0) +
        (latest.ob_evento_revenue || 0) +
        (latest.contract_revenue || 0);

      const previousRevenue = previous ? 
        (previous.a010_revenue || 0) +
        (previous.ob_construir_revenue || 0) +
        (previous.ob_vitalicio_revenue || 0) +
        (previous.ob_evento_revenue || 0) +
        (previous.contract_revenue || 0) : 0;

      const totalSales = 
        (latest.a010_sales || 0) +
        (latest.ob_construir_sales || 0) +
        (latest.ob_vitalicio_sales || 0) +
        (latest.ob_evento_sales || 0) +
        (latest.contract_sales || 0);

      const previousSales = previous ?
        (previous.a010_sales || 0) +
        (previous.ob_construir_sales || 0) +
        (previous.ob_vitalicio_sales || 0) +
        (previous.ob_evento_sales || 0) +
        (previous.contract_sales || 0) : 0;

      return {
        revenue: {
          value: totalRevenue,
          change: calculateChange(totalRevenue, previousRevenue),
        },
        sales: {
          value: totalSales,
          change: calculateChange(totalSales, previousSales),
        },
        roi: {
          value: latest.roi || 0,
          change: calculateChange(latest.roi || 0, previous?.roi || 0),
        },
        roas: {
          value: latest.roas || 0,
          change: calculateChange(latest.roas || 0, previous?.roas || 0),
        },
        cost: {
          value: latest.total_cost || 0,
          change: calculateChange(latest.total_cost || 0, previous?.total_cost || 0),
        },
        leads: {
          value: latest.stage_01_actual || 0,
          change: calculateChange(latest.stage_01_actual || 0, previous?.stage_01_actual || 0),
        },
      };
    },
  });
};
