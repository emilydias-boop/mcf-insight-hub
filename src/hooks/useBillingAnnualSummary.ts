import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ALLOWED_BILLING_PRODUCTS } from '@/constants/billingProducts';
import { startOfMonth, endOfMonth, format, setMonth } from 'date-fns';

export interface AnnualMonthSummary {
  month: number; // 0-11
  label: string;
  totalPrevisto: number;
  totalRecebido: number;
  totalEmRisco: number;
  totalReembolsado: number;
}

export const useBillingAnnualSummary = (year: number) => {
  return useQuery({
    queryKey: ['billing-annual-summary', year],
    queryFn: async () => {
      const yearStart = format(startOfMonth(new Date(year, 0, 1)), 'yyyy-MM-dd');
      const yearEnd = format(endOfMonth(new Date(year, 11, 31)), 'yyyy-MM-dd');

      const { data: subData } = await supabase
        .from('billing_subscriptions')
        .select('id')
        .in('product_name', ALLOWED_BILLING_PRODUCTS);

      const subIds = (subData || []).map(s => s.id);
      if (subIds.length === 0) return [] as AnnualMonthSummary[];

      const { data: instData } = await supabase
        .from('billing_installments')
        .select('valor_original, valor_pago, status, data_vencimento')
        .gte('data_vencimento', yearStart)
        .lte('data_vencimento', yearEnd)
        .in('subscription_id', subIds.slice(0, 200));

      const installments = instData || [];
      const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

      return months.map((label, i): AnnualMonthSummary => {
        const s = format(startOfMonth(new Date(year, i, 1)), 'yyyy-MM-dd');
        const e = format(endOfMonth(new Date(year, i, 1)), 'yyyy-MM-dd');
        const monthInst = installments.filter(inst => inst.data_vencimento >= s && inst.data_vencimento <= e);

        const active = monthInst.filter(inst => inst.status !== 'reembolso' && inst.status !== 'nao_sera_pago' && inst.status !== 'cancelado');
        return {
          month: i,
          label,
          totalPrevisto: active.reduce((acc, inst) => acc + (inst.valor_original || 0), 0),
          totalRecebido: monthInst.filter(inst => inst.status === 'pago').reduce((acc, inst) => acc + (inst.valor_pago || 0), 0),
          totalEmRisco: monthInst.filter(inst => inst.status === 'atrasado').reduce((acc, inst) => acc + (inst.valor_original || 0), 0),
          totalReembolsado: monthInst.filter(inst => inst.status === 'reembolso').reduce((acc, inst) => acc + (inst.valor_original || 0), 0),
        };
      });
    },
  });
};
