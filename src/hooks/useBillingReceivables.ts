import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { BillingPaymentReceivable } from '@/types/billing';

export const useBillingReceivables = (installmentId: string | null) => {
  return useQuery({
    queryKey: ['billing-receivables', installmentId],
    queryFn: async () => {
      if (!installmentId) return [];
      const { data, error } = await supabase
        .from('billing_payment_receivables')
        .select('*')
        .eq('installment_id', installmentId)
        .order('numero', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as BillingPaymentReceivable[];
    },
    enabled: !!installmentId,
  });
};

export const useReceivablesBySubscription = (installmentIds: string[]) => {
  return useQuery({
    queryKey: ['billing-receivables-all', installmentIds],
    queryFn: async () => {
      if (!installmentIds.length) return [];
      const { data, error } = await supabase
        .from('billing_payment_receivables')
        .select('*')
        .in('installment_id', installmentIds)
        .order('numero', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as BillingPaymentReceivable[];
    },
    enabled: installmentIds.length > 0,
  });
};

export const useCreateReceivables = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (receivables: Partial<BillingPaymentReceivable>[]) => {
      const { error } = await supabase
        .from('billing_payment_receivables')
        .insert(receivables as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing-receivables'] });
      queryClient.invalidateQueries({ queryKey: ['billing-receivables-all'] });
    },
  });
};

export const useMarkReceivableReceived = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data_recebimento }: { id: string; data_recebimento: string }) => {
      const { error } = await supabase
        .from('billing_payment_receivables')
        .update({ status: 'recebido', data_recebimento } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing-receivables'] });
      queryClient.invalidateQueries({ queryKey: ['billing-receivables-all'] });
    },
  });
};
