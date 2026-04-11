import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MonthKPIData } from '@/components/financeiro/cobranca/CobrancaMonthKPIs';
import { ALLOWED_BILLING_PRODUCTS } from '@/constants/billingProducts';
import { startOfMonth, endOfMonth, format } from 'date-fns';

export const useBillingMonthKPIs = (month: Date) => {
  const start = format(startOfMonth(month), 'yyyy-MM-dd');
  const end = format(endOfMonth(month), 'yyyy-MM-dd');

  return useQuery({
    queryKey: ['billing-month-kpis', start, end],
    queryFn: async (): Promise<MonthKPIData> => {
      // Get subscription IDs for allowed products
      const { data: subData, error: subError } = await supabase
        .from('billing_subscriptions')
        .select('id')
        .in('product_name', ALLOWED_BILLING_PRODUCTS);

      if (subError) throw subError;
      const subIds = (subData || []).map(s => s.id);
      if (subIds.length === 0) {
        return { parcelasDoMes: 0, parcelasPagas: 0, parcelasAtrasadas: 0, parcelasPendentes: 0, valorAReceber: 0, valorRecebido: 0, valorAtrasado: 0, taxaRecebimento: 0 };
      }

      let instQuery = supabase
        .from('billing_installments')
        .select('valor_original, valor_pago, status, data_vencimento')
        .gte('data_vencimento', start)
        .lte('data_vencimento', end)
        .in('subscription_id', subIds.slice(0, 200));

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
