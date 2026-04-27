import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface LinkContractParams {
  transactionId: string;
  attendeeId: string;
  dealId?: string | null;
}

/**
 * Hook to link a contract transaction to an R1 attendee
 * and mark them as contract_paid
 */
export function useLinkContractToAttendee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ transactionId, attendeeId, dealId }: LinkContractParams) => {
      // VERIFICAÇÃO: Bloquear vinculação de contrato para BUs que não utilizam (ex: Consórcio)
      if (dealId) {
        const { data: dealData } = await supabase
          .from('crm_deals')
          .select('origin_id')
          .eq('id', dealId)
          .maybeSingle();

        if (dealData?.origin_id) {
          const { data: buMapping } = await supabase
            .from('bu_origin_mapping')
            .select('bu')
            .eq('entity_id', dealData.origin_id)
            .limit(1)
            .maybeSingle();

          if (buMapping?.bu === 'consorcio') {
            throw new Error('Consórcio não utiliza vinculação de contrato');
          }
        }
      }

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
      const { data: { user } } = await supabase.auth.getUser();
      const { error: txError } = await supabase
        .from('hubla_transactions')
        .update({
          linked_attendee_id: attendeeId,
          linked_method: 'manual',
          linked_at: new Date().toISOString(),
          linked_by_user_id: user?.id ?? null,
        })
        .eq('id', transactionId);

      if (txError) throw txError;

      // 2. Fonte de verdade para contract_paid_at: sale_date da Hubla MAIS ANTIGA
      //    vinculada ao attendee (cobre caso de múltiplas parcelas/transações).
      //    Fallback: sale_date da própria transação sendo vinculada; depois now().
      const { data: linkedTxs } = await supabase
        .from('hubla_transactions')
        .select('sale_date')
        .eq('linked_attendee_id', attendeeId)
        .eq('sale_status', 'completed')
        .order('sale_date', { ascending: true })
        .limit(1);

      let contractPaidAt = linkedTxs?.[0]?.sale_date;
      if (!contractPaidAt) {
        const { data: txData } = await supabase
          .from('hubla_transactions')
          .select('sale_date')
          .eq('id', transactionId)
          .maybeSingle();
        contractPaidAt = txData?.sale_date || new Date().toISOString();
      }

      // 3. Update attendee status to contract_paid with real sale date
      const { error: attendeeError } = await supabase
        .from('meeting_slot_attendees')
        .update({ 
          status: 'contract_paid',
          contract_paid_at: contractPaidAt
        })
        .eq('id', attendeeId);

      if (attendeeError) throw attendeeError;

      // 4. Move deal to "Contrato Pago" stage if dealId exists
      // Dynamically find the correct stage based on the deal's origin
      if (dealId) {
        const { data: dealData } = await supabase
          .from('crm_deals')
          .select('origin_id')
          .eq('id', dealId)
          .maybeSingle();

        if (dealData?.origin_id) {
          const { data: stageData } = await supabase
            .from('crm_stages')
            .select('id')
            .eq('origin_id', dealData.origin_id)
            .ilike('stage_name', '%contrato%pago%')
            .limit(1)
            .maybeSingle();

          if (stageData) {
            const { error: dealError } = await supabase
              .from('crm_deals')
              .update({ stage_id: stageData.id })
              .eq('id', dealId);

            if (dealError) {
              console.error('Error updating deal stage:', dealError);
            }
          }
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
