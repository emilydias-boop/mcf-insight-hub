import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth } from "date-fns";

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
  // Campos Ultrameta para tempo real
  ultrametaClint: number;
  faturamentoClint: number;
  ultrametaLiquido: number;
  faturamentoLiquido: number;
}

// Produtos do Incorporador 50k (validados contra planilha)
// A005 (P2) EXCLUÍDO conforme regras de negócio
const INCORPORADOR_PRODUCTS = ['A000', 'A001', 'A003', 'A009'];
const EXCLUDED_PRODUCT_NAMES = ['A005', 'A006', 'A010', 'IMERSÃO SÓCIOS', 'IMERSAO SOCIOS', 'EFEITO ALAVANCA', 'CLUBE DO ARREMATE', 'CLUBE ARREMATE'];

// Lista EXATA de 34 produtos para Faturamento Total (conforme planilha do usuário)
const FATURAMENTO_TOTAL_PRODUCTS_EXACT = [
  '000 - Pré Reserva Minha Casa Financiada',
  '000 - Contrato',
  '001- Pré-Reserva Anticrise',
  '003 - Imersão SÓCIOS MCF',
  '016-Análise e defesa de proposta de crédito',
  'A000 - Contrato',
  'A000 - Pré-Reserva Plano Anticrise',
  'A001 - MCF INCORPORADOR COMPLETO',
  'A002 - MCF INCORPORADOR BÁSICO',
  'A003 - MCF Incorporador - P2',
  'A003 - MCF Plano Anticrise Completo',
  'A004 - MCF INCORPORADOR BÁSICO',
  'A004 - MCF Plano Anticrise Básico',
  'A005 - Anticrise Completo',
  'A005 - MCF P2',
  'A005 - MCF P2 - ASAAS',
  'A006 - Anticrise Básico',
  'A007 - Imersão SÓCIOS MCF',
  'A008 - The CLUB',
  'A008 - The CLUB - CONSULTORIA CLUB',
  'A009 - MCF INCORPORADOR COMPLETO + THE CLUB',
  'A009 - Renovação Parceiro MCF',
  'ASAAS',
  'COBRANÇAS ASAAS',
  'CONTRATO ANTICRISE',
  'Contrato - Anticrise',
  'Jantar Networking',
  'R001 - Incorporador Completo 50K',
  'R004 - Incorporador 50k Básico',
  'R005 - Anticrise Completo',
  'R006 - Anticrise Básico',
  'R009 - Renovação Parceiro MCF',
  'R21- MCF Incorporador P2 (Assinatura)',
  'Sócio Jantar'
];

export function useDirectorKPIs(startDate?: Date, endDate?: Date) {
  return useQuery({
    queryKey: ['director-kpis', startDate?.toISOString(), endDate?.toISOString()],
    staleTime: 0,
    gcTime: 0,
    queryFn: async (): Promise<DirectorKPIs> => {
      const start = startDate ? format(startDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');
      const end = endDate ? format(endDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');

      // Buscar transações Hubla no período - FILTRAR apenas invoice.payment_succeeded e completed
      const { data: hublaData } = await supabase
        .from('hubla_transactions')
        .select('hubla_id, product_name, product_category, net_value, sale_date, installment_number, customer_name, customer_email, raw_data, product_price, event_type')
        .eq('sale_status', 'completed')
        .eq('event_type', 'invoice.payment_succeeded')
        .gte('sale_date', start)
        .lte('sale_date', end + 'T23:59:59');

      // ===== FATURAMENTO INCORPORADOR (Líquido) =====
      // Inclui TODAS as parcelas pagas (não só primeira), deduplicando por hubla_id
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
      const seenObVitalicioIds = new Set<string>();
      const obVitalicio = (hublaData || [])
        .filter(tx => {
          const productName = (tx.product_name || '').toUpperCase();
          const isOB = productName.includes('VITALÍCIO') || productName.includes('VITALICIO');
          if (seenObVitalicioIds.has(tx.hubla_id)) return false;
          if (isOB) {
            seenObVitalicioIds.add(tx.hubla_id);
            return true;
          }
          return false;
        })
        .reduce((sum, tx) => sum + (tx.net_value || 0), 0);

      // ===== OB CONSTRUIR PARA ALUGAR =====
      const seenObConstruirIds = new Set<string>();
      const obConstruir = (hublaData || [])
        .filter(tx => {
          const productName = (tx.product_name || '').toUpperCase();
          const isOB = productName.includes('CONSTRUIR') && productName.includes('ALUGAR');
          if (seenObConstruirIds.has(tx.hubla_id)) return false;
          if (isOB) {
            seenObConstruirIds.add(tx.hubla_id);
            return true;
          }
          return false;
        })
        .reduce((sum, tx) => sum + (tx.net_value || 0), 0);

      // ===== FATURADO A010 =====
      const seenA010FatIds = new Set<string>();
      const faturadoA010 = (hublaData || [])
        .filter(tx => {
          const productName = (tx.product_name || '').toUpperCase();
          const isA010 = tx.product_category === 'a010' || productName.includes('A010');
          if (seenA010FatIds.has(tx.hubla_id)) return false;
          if (isA010) {
            seenA010FatIds.add(tx.hubla_id);
            return true;
          }
          return false;
        })
        .reduce((sum, tx) => sum + (tx.net_value || 0), 0);

      // ===== FATURAMENTO TOTAL =====
      // Match EXATO com lista de 34 produtos, excluindo offers (-offer-)
      const seenAllIds = new Set<string>();
      const faturamentoTotal = (hublaData || [])
        .filter(tx => {
          const productName = (tx.product_name || '').trim();
          const hublaId = tx.hubla_id || '';
          
          // Excluir offers (Order Bumps)
          if (hublaId.includes('-offer-')) return false;
          
          // Match EXATO com a lista (case insensitive)
          const isInList = FATURAMENTO_TOTAL_PRODUCTS_EXACT.some(prod => 
            prod.toUpperCase() === productName.toUpperCase()
          );
          if (!isInList) return false;
          if (seenAllIds.has(tx.hubla_id)) return false;
          seenAllIds.add(tx.hubla_id);
          return true;
        })
        .reduce((sum, tx) => sum + (tx.net_value || 0), 0);

      // ===== VENDAS A010 =====
      // CORREÇÃO: Contar TODAS as linhas sem deduplicação
      const vendasA010 = (hublaData || []).filter(tx => {
        const productName = (tx.product_name || '').toUpperCase();
        const isA010 = tx.product_category === 'a010' || productName.includes('A010');
        const hasValidName = tx.customer_name && tx.customer_name.trim() !== '';
        return isA010 && hasValidName;
      }).length;
      

      // ===== GASTOS ADS =====
      const { data: adsData } = await supabase
        .from('daily_costs')
        .select('amount')
        .eq('cost_type', 'ads')
        .gte('date', start)
        .lte('date', end);

      const gastosAds = adsData?.reduce((sum, c) => sum + (c.amount || 0), 0) || 0;

      // DEBUG: Log período e contagens
      console.log('📊 Director KPIs Debug:', {
        periodo: `${start} - ${end}`,
        totalTransacoes: hublaData?.length,
        faturamentoTotal,
        vendasA010,
        gastosAds
      });

      // ===== CUSTOS OPERACIONAIS (equipe + escritório) =====
      const monthDate = format(startOfMonth(startDate || new Date()), 'yyyy-MM-dd');
      const { data: operationalData } = await supabase
        .from('operational_costs')
        .select('amount, cost_type')
        .eq('month', monthDate);

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

      // ===== FATURAMENTO CLINT (Bruto - usando product_price) - Calculado antes de ROI =====
      const seenClintBrutoIds = new Set<string>();
      const faturamentoClint = (hublaData || [])
        .filter(tx => {
          const productName = (tx.product_name || '').toUpperCase();
          const isIncorporador = INCORPORADOR_PRODUCTS.some(code => productName.startsWith(code));
          const isExcluded = EXCLUDED_PRODUCT_NAMES.some(name => productName.includes(name.toUpperCase()));
          if (seenClintBrutoIds.has(tx.hubla_id)) return false;
          if (isIncorporador && !isExcluded) {
            seenClintBrutoIds.add(tx.hubla_id);
            return true;
          }
          return false;
        })
        .reduce((sum, tx) => sum + (tx.product_price || 0), 0);

      // ROI = Faturamento Clint / (Faturamento Clint - Lucro)
      const denominadorRoi = faturamentoClint - lucro;
      const roi = denominadorRoi !== 0 ? (faturamentoClint / denominadorRoi) : 0;

      // ROAS = Faturamento Total / Gastos Ads
      const roas = gastosAds > 0 ? (faturamentoTotal / gastosAds) : 0;

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

      // Buscar dados anteriores para comparação - mesmo filtro
      const { data: prevHubla } = await supabase
        .from('hubla_transactions')
        .select('hubla_id, product_name, product_category, net_value, installment_number, customer_name, customer_email, raw_data, sale_date, product_price')
        .eq('sale_status', 'completed')
        .eq('event_type', 'invoice.payment_succeeded')
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

      const prevSeenObVitalicioIds = new Set<string>();
      const prevObVitalicio = (prevHubla || [])
        .filter(tx => {
          const name = (tx.product_name || '').toUpperCase();
          const isOB = name.includes('VITALÍCIO') || name.includes('VITALICIO');
          if (prevSeenObVitalicioIds.has(tx.hubla_id)) return false;
          if (isOB) {
            prevSeenObVitalicioIds.add(tx.hubla_id);
            return true;
          }
          return false;
        })
        .reduce((sum, tx) => sum + (tx.net_value || 0), 0);

      const prevSeenObConstruirIds = new Set<string>();
      const prevObConstruir = (prevHubla || [])
        .filter(tx => {
          const name = (tx.product_name || '').toUpperCase();
          const isOB = name.includes('CONSTRUIR') && name.includes('ALUGAR');
          if (prevSeenObConstruirIds.has(tx.hubla_id)) return false;
          if (isOB) {
            prevSeenObConstruirIds.add(tx.hubla_id);
            return true;
          }
          return false;
        })
        .reduce((sum, tx) => sum + (tx.net_value || 0), 0);

      const prevSeenA010FatIds = new Set<string>();
      const prevFatA010 = (prevHubla || [])
        .filter(tx => {
          const productName = (tx.product_name || '').toUpperCase();
          const isA010 = tx.product_category === 'a010' || productName.includes('A010');
          if (prevSeenA010FatIds.has(tx.hubla_id)) return false;
          if (isA010) {
            prevSeenA010FatIds.add(tx.hubla_id);
            return true;
          }
          return false;
        })
        .reduce((sum, tx) => sum + (tx.net_value || 0), 0);

      // Faturamento Total anterior = mesma lógica (match exato, sem offers)
      const prevSeenAllIds = new Set<string>();
      const prevFaturamentoTotal = (prevHubla || [])
        .filter(tx => {
          const productName = (tx.product_name || '').trim();
          const hublaId = tx.hubla_id || '';
          
          // Excluir offers (Order Bumps)
          if (hublaId.includes('-offer-')) return false;
          
          // Match EXATO com a lista (case insensitive)
          const isInList = FATURAMENTO_TOTAL_PRODUCTS_EXACT.some(prod => 
            prod.toUpperCase() === productName.toUpperCase()
          );
          if (!isInList) return false;
          if (prevSeenAllIds.has(tx.hubla_id)) return false;
          prevSeenAllIds.add(tx.hubla_id);
          return true;
        })
        .reduce((sum, tx) => sum + (tx.net_value || 0), 0);

      // Vendas A010 período anterior - contar TODAS as linhas sem deduplicação
      const prevVendasA010 = (prevHubla || []).filter(tx => {
        const productName = (tx.product_name || '').toUpperCase();
        const isA010 = tx.product_category === 'a010' || productName.includes('A010');
        const hasValidName = tx.customer_name && tx.customer_name.trim() !== '';
        return isA010 && hasValidName;
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
      // Faturamento Clint anterior (bruto)
      const prevSeenClintBrutoIds = new Set<string>();
      const prevFaturamentoClint = (prevHubla || [])
        .filter(tx => {
          const productName = (tx.product_name || '').toUpperCase();
          const isIncorporador = INCORPORADOR_PRODUCTS.some(code => productName.startsWith(code));
          const isExcluded = EXCLUDED_PRODUCT_NAMES.some(name => productName.includes(name.toUpperCase()));
          if (prevSeenClintBrutoIds.has(tx.hubla_id)) return false;
          if (isIncorporador && !isExcluded) {
            prevSeenClintBrutoIds.add(tx.hubla_id);
            return true;
          }
          return false;
        })
        .reduce((sum, tx) => sum + (tx.product_price || 0), 0);

      // ROI anterior = Faturamento Clint / (Faturamento Clint - Lucro)
      const prevDenominadorRoi = prevFaturamentoClint - prevLucro;
      const prevRoi = prevDenominadorRoi !== 0 ? (prevFaturamentoClint / prevDenominadorRoi) : 0;
      
      // ROAS anterior = Faturamento Total / Gastos Ads
      const prevRoas = prevGastosAds > 0 ? (prevFaturamentoTotal / prevGastosAds) : 0;

      // Calcular variações
      const calcChange = (current: number, previous: number) => {
        if (previous === 0) return current > 0 ? 100 : 0;
        return ((current - previous) / previous) * 100;
      };

      // ===== ULTRAMETA (baseado em vendas A010) =====
      const ultrametaClint = vendasA010 * 1680;
      const ultrametaLiquido = vendasA010 * 1400;
      const faturamentoLiquido = faturamentoIncorporador;

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
        // Novos campos Ultrameta
        ultrametaClint,
        faturamentoClint,
        ultrametaLiquido,
        faturamentoLiquido,
      };
    },
    refetchInterval: 30000,
  });
}
