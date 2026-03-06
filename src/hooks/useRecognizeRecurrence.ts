import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface RecognizeRecurrenceParams {
  attendeeId: string;
  dealId?: string;
  contactId?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
}

export function useRecognizeRecurrence() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: RecognizeRecurrenceParams) => {
      // 1. Insert into partner_returns
      await supabase
        .from('partner_returns' as any)
        .insert({
          contact_id: params.contactId || null,
          contact_email: params.contactEmail || null,
          contact_name: params.contactName || null,
          partner_product: 'Reconhecido como recorrência - Pendentes R2',
          return_source: 'manual_recurrence',
          return_product: null,
          return_value: 0,
          original_deal_id: params.dealId || null,
          blocked: true,
        } as any);

      // 2. Update attendee status
      await supabase
        .from('meeting_slot_attendees')
        .update({ status: 'recurrence_recognized' } as any)
        .eq('id', params.attendeeId);

      // 3. Move deal to Perdido if exists
      if (params.dealId) {
        let lostStageId: string | null = null;

        const { data: globalStage } = await supabase
          .from('crm_stages')
          .select('id')
          .is('origin_id', null)
          .or('stage_name.ilike.%sem interesse%,stage_name.ilike.%perdido%')
          .limit(1)
          .single();

        if (globalStage) {
          lostStageId = globalStage.id;
        }

        if (lostStageId) {
          await supabase
            .from('crm_deals')
            .update({ stage_id: lostStageId, updated_at: new Date().toISOString() })
            .eq('id', params.dealId);
        }

        // 4. Log activity
        await supabase
          .from('deal_activities')
          .insert({
            deal_id: params.dealId,
            activity_type: 'recurrence_recognized',
            description: `Lead reconhecido como recorrência manualmente (Pendentes R2)`,
          });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['r2-pending-leads'] });
      queryClient.invalidateQueries({ queryKey: ['partner-returns'] });
      queryClient.invalidateQueries({ queryKey: ['r2-agenda'] });
      toast.success('Lead reconhecido como recorrência com sucesso');
    },
    onError: (error) => {
      console.error('Error recognizing recurrence:', error);
      toast.error('Erro ao reconhecer recorrência');
    },
  });
}
