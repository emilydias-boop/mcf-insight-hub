import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const useSyncBillingFromHubla = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('sync-billing-from-hubla', {
        method: 'POST',
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['billing-subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['billing-kpis'] });
      toast.success(
        `Sincronização concluída: ${data.subsCreated} assinaturas criadas, ${data.subsUpdated} atualizadas, ${data.installmentsCreated} parcelas criadas`
      );
    },
    onError: (error: any) => {
      toast.error(`Erro na sincronização: ${error.message}`);
    },
  });
};
