import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { BillingAgreement, BillingAgreementInstallment } from '@/types/billing';
import { useAuth } from '@/contexts/AuthContext';

export const useBillingAgreements = (subscriptionId: string | null) => {
  return useQuery({
    queryKey: ['billing-agreements', subscriptionId],
    queryFn: async () => {
      if (!subscriptionId) return [];
      const { data, error } = await supabase
        .from('billing_agreements')
        .select('*')
        .eq('subscription_id', subscriptionId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as BillingAgreement[];
    },
    enabled: !!subscriptionId,
  });
};

export const useBillingAgreementInstallments = (agreementId: string | null) => {
  return useQuery({
    queryKey: ['billing-agreement-installments', agreementId],
    queryFn: async () => {
      if (!agreementId) return [];
      const { data, error } = await supabase
        .from('billing_agreement_installments')
        .select('*')
        .eq('agreement_id', agreementId)
        .order('numero_parcela', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as BillingAgreementInstallment[];
    },
    enabled: !!agreementId,
  });
};

export const useCreateAgreement = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ agreement, installments }: { agreement: Partial<BillingAgreement>; installments: Partial<BillingAgreementInstallment>[] }) => {
      const { data, error } = await supabase
        .from('billing_agreements')
        .insert({ ...agreement, created_by: user?.id } as any)
        .select('id')
        .single();
      if (error) throw error;

      if (installments.length > 0) {
        const instWithId = installments.map(i => ({ ...i, agreement_id: data.id }));
        const { error: instError } = await supabase.from('billing_agreement_installments').insert(instWithId as any);
        if (instError) throw instError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing-agreements'] });
      queryClient.invalidateQueries({ queryKey: ['billing-agreement-installments'] });
      queryClient.invalidateQueries({ queryKey: ['billing-history'] });
    },
  });
};

export const useUpdateAgreement = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<BillingAgreement> & { id: string }) => {
      const { error } = await supabase
        .from('billing_agreements')
        .update(data as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing-agreements'] });
    },
  });
};

export const useMarkAgreementInstallmentPaid = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data_pagamento }: { id: string; data_pagamento: string }) => {
      const { error } = await supabase
        .from('billing_agreement_installments')
        .update({ status: 'pago', data_pagamento } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing-agreement-installments'] });
      queryClient.invalidateQueries({ queryKey: ['billing-agreements'] });
    },
  });
};
