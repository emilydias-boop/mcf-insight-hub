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
  leads: number;
}

export function useDirectorKPIs(startDate?: Date, endDate?: Date) {
  return useQuery({
    queryKey: ['director-kpis', startDate?.toISOString(), endDate?.toISOString()],
    queryFn: async (): Promise<DirectorKPIs> => {
      const start = startDate ? format(startDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');
      const end = endDate ? format(endDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');

      // Buscar faturamento total (Hubla transactions)
      const { data: hublaData } = await supabase
        .from('hubla_transactions')
        .select('net_value, sale_date')
        .eq('sale_status', 'completed')
        .gte('sale_date', start)
        .lte('sale_date', end);

      const faturamentoTotal = hublaData?.reduce((sum, t) => sum + (t.net_value || 0), 0) || 0;

      // Buscar gastos com ads
      const { data: adsData } = await supabase
        .from('daily_costs')
        .select('amount, date')
        .eq('cost_type', 'ads')
        .gte('date', start)
        .lte('date', end);

      const gastosAds = adsData?.reduce((sum, c) => sum + (c.amount || 0), 0) || 0;

      // Buscar custos operacionais
      const monthStr = format(startDate || new Date(), 'yyyy-MM');
      const { data: operationalData } = await supabase
        .from('operational_costs')
        .select('amount')
        .eq('month', monthStr);

      const custosOperacionais = operationalData?.reduce((sum, c) => sum + (c.amount || 0), 0) || 0;

      // Buscar leads (deal_activities com stage Novo Lead)
      const { data: leadsData } = await supabase
        .from('deal_activities')
        .select('deal_id')
        .eq('to_stage', 'cf4a369c-c4a6-4299-933d-5ae3dcc39d4b') // Novo Lead UUID
        .gte('created_at', start)
        .lte('created_at', end + 'T23:59:59');

      const uniqueLeads = new Set(leadsData?.map(l => l.deal_id) || []);
      const leadsCount = uniqueLeads.size;

      // Calcular métricas
      const custoTotal = gastosAds + custosOperacionais;
      const lucro = faturamentoTotal - custoTotal;
      const roi = custoTotal > 0 ? (lucro / custoTotal) * 100 : 0;
      const roas = gastosAds > 0 ? faturamentoTotal / gastosAds : 0;
      const cpl = leadsCount > 0 ? gastosAds / leadsCount : 0;

      // Calcular período anterior para comparação (mesmo número de dias antes)
      const daysDiff = startDate && endDate 
        ? Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
        : 7;
      
      const prevEnd = new Date(startDate || new Date());
      prevEnd.setDate(prevEnd.getDate() - 1);
      const prevStart = new Date(prevEnd);
      prevStart.setDate(prevStart.getDate() - daysDiff + 1);

      const prevStartStr = format(prevStart, 'yyyy-MM-dd');
      const prevEndStr = format(prevEnd, 'yyyy-MM-dd');

      // Buscar dados do período anterior
      const { data: prevHubla } = await supabase
        .from('hubla_transactions')
        .select('net_value')
        .eq('sale_status', 'completed')
        .gte('sale_date', prevStartStr)
        .lte('sale_date', prevEndStr);

      const prevFaturamento = prevHubla?.reduce((sum, t) => sum + (t.net_value || 0), 0) || 0;

      const { data: prevAds } = await supabase
        .from('daily_costs')
        .select('amount')
        .eq('cost_type', 'ads')
        .gte('date', prevStartStr)
        .lte('date', prevEndStr);

      const prevGastosAds = prevAds?.reduce((sum, c) => sum + (c.amount || 0), 0) || 0;

      const { data: prevLeads } = await supabase
        .from('deal_activities')
        .select('deal_id')
        .eq('to_stage', 'cf4a369c-c4a6-4299-933d-5ae3dcc39d4b')
        .gte('created_at', prevStartStr)
        .lte('created_at', prevEndStr + 'T23:59:59');

      const prevUniqueLeads = new Set(prevLeads?.map(l => l.deal_id) || []);
      const prevLeadsCount = prevUniqueLeads.size;

      const prevCustoTotal = prevGastosAds + custosOperacionais;
      const prevLucro = prevFaturamento - prevCustoTotal;
      const prevRoi = prevCustoTotal > 0 ? (prevLucro / prevCustoTotal) * 100 : 0;
      const prevRoas = prevGastosAds > 0 ? prevFaturamento / prevGastosAds : 0;
      const prevCpl = prevLeadsCount > 0 ? prevGastosAds / prevLeadsCount : 0;

      // Calcular variações percentuais
      const calcChange = (current: number, previous: number) => {
        if (previous === 0) return current > 0 ? 100 : 0;
        return ((current - previous) / previous) * 100;
      };

      return {
        faturamentoTotal: {
          value: faturamentoTotal,
          change: calcChange(faturamentoTotal, prevFaturamento),
          isPositive: faturamentoTotal >= prevFaturamento,
        },
        gastosAds: {
          value: gastosAds,
          change: calcChange(gastosAds, prevGastosAds),
          isPositive: gastosAds <= prevGastosAds, // Menor gasto é positivo
        },
        cpl: {
          value: cpl,
          change: calcChange(cpl, prevCpl),
          isPositive: cpl <= prevCpl, // Menor CPL é positivo
        },
        custoTotal: {
          value: custoTotal,
          change: calcChange(custoTotal, prevCustoTotal),
          isPositive: custoTotal <= prevCustoTotal, // Menor custo é positivo
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
        leads: leadsCount,
      };
    },
    refetchInterval: 60000,
  });
}
