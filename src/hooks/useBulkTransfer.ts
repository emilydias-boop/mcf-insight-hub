import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

interface BulkTransferParams {
  dealIds: string[];
  newOwnerEmail: string;
  newOwnerName: string;
  newOwnerProfileId: string;
}

interface TransferResult {
  total: number;
  success: number;
  failed: number;
}

export const useBulkTransfer = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async ({ dealIds, newOwnerEmail, newOwnerName, newOwnerProfileId }: BulkTransferParams): Promise<TransferResult> => {
      const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Sistema';
      
      const results = await Promise.allSettled(
        dealIds.map(async (dealId) => {
          // Atualizar owner (email e UUID).
          // O registro em deal_activities ('owner_change') é feito pelo trigger
          // trg_log_deal_owner_change em crm_deals — não duplicar aqui.
          const { error: updateError } = await supabase
            .from('crm_deals')
            .update({ 
              owner_id: newOwnerEmail,
              owner_profile_id: newOwnerProfileId
            })
            .eq('id', dealId);
          
          if (updateError) throw updateError;

          return dealId;
        })
      );
      
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const failedCount = results.filter(r => r.status === 'rejected').length;
      
      return {
        total: dealIds.length,
        success: successCount,
        failed: failedCount,
      };
    },
    onSuccess: (result) => {
      if (result.failed === 0) {
        toast.success(`${result.success} leads transferidos com sucesso`);
      } else {
        toast.warning(`${result.success} transferidos, ${result.failed} falharam`);
      }
      queryClient.invalidateQueries({ queryKey: ['crm-deals'] });
    },
    onError: (error) => {
      console.error('Erro na transferência em massa:', error);
      toast.error('Erro ao transferir leads');
    },
  });
};
