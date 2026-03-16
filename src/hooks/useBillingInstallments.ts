import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { BillingInstallment } from '@/types/billing';

export const useBillingInstallments = (subscriptionId: string | null) => {
  return useQuery({
    queryKey: ['billing-installments', subscriptionId],
    queryFn: async () => {
      if (!subscriptionId) return [];
      const { data, error } = await supabase
        .from('billing_installments')
        .select('*')
        .eq('subscription_id', subscriptionId)
        .order('numero_parcela', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as BillingInstallment[];
    },
    enabled: !!subscriptionId,
  });
};

export const useMarkInstallmentPaid = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, valor_pago, data_pagamento, forma_pagamento }: { id: string; valor_pago: number; data_pagamento: string; forma_pagamento?: string }) => {
      const { error } = await supabase
        .from('billing_installments')
        .update({
          status: 'pago',
          valor_pago,
          data_pagamento,
          forma_pagamento: forma_pagamento || null,
        } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing-installments'] });
      queryClient.invalidateQueries({ queryKey: ['billing-subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['billing-kpis'] });
      queryClient.invalidateQueries({ queryKey: ['billing-history'] });
    },
  });
};

export const useCreateInstallments = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (installments: Partial<BillingInstallment>[]) => {
      const { error } = await supabase.from('billing_installments').insert(installments as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing-installments'] });
    },
  });
};
