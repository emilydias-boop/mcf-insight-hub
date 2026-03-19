import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { BillingSubscription, BillingFilters, BillingKPIs } from '@/types/billing';
import { useAuth } from '@/contexts/AuthContext';
import { startOfMonth, endOfMonth, format } from 'date-fns';

const fetchSubscriptionIdsForMonth = async (month: Date): Promise<string[]> => {
  const start = format(startOfMonth(month), 'yyyy-MM-dd');
  const end = format(endOfMonth(month), 'yyyy-MM-dd');

  const { data, error } = await supabase
    .from('billing_installments')
    .select('subscription_id')
    .gte('data_vencimento', start)
    .lte('data_vencimento', end);

  if (error) throw error;
  const ids = [...new Set((data || []).map(d => d.subscription_id))];
  return ids;
};

export const useBillingSubscriptions = (filters: BillingFilters) => {
  return useQuery({
    queryKey: ['billing-subscriptions', filters, filters.month?.toISOString()],
    queryFn: async () => {
      let subIds: string[] | null = null;

      if (filters.month) {
        subIds = await fetchSubscriptionIdsForMonth(filters.month);
        if (subIds.length === 0) return [] as BillingSubscription[];
      }

      let query = supabase
        .from('billing_subscriptions')
        .select('*')
        .order('updated_at', { ascending: false });

      if (subIds) {
        // Batch in chunks of 200 to avoid URL length limits
        if (subIds.length <= 200) {
          query = query.in('id', subIds);
        } else {
          const results: BillingSubscription[] = [];
          for (let i = 0; i < subIds.length; i += 200) {
            const chunk = subIds.slice(i, i + 200);
            let chunkQuery = supabase
              .from('billing_subscriptions')
              .select('*')
              .in('id', chunk)
              .order('updated_at', { ascending: false });

            // Apply same filters to each chunk
            chunkQuery = applyFilters(chunkQuery, filters);
            const { data, error } = await chunkQuery;
            if (error) throw error;
            results.push(...((data || []) as unknown as BillingSubscription[]));
          }
          return results;
        }
      }

      query = applyFilters(query, filters);

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as BillingSubscription[];
    },
  });
};

function applyFilters(query: any, filters: BillingFilters) {
  if (filters.status && filters.status !== 'todos') {
    query = query.eq('status', filters.status);
  }
  if (filters.formaPagamento && filters.formaPagamento !== 'todos') {
    query = query.eq('forma_pagamento', filters.formaPagamento);
  }
  if (filters.responsavel) {
    query = query.ilike('responsavel_financeiro', `%${filters.responsavel}%`);
  }
  if (filters.quitados) {
    query = query.eq('status_quitacao', 'quitado');
  }
  if (filters.inadimplentes) {
    query = query.eq('status', 'atrasada');
  }
  if (filters.product && filters.product !== 'todos') {
    query = query.eq('product_name', filters.product);
  }
  if (filters.category && filters.category !== 'todos') {
    query = query.eq('product_category', filters.category);
  }
  if (filters.search) {
    query = query.or(`customer_name.ilike.%${filters.search}%,customer_email.ilike.%${filters.search}%,product_name.ilike.%${filters.search}%`);
  }
  return query;
}

export const useBillingKPIs = (month?: Date) => {
  return useQuery({
    queryKey: ['billing-kpis', month?.toISOString()],
    queryFn: async () => {
      let subIds: string[] | null = null;
      let monthStart: string | null = null;
      let monthEnd: string | null = null;

      if (month) {
        monthStart = format(startOfMonth(month), 'yyyy-MM-dd');
        monthEnd = format(endOfMonth(month), 'yyyy-MM-dd');
        subIds = await fetchSubscriptionIdsForMonth(month);
      }

      // Fetch subscriptions (filtered by month if needed)
      let subsQuery = supabase
        .from('billing_subscriptions')
        .select('id, valor_total_contrato, status, status_quitacao, total_parcelas');

      if (subIds) {
        if (subIds.length === 0) {
          return {
            valorTotalContratado: 0, valorTotalPago: 0, saldoDevedor: 0,
            assinaturasAtivas: 0, assinaturasAtrasadas: 0, assinaturasQuitadas: 0,
            parcelasPagas: 0, parcelasTotais: 0,
          } as BillingKPIs;
        }
        subsQuery = subsQuery.in('id', subIds.slice(0, 200));
      }

      const { data: subs, error: subsError } = await subsQuery;
      if (subsError) throw subsError;

      // Fetch installments (filtered by month if needed)
      let instQuery = supabase
        .from('billing_installments')
        .select('valor_pago, status');

      if (monthStart && monthEnd) {
        instQuery = instQuery.gte('data_vencimento', monthStart).lte('data_vencimento', monthEnd);
      }

      const { data: installments, error: instError } = await instQuery;
      if (instError) throw instError;

      const subscriptions = (subs || []) as unknown as { id: string; valor_total_contrato: number; status: string; status_quitacao: string; total_parcelas: number }[];
      const instList = (installments || []) as unknown as { valor_pago: number; status: string }[];

      const valorTotalContratado = subscriptions.reduce((s, sub) => s + (sub.valor_total_contrato || 0), 0);
      const valorTotalPago = instList.filter(i => i.status === 'pago').reduce((s, i) => s + (i.valor_pago || 0), 0);

      const kpis: BillingKPIs = {
        valorTotalContratado,
        valorTotalPago,
        saldoDevedor: valorTotalContratado - valorTotalPago,
        assinaturasAtivas: subscriptions.filter(s => s.status === 'em_dia').length,
        assinaturasAtrasadas: subscriptions.filter(s => s.status === 'atrasada').length,
        assinaturasQuitadas: subscriptions.filter(s => s.status === 'quitada').length,
        parcelasPagas: instList.filter(i => i.status === 'pago').length,
        parcelasTotais: instList.length,
      };
      return kpis;
    },
  });
};

export const useCreateSubscription = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: Partial<BillingSubscription>) => {
      const { error } = await supabase.from('billing_subscriptions').insert({
        ...data,
        created_by: user?.id,
        updated_by: user?.id,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing-subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['billing-kpis'] });
    },
  });
};

export const useUpdateSubscription = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<BillingSubscription> & { id: string }) => {
      const { error } = await supabase
        .from('billing_subscriptions')
        .update({ ...data, updated_by: user?.id } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing-subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['billing-kpis'] });
    },
  });
};
