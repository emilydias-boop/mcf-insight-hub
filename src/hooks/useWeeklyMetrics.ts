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
  ob_construir_sales: number;
  ob_vitalicio_revenue: number;
  ob_vitalicio_sales: number;
  ob_evento_revenue: number;
  ob_evento_sales: number;
  contract_revenue: number;
  contract_sales: number;
  
  // Clint
  clint_revenue: number;
  incorporador_50k: number;
  ultrameta_clint: number;
  sdr_ia_ig: number;
  
  // Métricas
  roi: number;
  roas: number;
  cpl: number;
  cplr: number;
  
  // Campos calculados
  total_revenue: number;
  real_cost: number;
  operating_profit: number;
  cir: number;
  ultrameta_liquido: number;
  
  // Funil
  stage_01_actual: number;
  stage_01_target: number;
  stage_01_rate: number;
  stage_02_actual: number;
  stage_02_target: number;
  stage_02_rate: number;
  stage_03_actual: number;
  stage_03_target: number;
  stage_03_rate: number;
  stage_04_actual: number;
  stage_04_target: number;
  stage_04_rate: number;
  stage_05_actual: number;
  stage_05_target: number;
  stage_05_rate: number;
  stage_06_actual: number;
  stage_06_target: number;
  stage_06_rate: number;
  stage_07_actual: number;
  stage_07_target: number;
  stage_07_rate: number;
  stage_08_actual: number;
  stage_08_target: number;
  stage_08_rate: number;
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

export const useMetricsSummary = (startDate?: Date, endDate?: Date) => {
  return useQuery({
    queryKey: ['metrics-summary', startDate?.toISOString(), endDate?.toISOString()],
    queryFn: async () => {
      let query = supabase
        .from('weekly_metrics')
        .select('*')
        .order('start_date', { ascending: false });

      if (startDate && endDate) {
        query = query
          .gte('start_date', startDate.toISOString().split('T')[0])
          .lte('end_date', endDate.toISOString().split('T')[0]);
      }

      const { data: metrics, error } = await query;
      
      if (error) throw error;
      if (!metrics || metrics.length === 0) return null;

      // Somar todas as métricas do período
      const latest = metrics.reduce((acc, curr) => ({
        a010_revenue: (acc.a010_revenue || 0) + (curr.a010_revenue || 0),
        a010_sales: (acc.a010_sales || 0) + (curr.a010_sales || 0),
        ob_construir_revenue: (acc.ob_construir_revenue || 0) + (curr.ob_construir_revenue || 0),
        ob_construir_sales: (acc.ob_construir_sales || 0) + (curr.ob_construir_sales || 0),
        ob_vitalicio_revenue: (acc.ob_vitalicio_revenue || 0) + (curr.ob_vitalicio_revenue || 0),
        ob_vitalicio_sales: (acc.ob_vitalicio_sales || 0) + (curr.ob_vitalicio_sales || 0),
        ob_evento_revenue: (acc.ob_evento_revenue || 0) + (curr.ob_evento_revenue || 0),
        ob_evento_sales: (acc.ob_evento_sales || 0) + (curr.ob_evento_sales || 0),
        contract_revenue: (acc.contract_revenue || 0) + (curr.contract_revenue || 0),
        contract_sales: (acc.contract_sales || 0) + (curr.contract_sales || 0),
        total_cost: (acc.total_cost || 0) + (curr.total_cost || 0),
        roi: metrics[0].roi || 0, // Usar ROI mais recente
        roas: metrics[0].roas || 0, // Usar ROAS mais recente
        stage_01_actual: (acc.stage_01_actual || 0) + (curr.stage_01_actual || 0),
      }), {} as any);

      // Buscar período anterior para comparação
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
        ultrameta: latest,
      };
    },
  });
};

export const useEvolutionData = (limit: number = 12) => {
  return useQuery({
    queryKey: ['evolution-data', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('weekly_metrics')
        .select('*')
        .order('start_date', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      
      return data.reverse().map(metric => ({
        periodo: metric.start_date,
        semanaLabel: metric.week_label,
        faturamento: metric.total_revenue || 0,
        custos: metric.total_cost || 0,
        lucro: metric.operating_profit || 0,
        roi: metric.roi || 0,
        roas: metric.roas || 0,
        vendasA010: metric.a010_sales || 0,
        vendasContratos: metric.contract_sales || 0,
        leads: metric.stage_01_actual || 0,
      }));
    },
  });
};

export const useFunnelData = (startDate?: Date, endDate?: Date) => {
  return useQuery({
    queryKey: ['funnel-data', startDate?.toISOString(), endDate?.toISOString()],
    queryFn: async () => {
      let query = supabase
        .from('weekly_metrics')
        .select('*')
        .order('start_date', { ascending: false });

      if (startDate && endDate) {
        query = query
          .gte('start_date', startDate.toISOString().split('T')[0])
          .lte('end_date', endDate.toISOString().split('T')[0]);
      } else {
        query = query.limit(1);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      if (!data || data.length === 0) return null;

      // Somar valores do período
      const totals = data.reduce((acc, curr) => ({
        stage_01_actual: (acc.stage_01_actual || 0) + (curr.stage_01_actual || 0),
        stage_02_actual: (acc.stage_02_actual || 0) + (curr.stage_02_actual || 0),
        stage_03_actual: (acc.stage_03_actual || 0) + (curr.stage_03_actual || 0),
        stage_04_actual: (acc.stage_04_actual || 0) + (curr.stage_04_actual || 0),
        stage_05_actual: (acc.stage_05_actual || 0) + (curr.stage_05_actual || 0),
        stage_06_actual: (acc.stage_06_actual || 0) + (curr.stage_06_actual || 0),
        stage_07_actual: (acc.stage_07_actual || 0) + (curr.stage_07_actual || 0),
        stage_08_actual: (acc.stage_08_actual || 0) + (curr.stage_08_actual || 0),
        stage_01_target: curr.stage_01_target || 0, // Usar meta mais recente
        stage_02_target: curr.stage_02_target || 0,
        stage_03_target: curr.stage_03_target || 0,
        stage_04_target: curr.stage_04_target || 0,
        stage_05_target: curr.stage_05_target || 0,
        stage_06_target: curr.stage_06_target || 0,
        stage_07_target: curr.stage_07_target || 0,
        stage_08_target: curr.stage_08_target || 0,
        stage_01_rate: curr.stage_01_rate || 0, // Usar taxa mais recente
        stage_02_rate: curr.stage_02_rate || 0,
        stage_03_rate: curr.stage_03_rate || 0,
        stage_04_rate: curr.stage_04_rate || 0,
        stage_05_rate: curr.stage_05_rate || 0,
        stage_06_rate: curr.stage_06_rate || 0,
        stage_07_rate: curr.stage_07_rate || 0,
        stage_08_rate: curr.stage_08_rate || 0,
      }), {} as any);

      return totals;
    },
  });
};

export const useFinancialSummary = (startDate?: Date, endDate?: Date) => {
  return useQuery({
    queryKey: ['financial-summary', startDate?.toISOString(), endDate?.toISOString()],
    queryFn: async () => {
      let query = supabase
        .from('weekly_metrics')
        .select('*')
        .order('start_date', { ascending: true });

      if (startDate && endDate) {
        query = query
          .gte('start_date', startDate.toISOString().split('T')[0])
          .lte('end_date', endDate.toISOString().split('T')[0]);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      return data || [];
    },
  });
};
