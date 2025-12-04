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
}

// Produtos do Incorporador 50k (A005 EXCLUÍDO)
const INCORPORADOR_PRODUCTS = ['A000', 'A001', 'A003', 'A009'];
const EXCLUDED_PRODUCT_NAMES = ['A005', 'A006', 'A010', 'IMERSÃO SÓCIOS', 'IMERSAO SOCIOS', 'EFEITO ALAVANCA', 'CLUBE DO ARREMATE', 'CLUBE ARREMATE'];

// Função para extrair base_id (remove -offer-N e newsale- prefixos)
const getBaseId = (hublaId: string): string => {
  return hublaId
    .replace(/^newsale-/, '')
    .replace(/-offer-\d+$/, '');
};

export function useDirectorKPIs(startDate?: Date, endDate?: Date) {
  return useQuery({
    queryKey: ['director-kpis', startDate?.toISOString(), endDate?.toISOString()],
    queryFn: async (): Promise<DirectorKPIs> => {
      const start = startDate ? format(startDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');
      const end = endDate ? format(endDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');

      // Buscar todas as transações Hubla no período
      const { data: hublaData } = await supabase
        .from('hubla_transactions')
        .select('hubla_id, product_name, product_category, net_value, sale_date, installment_number, customer_name, customer_email, raw_data')
        .eq('sale_status', 'completed')
        .gte('sale_date', start)
        .lte('sale_date', end + 'T23:59:59');

      // ===== FATURAMENTO INCORPORADOR (Líquido) =====
      const seenIncorporadorIds = new Set<string>();
      const faturamentoIncorporador = (hublaData || [])
        .filter(tx => {
          const productName = (tx.product_name || '').toUpperCase();
          const isIncorporador = INCORPORADOR_PRODUCTS.some(code => productName.startsWith(code));
          const isExcluded = EXCLUDED_PRODUCT_NAMES.some(name => productName.includes(name.toUpperCase()));
          if (seenIncorporadorIds.has(tx.hubla_id)) return false;
          if (isIncorporador && !isExcluded) {
            seenIncorporadorIds.add(tx.hubla_id);
            return true;
          }
          return false;
        })
        .reduce((sum, tx) => sum + (tx.net_value || 0), 0);

      // ===== OB ACESSO VITALÍCIO =====
      const obVitalicio = (hublaData || [])
        .filter(tx => {
          const productName = (tx.product_name || '').toUpperCase();
          return productName.includes('VITALÍCIO') || productName.includes('VITALICIO');
        })
        .reduce((sum, tx) => sum + (tx.net_value || 0), 0);

      // ===== OB CONSTRUIR PARA ALUGAR =====
      const obConstruir = (hublaData || [])
        .filter(tx => {
          const productName = (tx.product_name || '').toUpperCase();
          return productName.includes('CONSTRUIR') && productName.includes('ALUGAR');
        })
        .reduce((sum, tx) => sum + (tx.net_value || 0), 0);

      // ===== FATURADO A010 =====
      const seenA010Ids = new Set<string>();
      const faturadoA010 = (hublaData || [])
        .filter(tx => {
          const productName = (tx.product_name || '').toUpperCase();
          const isA010 = tx.product_category === 'a010' || productName.includes('A010');
          if (seenA010Ids.has(tx.hubla_id)) return false;
          if (isA010) {
            seenA010Ids.add(tx.hubla_id);
            return true;
          }
          return false;
        })
        .reduce((sum, tx) => sum + (tx.net_value || 0), 0);

      // ===== FATURAMENTO TOTAL =====
      const faturamentoTotal = faturamentoIncorporador + obVitalicio + obConstruir + faturadoA010;

      // ===== VENDAS A010 (deduplicação por base_id para chegar em 180) =====
      const seenA010BaseIds = new Set<string>();
      const vendasA010 = (hublaData || []).filter(tx => {
        const productName = (tx.product_name || '').toUpperCase();
        const isA010 = tx.product_category === 'a010' || productName.includes('A010');
        const hasValidName = tx.customer_name && tx.customer_name.trim() !== '';
        const isFirstInstallment = !tx.installment_number || tx.installment_number === 1;
        
        if (!isA010 || !hasValidName || !isFirstInstallment) return false;
        
        // Deduplicar por base_id (remove -offer-N e newsale- prefixos)
        const baseId = getBaseId(tx.hubla_id);
        if (seenA010BaseIds.has(baseId)) return false;
        seenA010BaseIds.add(baseId);
        
        return true;
      }).length;

      // ===== GASTOS ADS =====
      const { data: adsData } = await supabase
        .from('daily_costs')
        .select('amount')
        .eq('cost_type', 'ads')
        .gte('date', start)
        .lte('date', end);

      const gastosAds = adsData?.reduce((sum, c) => sum + (c.amount || 0), 0) || 0;

      // ===== CUSTOS OPERACIONAIS (equipe + escritório) =====
      const monthStr = format(startDate || new Date(), 'yyyy-MM');
      const { data: operationalData } = await supabase
        .from('operational_costs')
        .select('amount, cost_type')
        .eq('month', monthStr);

      const custoEquipe = operationalData?.filter(c => c.cost_type === 'team').reduce((sum, c) => sum + (c.amount || 0), 0) || 0;
      const custoEscritorio = operationalData?.filter(c => c.cost_type === 'office').reduce((sum, c) => sum + (c.amount || 0), 0) || 0;
      
      // Custo operacional semanal = (equipe + escritório) / 4 semanas
      const custoOperacionalSemanal = (custoEquipe + custoEscritorio) / 4;

      // ===== CÁLCULOS FINAIS =====
      // CPL = Ads / Vendas A010
      const cpl = vendasA010 > 0 ? gastosAds / vendasA010 : 0;

      // Custo Total = Ads + Custo Operacional Semanal
      const custoTotal = gastosAds + custoOperacionalSemanal;

      // Lucro = Faturamento Total - Custo Total
      const lucro = faturamentoTotal - custoTotal;

      // ROI = Faturamento Incorporador / Custo Total (em %)
      const roi = custoTotal > 0 ? (faturamentoIncorporador / custoTotal) : 0;

      // ROAS = Custo Total / Faturamento Incorporador
      const roas = faturamentoIncorporador > 0 ? (custoTotal / faturamentoIncorporador) : 0;

      // ===== PERÍODO ANTERIOR PARA COMPARAÇÃO =====
      const daysDiff = startDate && endDate 
        ? Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
        : 7;
      
      const prevEnd = new Date(startDate || new Date());
      prevEnd.setDate(prevEnd.getDate() - 1);
      const prevStart = new Date(prevEnd);
      prevStart.setDate(prevStart.getDate() - daysDiff + 1);

      const prevStartStr = format(prevStart, 'yyyy-MM-dd');
      const prevEndStr = format(prevEnd, 'yyyy-MM-dd');

      // Buscar dados anteriores para comparação
      const { data: prevHubla } = await supabase
        .from('hubla_transactions')
        .select('hubla_id, product_name, product_category, net_value, installment_number, customer_name, customer_email, raw_data')
        .eq('sale_status', 'completed')
        .gte('sale_date', prevStartStr)
        .lte('sale_date', prevEndStr + 'T23:59:59');

      // Calcular métricas anteriores
      const prevSeenIncIds = new Set<string>();
      const prevFatIncorporador = (prevHubla || [])
        .filter(tx => {
          const productName = (tx.product_name || '').toUpperCase();
          const isIncorporador = INCORPORADOR_PRODUCTS.some(code => productName.startsWith(code));
          const isExcluded = EXCLUDED_PRODUCT_NAMES.some(name => productName.includes(name.toUpperCase()));
          if (prevSeenIncIds.has(tx.hubla_id)) return false;
          if (isIncorporador && !isExcluded) {
            prevSeenIncIds.add(tx.hubla_id);
            return true;
          }
          return false;
        })
        .reduce((sum, tx) => sum + (tx.net_value || 0), 0);

      const prevObVitalicio = (prevHubla || [])
        .filter(tx => (tx.product_name || '').toUpperCase().includes('VITALÍCIO') || (tx.product_name || '').toUpperCase().includes('VITALICIO'))
        .reduce((sum, tx) => sum + (tx.net_value || 0), 0);

      const prevObConstruir = (prevHubla || [])
        .filter(tx => {
          const name = (tx.product_name || '').toUpperCase();
          return name.includes('CONSTRUIR') && name.includes('ALUGAR');
        })
        .reduce((sum, tx) => sum + (tx.net_value || 0), 0);

      const prevSeenA010Ids = new Set<string>();
      const prevFatA010 = (prevHubla || [])
        .filter(tx => {
          const productName = (tx.product_name || '').toUpperCase();
          const isA010 = tx.product_category === 'a010' || productName.includes('A010');
          if (prevSeenA010Ids.has(tx.hubla_id)) return false;
          if (isA010) {
            prevSeenA010Ids.add(tx.hubla_id);
            return true;
          }
          return false;
        })
        .reduce((sum, tx) => sum + (tx.net_value || 0), 0);

      const prevFaturamentoTotal = prevFatIncorporador + prevObVitalicio + prevObConstruir + prevFatA010;

      // Vendas A010 período anterior com mesma lógica de deduplicação
      const prevSeenA010BaseIds = new Set<string>();
      const prevVendasA010 = (prevHubla || []).filter(tx => {
        const productName = (tx.product_name || '').toUpperCase();
        const isA010 = tx.product_category === 'a010' || productName.includes('A010');
        const hasValidName = tx.customer_name && tx.customer_name.trim() !== '';
        const isFirstInstallment = !tx.installment_number || tx.installment_number === 1;
        
        if (!isA010 || !hasValidName || !isFirstInstallment) return false;
        
        const baseId = getBaseId(tx.hubla_id);
        if (prevSeenA010BaseIds.has(baseId)) return false;
        prevSeenA010BaseIds.add(baseId);
        
        return true;
      }).length;

      const { data: prevAds } = await supabase
        .from('daily_costs')
        .select('amount')
        .eq('cost_type', 'ads')
        .gte('date', prevStartStr)
        .lte('date', prevEndStr);

      const prevGastosAds = prevAds?.reduce((sum, c) => sum + (c.amount || 0), 0) || 0;
      const prevCustoTotal = prevGastosAds + custoOperacionalSemanal;
      const prevCpl = prevVendasA010 > 0 ? prevGastosAds / prevVendasA010 : 0;
      const prevLucro = prevFaturamentoTotal - prevCustoTotal;
      const prevRoi = prevCustoTotal > 0 ? (prevFatIncorporador / prevCustoTotal) : 0;
      const prevRoas = prevFatIncorporador > 0 ? (prevCustoTotal / prevFatIncorporador) : 0;

      // Calcular variações
      const calcChange = (current: number, previous: number) => {
        if (previous === 0) return current > 0 ? 100 : 0;
        return ((current - previous) / previous) * 100;
      };

      return {
        faturamentoTotal: {
          value: faturamentoTotal,
          change: calcChange(faturamentoTotal, prevFaturamentoTotal),
          isPositive: faturamentoTotal >= prevFaturamentoTotal,
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
          isPositive: roas <= prevRoas,
        },
        vendasA010,
        faturamentoIncorporador,
      };
    },
    refetchInterval: 30000,
  });
}
