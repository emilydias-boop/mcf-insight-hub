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
          // 1. Buscar owner atual
          const { data: deal } = await supabase
            .from('crm_deals')
            .select('owner_id, name')
            .eq('id', dealId)
            .single();
          
          const previousOwner = deal?.owner_id || 'Sem responsável';
          
          // 2. Atualizar owner (email e UUID)
          const { error: updateError } = await supabase
            .from('crm_deals')
            .update({ 
              owner_id: newOwnerEmail,
              owner_profile_id: newOwnerProfileId
            })
            .eq('id', dealId);
          
          if (updateError) throw updateError;
          
          // 3. Registrar atividade
          await supabase
            .from('deal_activities')
            .insert({
              deal_id: dealId,
              activity_type: 'owner_change',
              description: `Transferido de ${previousOwner} para ${newOwnerName} (em massa)`,
              user_id: user?.id,
              metadata: {
                previous_owner: previousOwner,
                new_owner: newOwnerEmail,
                new_owner_name: newOwnerName,
                transferred_by: userName,
                transferred_at: new Date().toISOString(),
                bulk_transfer: true,
              }
            });
          
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
