import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { BillingSubscription, BillingFilters, BillingKPIs } from '@/types/billing';
import { useAuth } from '@/contexts/AuthContext';

export const useBillingSubscriptions = (filters: BillingFilters) => {
  return useQuery({
    queryKey: ['billing-subscriptions', filters],
    queryFn: async () => {
      let query = supabase
        .from('billing_subscriptions')
        .select('*')
        .order('updated_at', { ascending: false });

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

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as BillingSubscription[];
    },
  });
};

export const useBillingKPIs = () => {
  return useQuery({
    queryKey: ['billing-kpis'],
    queryFn: async () => {
      const { data: subs, error: subsError } = await supabase
        .from('billing_subscriptions')
        .select('id, valor_total_contrato, status, status_quitacao, total_parcelas');
      if (subsError) throw subsError;

      const { data: installments, error: instError } = await supabase
        .from('billing_installments')
        .select('valor_pago, status');
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
