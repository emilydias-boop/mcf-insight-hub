import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MonthKPIData } from '@/components/financeiro/cobranca/CobrancaMonthKPIs';
import { SubscriptionType, PARCELADO_CATEGORIES } from '@/types/billing';
import { ALLOWED_BILLING_PRODUCTS } from '@/constants/billingProducts';
import { startOfMonth, endOfMonth, format } from 'date-fns';

export const useBillingMonthKPIs = (month: Date, subscriptionType?: SubscriptionType) => {
  const start = format(startOfMonth(month), 'yyyy-MM-dd');
  const end = format(endOfMonth(month), 'yyyy-MM-dd');

  return useQuery({
    queryKey: ['billing-month-kpis', start, end, subscriptionType],
    queryFn: async (): Promise<MonthKPIData> => {
      // First get subscription IDs matching the type filter
      let subIdsForType: string[] | null = null;
      if (subscriptionType) {
        let subQuery = supabase
          .from('billing_subscriptions')
          .select('id')
          .in('product_name', ALLOWED_BILLING_PRODUCTS);

        if (subscriptionType === 'parcelado') {
          subQuery = subQuery.in('product_category', [...PARCELADO_CATEGORIES]);
        } else {
          for (const cat of PARCELADO_CATEGORIES) {
            subQuery = subQuery.neq('product_category', cat);
          }
        }

        const { data: subData, error: subError } = await subQuery;
        if (subError) throw subError;
        subIdsForType = (subData || []).map(s => s.id);
        if (subIdsForType.length === 0) {
          return { parcelasDoMes: 0, parcelasPagas: 0, parcelasAtrasadas: 0, parcelasPendentes: 0, valorAReceber: 0, valorRecebido: 0, valorAtrasado: 0, taxaRecebimento: 0 };
        }
      }

      let instQuery = supabase
        .from('billing_installments')
        .select('valor_original, valor_pago, status, data_vencimento')
        .gte('data_vencimento', start)
        .lte('data_vencimento', end);

      if (subIdsForType) {
        instQuery = instQuery.in('subscription_id', subIdsForType.slice(0, 200));
      }

      const { data, error } = await instQuery;

      if (error) throw error;

      const installments = data || [];
      const parcelasDoMes = installments.length;
      const parcelasPagas = installments.filter(i => i.status === 'pago').length;
      const parcelasAtrasadas = installments.filter(i => i.status === 'atrasado').length;
      const parcelasPendentes = installments.filter(i => i.status === 'pendente').length;
      const valorAReceber = installments.reduce((s, i) => s + (i.valor_original || 0), 0);
      const valorRecebido = installments.filter(i => i.status === 'pago').reduce((s, i) => s + (i.valor_pago || 0), 0);
      const valorAtrasado = installments.filter(i => i.status === 'atrasado').reduce((s, i) => s + (i.valor_original || 0), 0);
      const taxaRecebimento = parcelasDoMes > 0 ? (parcelasPagas / parcelasDoMes) * 100 : 0;

      return {
        parcelasDoMes,
        parcelasPagas,
        parcelasAtrasadas,
        parcelasPendentes,
        valorAReceber,
        valorRecebido,
        valorAtrasado,
        taxaRecebimento,
      };
    },
  });
};
