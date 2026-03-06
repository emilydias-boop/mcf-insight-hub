import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface RecognizePartnerParams {
  attendeeId: string;
  dealId?: string;
  contactId?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
}

export function useRecognizePartner() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: RecognizePartnerParams) => {
      // 1. Insert into partner_returns
      await supabase
        .from('partner_returns' as any)
        .insert({
          contact_id: params.contactId || null,
          contact_email: params.contactEmail || null,
          contact_name: params.contactName || null,
          partner_product: 'Reconhecido manualmente - Pendentes R2',
          return_source: 'manual_recognition',
          return_product: null,
          return_value: 0,
          original_deal_id: params.dealId || null,
          blocked: true,
        } as any);

      // 2. Update attendee as partner
      await supabase
        .from('meeting_slot_attendees')
        .update({ is_partner: true, status: 'partner_recognized' } as any)
        .eq('id', params.attendeeId);

      // 3. Move deal to Perdido if exists
      if (params.dealId) {
        // Find lost stage
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
            activity_type: 'partner_recognized',
            description: `Lead reconhecido como parceiro manualmente (Pendentes R2)`,
          });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['r2-pending-leads'] });
      queryClient.invalidateQueries({ queryKey: ['partner-returns'] });
      queryClient.invalidateQueries({ queryKey: ['r2-agenda'] });
      toast.success('Lead reconhecido como parceiro com sucesso');
    },
    onError: (error) => {
      console.error('Error recognizing partner:', error);
      toast.error('Erro ao reconhecer parceiro');
    },
  });
}
