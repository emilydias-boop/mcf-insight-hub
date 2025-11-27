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
  total_cost?: number; // deprecated
  operating_cost: number | null;
  real_cost: number | null;
  
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
  clint_revenue: number;
  incorporador_50k: number;
  
  // Totais calculados
  total_revenue: number | null;
  operating_profit: number | null;
  
  // Métricas
  roi: number | null;
  roas: number | null;
  cpl: number | null;
  cplr: number | null;
  cir: number | null;
  
  // Ultrametas
  ultrameta_clint: number | null;
  ultrameta_liquido: number | null;
  
  // SDR
  sdr_ia_ig: number;
  
  // Funil
  stage_01_target: number | null;
  stage_01_actual: number | null;
  stage_01_rate: number | null;
  stage_02_target: number | null;
  stage_02_actual: number | null;
  stage_02_rate: number | null;
  stage_03_target: number | null;
  stage_03_actual: number | null;
  stage_03_rate: number | null;
  stage_04_target: number | null;
  stage_04_actual: number | null;
  stage_04_rate: number | null;
  stage_05_target: number | null;
  stage_05_actual: number | null;
  stage_05_rate: number | null;
  stage_06_target: number | null;
  stage_06_actual: number | null;
  stage_06_rate: number | null;
  stage_07_target: number | null;
  stage_07_actual: number | null;
  stage_07_rate: number | null;
  stage_08_target: number | null;
  stage_08_actual: number | null;
  stage_08_rate: number | null;
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
        .single();
      
      if (error) throw error;
      return data as WeeklyMetric;
    },
  });
};

export const useMetricsSummary = (startDate?: Date, endDate?: Date, canal?: string) => {
  return useQuery({
    queryKey: ['metrics-summary', startDate?.toISOString(), endDate?.toISOString(), canal],
    queryFn: async () => {
      // Buscar semanas dentro do período
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
      if (!data || data.length === 0) {
        return {
          revenue: { value: 0, change: 0 },
          sales: { value: 0, change: 0 },
          roi: { value: 0, change: 0 },
          roas: { value: 0, change: 0 },
          cost: { value: 0, change: 0 },
          leads: { value: 0, change: 0 },
        };
      }

      // Agregar dados do período atual
      let totalRevenue = 0;
      let totalSales = 0;
      let totalCost = 0;
      let totalLeads = 0;
      let avgRoi = 0;
      let totalAdsForRoas = 0;

      data.forEach(week => {
        if (canal === 'todos' || !canal) {
          totalRevenue += week.total_revenue || 0;
          totalSales += (week.a010_sales || 0) + (week.contract_sales || 0);
        } else if (canal === 'a010') {
          totalRevenue += week.a010_revenue || 0;
          totalSales += week.a010_sales || 0;
        } else if (canal === 'instagram') {
          // Instagram não tem revenue direto, usar leads
          totalLeads += week.stage_01_actual || 0;
        } else if (canal === 'contratos') {
          totalRevenue += week.contract_revenue || 0;
          totalSales += week.contract_sales || 0;
        }
        // Usar operating_cost em vez de total_cost
        totalCost += week.operating_cost || week.total_cost || 0;
        totalLeads += week.stage_01_actual || 0;
        avgRoi += week.roi || 0;
        totalAdsForRoas += week.ads_cost || 0;
      });

      avgRoi = data.length > 0 ? avgRoi / data.length : 0;
      const calculatedRoas = totalAdsForRoas > 0 ? totalRevenue / totalAdsForRoas : 0;

      const calcChange = (current: number, previous: number) => {
        if (previous === 0) return current > 0 ? 100 : 0;
        return ((current - previous) / previous) * 100;
      };

      // Variáveis para armazenar valores anteriores
      let revenueChange = 0;
      let salesChange = 0;
      let roiChange = 0;
      let roasChange = 0;
      let costChange = 0;
      let leadsChange = 0;

      // Se tem poucos dados (1-2 semanas), buscar período anterior para comparação
      if (data.length <= 2) {
        // Calcular duração do período em dias
        const periodDays = startDate && endDate 
          ? Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
          : 7;
        
        // Calcular período anterior (mesma duração, antes do início)
        const previousEndDate = startDate 
          ? new Date(startDate.getTime() - (1000 * 60 * 60 * 24)) // dia antes do início
          : new Date();
        const previousStartDate = new Date(previousEndDate.getTime() - (periodDays * 1000 * 60 * 60 * 24));
        
        // Buscar dados do período anterior
        const { data: previousData } = await supabase
          .from('weekly_metrics')
          .select('*')
          .gte('start_date', previousStartDate.toISOString().split('T')[0])
          .lte('end_date', previousEndDate.toISOString().split('T')[0])
          .order('start_date', { ascending: false });
        
        if (previousData && previousData.length > 0) {
          let previousRevenue = 0;
          let previousSales = 0;
          let previousCost = 0;
          let previousLeads = 0;
          let previousRoi = 0;
          let previousAdsForRoas = 0;

          previousData.forEach(week => {
            if (canal === 'todos' || !canal) {
              previousRevenue += week.total_revenue || 0;
              previousSales += (week.a010_sales || 0) + (week.contract_sales || 0);
            } else if (canal === 'a010') {
              previousRevenue += week.a010_revenue || 0;
              previousSales += week.a010_sales || 0;
            } else if (canal === 'instagram') {
              previousLeads += week.stage_01_actual || 0;
            } else if (canal === 'contratos') {
              previousRevenue += week.contract_revenue || 0;
              previousSales += week.contract_sales || 0;
            }
            previousCost += week.operating_cost || week.total_cost || 0;
            previousLeads += week.stage_01_actual || 0;
            previousRoi += week.roi || 0;
            previousAdsForRoas += week.ads_cost || 0;
          });

          const previousAvgRoi = previousData.length > 0 ? previousRoi / previousData.length : 0;
          const previousCalculatedRoas = previousAdsForRoas > 0 ? previousRevenue / previousAdsForRoas : 0;

          // Calcular variações
          revenueChange = calcChange(totalRevenue, previousRevenue);
          salesChange = calcChange(totalSales, previousSales);
          costChange = calcChange(totalCost, previousCost);
          leadsChange = calcChange(totalLeads, previousLeads);
          roiChange = calcChange(avgRoi, previousAvgRoi);
          roasChange = calcChange(calculatedRoas, previousCalculatedRoas);
        }
      } else {
        // Comparar primeira metade vs segunda metade (comportamento original para múltiplas semanas)
        const halfPoint = Math.floor(data.length / 2);
        const recentHalf = data.slice(0, halfPoint);
        const olderHalf = data.slice(halfPoint);

        const recentRevenue = recentHalf.length > 0 
          ? recentHalf.reduce((sum, w) => sum + (w.total_revenue || 0), 0) / recentHalf.length 
          : 0;
        const olderRevenue = olderHalf.length > 0 
          ? olderHalf.reduce((sum, w) => sum + (w.total_revenue || 0), 0) / olderHalf.length 
          : 0;
        
        const recentSales = recentHalf.length > 0 
          ? recentHalf.reduce((sum, w) => sum + ((w.a010_sales || 0) + (w.contract_sales || 0)), 0) / recentHalf.length 
          : 0;
        const olderSales = olderHalf.length > 0 
          ? olderHalf.reduce((sum, w) => sum + ((w.a010_sales || 0) + (w.contract_sales || 0)), 0) / olderHalf.length 
          : 0;

        const recentCost = recentHalf.length > 0 
          ? recentHalf.reduce((sum, w) => sum + (w.operating_cost || w.total_cost || 0), 0) / recentHalf.length 
          : 0;
        const olderCost = olderHalf.length > 0 
          ? olderHalf.reduce((sum, w) => sum + (w.operating_cost || w.total_cost || 0), 0) / olderHalf.length 
          : 0;

        const recentLeads = recentHalf.length > 0 
          ? recentHalf.reduce((sum, w) => sum + (w.stage_01_actual || 0), 0) / recentHalf.length 
          : 0;
        const olderLeads = olderHalf.length > 0 
          ? olderHalf.reduce((sum, w) => sum + (w.stage_01_actual || 0), 0) / olderHalf.length 
          : 0;

        const recentRoi = recentHalf.length > 0 
          ? recentHalf.reduce((sum, w) => sum + (w.roi || 0), 0) / recentHalf.length 
          : 0;
        const olderRoi = olderHalf.length > 0 
          ? olderHalf.reduce((sum, w) => sum + (w.roi || 0), 0) / olderHalf.length 
          : 0;

        const recentAds = recentHalf.reduce((sum, w) => sum + (w.ads_cost || 0), 0);
        const recentRevHalf = recentHalf.reduce((sum, w) => sum + (w.total_revenue || 0), 0);
        const recentRoas = recentAds > 0 ? recentRevHalf / recentAds : 0;

        const olderAds = olderHalf.reduce((sum, w) => sum + (w.ads_cost || 0), 0);
        const olderRevHalf = olderHalf.reduce((sum, w) => sum + (w.total_revenue || 0), 0);
        const olderRoas = olderAds > 0 ? olderRevHalf / olderAds : 0;

        revenueChange = calcChange(recentRevenue, olderRevenue);
        salesChange = calcChange(recentSales, olderSales);
        costChange = calcChange(recentCost, olderCost);
        leadsChange = calcChange(recentLeads, olderLeads);
        roiChange = calcChange(recentRoi, olderRoi);
        roasChange = calcChange(recentRoas, olderRoas);
      }

      return {
        revenue: { 
          value: totalRevenue, 
          change: revenueChange 
        },
        sales: { 
          value: totalSales, 
          change: salesChange 
        },
        roi: { 
          value: avgRoi, 
          change: roiChange 
        },
        roas: { 
          value: calculatedRoas, 
          change: roasChange 
        },
        cost: { 
          value: totalCost, 
          change: costChange 
        },
        leads: { 
          value: totalLeads, 
          change: leadsChange 
        },
      };
    },
  });
};

// Hook para buscar resumo semanal para o componente ResumoFinanceiro
export const useWeeklyResumo = (limit?: number, startDate?: Date, endDate?: Date, canal?: string) => {
  return useQuery({
    queryKey: ['weekly-resumo', limit, startDate?.toISOString(), endDate?.toISOString(), canal],
    queryFn: async () => {
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
      
      // Só aplica limit se for passado
      if (limit) {
        query = query.limit(limit);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;

      // Mapear para o formato SemanaMes, filtrando por canal se necessário
      return data.map((week) => {
        let faturamentoA010 = week.a010_revenue || 0;
        let vendasA010 = week.a010_sales || 0;
        let faturamentoContrato = week.contract_revenue || 0;
        let vendasContratos = week.contract_sales || 0;

        if (canal === 'a010') {
          faturamentoContrato = 0;
          vendasContratos = 0;
        } else if (canal === 'contratos') {
          faturamentoA010 = 0;
          vendasA010 = 0;
        } else if (canal === 'instagram') {
          // Instagram não tem faturamento direto nessa tabela
          faturamentoA010 = 0;
          vendasA010 = 0;
          faturamentoContrato = 0;
          vendasContratos = 0;
        }

        return {
          dataInicio: new Date(week.start_date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }),
          dataFim: new Date(week.end_date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }),
          faturamentoA010,
          vendasA010,
          valorVendidoOBEvento: canal === 'todos' || !canal ? (week.ob_evento_revenue || 0) : 0,
          vendasOBEvento: canal === 'todos' || !canal ? (week.ob_evento_sales || 0) : 0,
          faturamentoContrato,
          vendasContratos,
          faturamentoOBConstruir: canal === 'todos' || !canal ? (week.ob_construir_revenue || 0) : 0,
          vendasOBConstruir: canal === 'todos' || !canal ? (week.ob_construir_sales || 0) : 0,
          faturamentoOBVitalicio: canal === 'todos' || !canal ? (week.ob_vitalicio_revenue || 0) : 0,
          vendasOBVitalicio: canal === 'todos' || !canal ? (week.ob_vitalicio_sales || 0) : 0,
        };
      });
    },
  });
};
