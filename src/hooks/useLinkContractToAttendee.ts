import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface LinkContractParams {
  transactionId: string;
  attendeeId: string;
  dealId?: string | null;
}

// Contract Paid stage ID
const CONTRACT_PAID_STAGE_ID = '0cf9a43b-de06-4c2a-8eab-e0f34c00e97a';

/**
 * Hook to link a contract transaction to an R1 attendee
 * and mark them as contract_paid
 */
export function useLinkContractToAttendee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ transactionId, attendeeId, dealId }: LinkContractParams) => {
      // VERIFICAÇÃO: Evitar duplicatas - se deal_id já tem outro attendee pago, bloquear
      if (dealId) {
        const { data: existingPaid } = await supabase
          .from('meeting_slot_attendees')
          .select('id, attendee_name')
          .eq('deal_id', dealId)
          .not('contract_paid_at', 'is', null)
          .neq('id', attendeeId)
          .limit(1)
          .maybeSingle();
        
        if (existingPaid) {
          throw new Error(`Este lead já possui contrato pago vinculado a outro attendee (${existingPaid.attendee_name})`);
        }
      }

      // VERIFICAÇÃO: Não permitir vincular contrato a sócio
      const { data: attendeeData } = await supabase
        .from('meeting_slot_attendees')
        .select('is_partner')
        .eq('id', attendeeId)
        .maybeSingle();

      if (attendeeData?.is_partner) {
        throw new Error('Sócios não podem ser marcados como contrato pago');
      }

      // 1. Link the transaction to the attendee
      const { error: txError } = await supabase
        .from('hubla_transactions')
        .update({ linked_attendee_id: attendeeId })
        .eq('id', transactionId);

      if (txError) throw txError;

      // 2. Update attendee status to contract_paid
      const { error: attendeeError } = await supabase
        .from('meeting_slot_attendees')
        .update({ 
          status: 'contract_paid',
          contract_paid_at: new Date().toISOString()
        })
        .eq('id', attendeeId);

      if (attendeeError) throw attendeeError;

      // 3. Move deal to "Contrato Pago" stage if dealId exists
      if (dealId) {
        const { error: dealError } = await supabase
          .from('crm_deals')
          .update({ stage_id: CONTRACT_PAID_STAGE_ID })
          .eq('id', dealId);

        if (dealError) {
          console.error('Error updating deal stage:', dealError);
          // Don't throw - contract linking succeeded, deal update is secondary
        }
      }

      return { transactionId, attendeeId };
    },
    onSuccess: () => {
      // Invalidate all relevant queries
      queryClient.invalidateQueries({ queryKey: ['unlinked-contracts'] });
      queryClient.invalidateQueries({ queryKey: ['agenda-meetings'] });
      queryClient.invalidateQueries({ queryKey: ['r2-pending-leads'] });
      queryClient.invalidateQueries({ queryKey: ['r2-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['r1-metrics'] });
      toast.success('Contrato vinculado com sucesso!');
    },
    onError: (error) => {
      console.error('Error linking contract:', error);
      toast.error('Erro ao vincular contrato');
    },
  });
}
