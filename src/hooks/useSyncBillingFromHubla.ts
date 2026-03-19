import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const useSyncBillingFromHubla = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      let offset = 0;
      let totalSubsCreated = 0;
      let totalSubsUpdated = 0;
      let totalInstallments = 0;
      let totalInstallmentsUpdated = 0;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase.functions.invoke('sync-billing-from-hubla', {
          body: { offset, batchSize: 100 },
        });
        if (error) throw error;
        
        totalSubsCreated += data.subsCreated || 0;
        totalSubsUpdated += data.subsUpdated || 0;
        totalInstallments += data.installmentsCreated || 0;
        totalInstallmentsUpdated += data.installmentsUpdated || 0;
        hasMore = data.hasMore === true;
        offset = data.nextOffset || 0;
      }

      return { subsCreated: totalSubsCreated, subsUpdated: totalSubsUpdated, installmentsCreated: totalInstallments, installmentsUpdated: totalInstallmentsUpdated };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['billing-subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['billing-kpis'] });
      toast.success(
        `Sincronização concluída: ${data.subsCreated} criadas, ${data.subsUpdated} atualizadas, ${data.installmentsCreated} parcelas`
      );
    },
    onError: (error: any) => {
      toast.error(`Erro na sincronização: ${error.message}`);
    },
  });
};
