import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const deleteSingleDeal = async (id: string) => {
  // Delete dependent records first to avoid FK constraint errors
  await supabase.from('deal_activities').delete().eq('deal_id', id);
  await supabase.from('deal_tasks').delete().eq('deal_id', id);
  await supabase.from('automation_queue').delete().eq('deal_id', id);
  await supabase.from('automation_logs').delete().eq('deal_id', id);

  const { data: slots } = await supabase
    .from('meeting_slots')
    .select('id')
    .eq('deal_id', id);

  if (slots && slots.length > 0) {
    const slotIds = slots.map(s => s.id);
    const { data: attendees } = await supabase
      .from('meeting_slot_attendees')
      .select('id')
      .in('meeting_slot_id', slotIds);
    const attendeeIds = attendees?.map(a => a.id) || [];
    if (attendeeIds.length > 0) {
      await supabase.from('attendee_notes').delete().in('attendee_id', attendeeIds);
      await supabase.from('attendee_movement_logs').delete().in('attendee_id', attendeeIds);
      await supabase.from('meeting_slot_attendees').delete().in('meeting_slot_id', slotIds);
    }
    await supabase.from('meeting_slots').delete().eq('deal_id', id);
  }

  await supabase.from('calls').delete().eq('deal_id', id);

  // Limpar consórcio pending registrations e seus documentos
  const { data: pendingRegs } = await supabase
    .from('consorcio_pending_registrations')
    .select('id')
    .eq('deal_id', id);

  if (pendingRegs && pendingRegs.length > 0) {
    const regIds = pendingRegs.map(r => r.id);
    await supabase.from('consortium_documents').delete().in('pending_registration_id', regIds);
    await supabase.from('consorcio_pending_registrations').delete().in('id', regIds);
  }

  const { error } = await supabase.from('crm_deals').delete().eq('id', id);
  if (error) throw error;
};

export const useBulkDeleteDeals = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ids: string[]) => {
      // Delete sequentially to avoid FK issues
      for (const id of ids) {
        await deleteSingleDeal(id);
      }
    },
    onSuccess: (_data, ids) => {
      queryClient.invalidateQueries({ queryKey: ['crm-deals'] });
      queryClient.invalidateQueries({ queryKey: ['agenda-meetings'] });
      queryClient.invalidateQueries({ queryKey: ['meeting-slots'] });
      queryClient.invalidateQueries({ queryKey: ['crm-contacts-with-deals'] });
      toast.success(`${ids.length} lead${ids.length > 1 ? 's' : ''} excluído${ids.length > 1 ? 's' : ''} com sucesso`);
    },
    onError: (error: any) => {
      toast.error(`Erro ao excluir leads: ${error.message}`);
    },
  });
};
