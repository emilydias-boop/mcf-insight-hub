import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ALLOWED_BILLING_PRODUCTS } from '@/constants/billingProducts';
import { startOfMonth, endOfMonth, format, getDate } from 'date-fns';

export interface MonthInstallmentRow {
  installment_id: string;
  subscription_id: string;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  product_name: string;
  valor_entrada: number;
  forma_pagamento_sub: string | null;
  total_parcelas: number;
  link_assinatura_enviado: boolean;
  numero_parcela: number;
  valor_original: number;
  valor_pago: number | null;
  data_vencimento: string;
  data_pagamento: string | null;
  status: string;
  forma_pagamento_inst: string | null;
  exclusao_motivo: string | null;
  // Computed
  saldo_devedor_mes: number;
  week: number;
}

export interface MonthInstallmentKPIs {
  valorEstimado: number;
  valorRecebido: number;
  totalParcelas: number;
  parcelasPagas: number;
  parcelasAtrasadas: number;
  parcelasReembolso: number;
  parcelasExcluidas: number;
}

function getWeekOfMonth(dateStr: string): number {
  const day = getDate(new Date(dateStr + 'T12:00:00'));
  if (day <= 7) return 1;
  if (day <= 14) return 2;
  if (day <= 21) return 3;
  return 4;
}

export const useBillingMonthInstallments = (month: Date, weekFilter?: number | null) => {
  const start = format(startOfMonth(month), 'yyyy-MM-dd');
  const end = format(endOfMonth(month), 'yyyy-MM-dd');

  return useQuery({
    queryKey: ['billing-month-installments', start, end, weekFilter],
    queryFn: async () => {
      // Get subscription IDs for allowed products
      const { data: subData, error: subError } = await supabase
        .from('billing_subscriptions')
        .select('id, customer_name, customer_phone, customer_email, product_name, valor_entrada, forma_pagamento, total_parcelas, link_assinatura_enviado')
        .in('product_name', ALLOWED_BILLING_PRODUCTS);

      if (subError) throw subError;
      const subs = subData || [];
      if (subs.length === 0) return { rows: [] as MonthInstallmentRow[], kpis: emptyKpis() };

      const subMap = new Map(subs.map(s => [s.id, s]));
      const subIds = subs.map(s => s.id);

      // Fetch installments for the month
      const { data: instData, error: instError } = await supabase
        .from('billing_installments')
        .select('id, subscription_id, numero_parcela, valor_original, valor_pago, data_vencimento, data_pagamento, status, forma_pagamento, exclusao_motivo')
        .gte('data_vencimento', start)
        .lte('data_vencimento', end)
        .in('subscription_id', subIds.slice(0, 200))
        .order('data_vencimento', { ascending: true });

      if (instError) throw instError;
      const installments = instData || [];

      // Compute saldo devedor per subscription in this month
      const saldoMap = new Map<string, number>();
      installments.forEach(inst => {
        const current = saldoMap.get(inst.subscription_id) || 0;
        if (inst.status !== 'pago' && inst.status !== 'cancelado' && inst.status !== 'reembolso' && inst.status !== 'nao_sera_pago') {
          saldoMap.set(inst.subscription_id, current + (inst.valor_original || 0));
        }
      });

      const rows: MonthInstallmentRow[] = installments.map(inst => {
        const sub = subMap.get(inst.subscription_id);
        const week = getWeekOfMonth(inst.data_vencimento);
        return {
          installment_id: inst.id,
          subscription_id: inst.subscription_id,
          customer_name: sub?.customer_name || 'Desconhecido',
          customer_phone: sub?.customer_phone || null,
          customer_email: sub?.customer_email || null,
          product_name: sub?.product_name || '',
          valor_entrada: (sub?.valor_entrada as number) || 0,
          forma_pagamento_sub: sub?.forma_pagamento || null,
          total_parcelas: sub?.total_parcelas || 0,
          link_assinatura_enviado: (sub as any)?.link_assinatura_enviado || false,
          numero_parcela: inst.numero_parcela,
          valor_original: inst.valor_original || 0,
          valor_pago: inst.valor_pago,
          data_vencimento: inst.data_vencimento,
          data_pagamento: inst.data_pagamento,
          status: inst.status,
          forma_pagamento_inst: inst.forma_pagamento,
          exclusao_motivo: (inst as any).exclusao_motivo || null,
          saldo_devedor_mes: saldoMap.get(inst.subscription_id) || 0,
          week,
        };
      });

      const filteredRows = weekFilter ? rows.filter(r => r.week === weekFilter) : rows;

      // KPIs - exclude reembolso/nao_sera_pago from estimated
      const activeRows = filteredRows.filter(r => r.status !== 'reembolso' && r.status !== 'nao_sera_pago' && r.status !== 'cancelado');
      const kpis: MonthInstallmentKPIs = {
        valorEstimado: activeRows.reduce((s, r) => s + r.valor_original, 0),
        valorRecebido: filteredRows.filter(r => r.status === 'pago').reduce((s, r) => s + (r.valor_pago || 0), 0),
        totalParcelas: filteredRows.length,
        parcelasPagas: filteredRows.filter(r => r.status === 'pago').length,
        parcelasAtrasadas: filteredRows.filter(r => r.status === 'atrasado').length,
        parcelasReembolso: filteredRows.filter(r => r.status === 'reembolso').length,
        parcelasExcluidas: filteredRows.filter(r => r.status === 'nao_sera_pago').length,
      };

      return { rows: filteredRows, kpis };
    },
  });
};

function emptyKpis(): MonthInstallmentKPIs {
  return { valorEstimado: 0, valorRecebido: 0, totalParcelas: 0, parcelasPagas: 0, parcelasAtrasadas: 0, parcelasReembolso: 0, parcelasExcluidas: 0 };
}
