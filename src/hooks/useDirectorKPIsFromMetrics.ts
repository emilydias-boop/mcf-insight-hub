import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface DirectorKPI {
  value: number;
  change: number;
  isPositive: boolean;
}

interface DirectorKPIs {
  faturamentoTotal: DirectorKPI;
  gastosAds: DirectorKPI;
  cpl: DirectorKPI;
  custoTotal: DirectorKPI;
  lucro: DirectorKPI;
  roi: DirectorKPI;
  roas: DirectorKPI;
  vendasA010: number;
  faturamentoIncorporador: number;
  // Novos campos para Metas
  ultrametaClint: number;
  faturamentoClint: number;
  ultrametaLiquido: number;
  faturamentoLiquido: number;
}

export function useDirectorKPIsFromMetrics(startDate?: Date, endDate?: Date) {
  return useQuery({
    queryKey: ['director-kpis-metrics', startDate?.toISOString(), endDate?.toISOString()],
    queryFn: async (): Promise<DirectorKPIs> => {
      const start = startDate ? format(startDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');
      const end = endDate ? format(endDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');

      // Buscar métricas da semana selecionada
      const { data: currentMetrics, error } = await supabase
        .from('weekly_metrics')
        .select('*')
        .eq('start_date', start)
        .eq('end_date', end)
        .maybeSingle();

      if (error) throw error;

      // Se não encontrar métricas exatas, buscar por range
      let metrics = currentMetrics;
      if (!metrics) {
        const { data: rangeMetrics } = await supabase
          .from('weekly_metrics')
          .select('*')
          .gte('start_date', start)
          .lte('end_date', end)
          .order('start_date', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        metrics = rangeMetrics;
      }

      if (!metrics) {
        // Retornar valores zerados se não encontrar métricas
        return {
          faturamentoTotal: { value: 0, change: 0, isPositive: true },
          gastosAds: { value: 0, change: 0, isPositive: true },
          cpl: { value: 0, change: 0, isPositive: true },
          custoTotal: { value: 0, change: 0, isPositive: true },
          lucro: { value: 0, change: 0, isPositive: true },
          roi: { value: 0, change: 0, isPositive: true },
          roas: { value: 0, change: 0, isPositive: true },
          vendasA010: 0,
          faturamentoIncorporador: 0,
          ultrametaClint: 0,
          faturamentoClint: 0,
          ultrametaLiquido: 0,
          faturamentoLiquido: 0,
        };
      }

      // Extrair valores das métricas pré-calculadas (priorizar dados da planilha importada)
      const faturamentoTotal = metrics.total_revenue || metrics.faturamento_total || 0;
      const gastosAds = metrics.ads_cost || 0;
      const cpl = metrics.cpl || 0;
      const custoTotal = metrics.total_cost || metrics.operating_cost || 0;
      const lucro = metrics.operating_profit || (faturamentoTotal - custoTotal);
      const roi = metrics.roi || 0;
      const roas = metrics.roas || 0;
      const vendasA010 = metrics.a010_sales || 0;
      const faturamentoIncorporador = metrics.incorporador_50k || 0;
      const ultrametaClint = metrics.ultrameta_clint || 0;
      const faturamentoClint = metrics.clint_revenue || metrics.faturamento_clint || 0;
      const ultrametaLiquido = metrics.ultrameta_liquido || 0;
      const faturamentoLiquido = metrics.incorporador_50k || 0;

      // Buscar métricas do período anterior para comparação
      const daysDiff = startDate && endDate 
        ? Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
        : 7;
      
      const prevEnd = new Date(startDate || new Date());
      prevEnd.setDate(prevEnd.getDate() - 1);
      const prevStart = new Date(prevEnd);
      prevStart.setDate(prevStart.getDate() - daysDiff + 1);

      const prevStartStr = format(prevStart, 'yyyy-MM-dd');
      const prevEndStr = format(prevEnd, 'yyyy-MM-dd');

      const { data: prevMetrics } = await supabase
        .from('weekly_metrics')
        .select('*')
        .eq('start_date', prevStartStr)
        .eq('end_date', prevEndStr)
        .maybeSingle();

      // Calcular variações
      const calcChange = (current: number, previous: number) => {
        if (previous === 0) return current > 0 ? 100 : 0;
        return ((current - previous) / previous) * 100;
      };

      const prevFatTotal = prevMetrics?.total_revenue || prevMetrics?.faturamento_total || 0;
      const prevGastosAds = prevMetrics?.ads_cost || 0;
      const prevCpl = prevMetrics?.cpl || 0;
      const prevCustoTotal = prevMetrics?.total_cost || prevMetrics?.operating_cost || 0;
      const prevLucro = prevMetrics?.operating_profit || (prevFatTotal - prevCustoTotal);
      const prevRoi = prevMetrics?.roi || 0;
      const prevRoas = prevMetrics?.roas || 0;

      return {
        faturamentoTotal: {
          value: faturamentoTotal,
          change: calcChange(faturamentoTotal, prevFatTotal),
          isPositive: faturamentoTotal >= prevFatTotal,
        },
        gastosAds: {
          value: gastosAds,
          change: calcChange(gastosAds, prevGastosAds),
          isPositive: gastosAds <= prevGastosAds,
        },
        cpl: {
          value: cpl,
          change: calcChange(cpl, prevCpl),
          isPositive: cpl <= prevCpl,
        },
        custoTotal: {
          value: custoTotal,
          change: calcChange(custoTotal, prevCustoTotal),
          isPositive: custoTotal <= prevCustoTotal,
        },
        lucro: {
          value: lucro,
          change: calcChange(lucro, prevLucro),
          isPositive: lucro >= prevLucro,
        },
        roi: {
          value: roi,
          change: calcChange(roi, prevRoi),
          isPositive: roi >= prevRoi,
        },
        roas: {
          value: roas,
          change: calcChange(roas, prevRoas),
          isPositive: roas >= prevRoas,
        },
        vendasA010,
        faturamentoIncorporador,
        ultrametaClint,
        faturamentoClint,
        ultrametaLiquido,
        faturamentoLiquido,
      };
    },
    refetchInterval: 30000,
  });
}
