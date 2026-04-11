import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useUpdateInstallmentStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status, exclusao_motivo }: { id: string; status: string; exclusao_motivo?: string }) => {
      const { error } = await supabase
        .from('billing_installments')
        .update({ status, exclusao_motivo: exclusao_motivo || null } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing-month-installments'] });
      queryClient.invalidateQueries({ queryKey: ['billing-installments'] });
      queryClient.invalidateQueries({ queryKey: ['billing-kpis'] });
      queryClient.invalidateQueries({ queryKey: ['billing-annual-summary'] });
    },
  });
};
