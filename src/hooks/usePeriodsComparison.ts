import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ComparisonMetric } from "@/types/dashboard";

interface PeriodData {
  inicio: Date;
  fim: Date;
}

interface AggregatedMetrics {
  faturamento: number;
  custos: number;
  lucro: number;
  roi: number;
  roas: number;
  vendasA010: number;
  vendasContratos: number;
  leads: number;
}

export function usePeriodsComparison(periodoA: PeriodData, periodoB: PeriodData) {
  return useQuery({
    queryKey: ['periods-comparison', periodoA, periodoB],
    queryFn: async () => {
      // Buscar métricas do período A
      const { data: dataA, error: errorA } = await supabase
        .from('weekly_metrics')
        .select('*')
        .gte('start_date', periodoA.inicio.toISOString().split('T')[0])
        .lte('end_date', periodoA.fim.toISOString().split('T')[0]);

      if (errorA) throw errorA;

      // Buscar métricas do período B
      const { data: dataB, error: errorB } = await supabase
        .from('weekly_metrics')
        .select('*')
        .gte('start_date', periodoB.inicio.toISOString().split('T')[0])
        .lte('end_date', periodoB.fim.toISOString().split('T')[0]);

      if (errorB) throw errorB;

      // Agregar métricas de cada período
      const metricsA = aggregateMetrics(dataA || []);
      const metricsB = aggregateMetrics(dataB || []);

      // Calcular comparações
      const comparisons: ComparisonMetric[] = [
        createComparison('Faturamento', metricsA.faturamento, metricsB.faturamento, true),
        createComparison('Custos', metricsA.custos, metricsB.custos, false),
        createComparison('Lucro', metricsA.lucro, metricsB.lucro, true),
        createComparison('ROI', metricsA.roi, metricsB.roi, true),
        createComparison('ROAS', metricsA.roas, metricsB.roas, true),
        createComparison('Vendas A010', metricsA.vendasA010, metricsB.vendasA010, true),
        createComparison('Vendas Contratos', metricsA.vendasContratos, metricsB.vendasContratos, true),
        createComparison('Leads', metricsA.leads, metricsB.leads, true),
      ];

      return {
        comparisons,
        metricsA,
        metricsB,
      };
    },
    enabled: !!periodoA && !!periodoB,
  });
}

function aggregateMetrics(data: any[]): AggregatedMetrics {
  if (!data || data.length === 0) {
    return {
      faturamento: 0,
      custos: 0,
      lucro: 0,
      roi: 0,
      roas: 0,
      vendasA010: 0,
      vendasContratos: 0,
      leads: 0,
    };
  }

  const totals = data.reduce((acc, week) => ({
    faturamento: acc.faturamento + (week.total_revenue || 0),
    custos: acc.custos + (week.total_cost || 0),
    vendasA010: acc.vendasA010 + (week.a010_sales || 0),
    vendasContratos: acc.vendasContratos + (week.contract_sales || 0),
    leads: acc.leads + (week.stage_01_actual || 0),
  }), {
    faturamento: 0,
    custos: 0,
    vendasA010: 0,
    vendasContratos: 0,
    leads: 0,
  });

  const lucro = totals.faturamento - totals.custos;
  const roi = totals.custos > 0 ? (lucro / totals.custos) * 100 : 0;
  const roas = totals.custos > 0 ? totals.faturamento / totals.custos : 0;

  return {
    faturamento: totals.faturamento,
    custos: totals.custos,
    lucro,
    roi,
    roas,
    vendasA010: totals.vendasA010,
    vendasContratos: totals.vendasContratos,
    leads: totals.leads,
  };
}

function createComparison(
  name: string,
  periodA: number,
  periodB: number,
  isPositive: boolean
): ComparisonMetric {
  const diff = periodB - periodA;
  const diffPercent = periodA !== 0 ? (diff / periodA) * 100 : 0;
  
  return {
    name,
    periodA,
    periodB,
    diff,
    diffPercent,
    isPositive: isPositive ? diff >= 0 : diff <= 0,
  };
}
