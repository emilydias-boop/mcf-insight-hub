import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { BillingHistoryItem } from '@/types/billing';

export const useBillingHistory = (subscriptionId: string | null) => {
  return useQuery({
    queryKey: ['billing-history', subscriptionId],
    queryFn: async () => {
      if (!subscriptionId) return [];
      const { data, error } = await supabase
        .from('billing_history')
        .select('*')
        .eq('subscription_id', subscriptionId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as BillingHistoryItem[];
    },
    enabled: !!subscriptionId,
  });
};

export const useAddBillingHistory = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (entry: Partial<BillingHistoryItem>) => {
      const { error } = await supabase.from('billing_history').insert(entry as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing-history'] });
    },
  });
};
