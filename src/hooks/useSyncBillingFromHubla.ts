import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const useSyncBillingFromHubla = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const toastId = toast.loading('Sincronizando dados da Hubla... (iniciando)');
      
      let offset = 0;
      let totalSubsCreated = 0;
      let totalSubsUpdated = 0;
      let totalInstallments = 0;
      let totalInstallmentsUpdated = 0;
      let hasMore = true;
      let batchCount = 0;

      try {
        while (hasMore) {
          batchCount++;
          toast.loading(`Sincronizando... lote ${batchCount} (offset ${offset})`, { id: toastId });

          const { data, error } = await supabase.functions.invoke('sync-billing-from-hubla', {
            body: { offset, batchSize: 20, skipSingleTx: true },
          });
          if (error) throw error;
          
          totalSubsCreated += data.subsCreated || 0;
          totalSubsUpdated += data.subsUpdated || 0;
          totalInstallments += data.installmentsCreated || 0;
          totalInstallmentsUpdated += data.installmentsUpdated || 0;
          hasMore = data.hasMore === true;
          offset = data.nextOffset || 0;
        }

        toast.success(
          `Sincronização concluída: ${totalSubsCreated} criadas, ${totalSubsUpdated} atualizadas, ${totalInstallments} parcelas criadas, ${totalInstallmentsUpdated} parcelas atualizadas`,
          { id: toastId }
        );

        return { subsCreated: totalSubsCreated, subsUpdated: totalSubsUpdated, installmentsCreated: totalInstallments, installmentsUpdated: totalInstallmentsUpdated };
      } catch (err: any) {
        toast.error(`Erro na sincronização: ${err.message}`, { id: toastId });
        throw err;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing-subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['billing-kpis'] });
    },
  });
};
