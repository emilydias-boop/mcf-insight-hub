import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { toast } from 'sonner';

// Re-export types from existing hooks
export type { R2Meeting } from './useR2AgendaMeetings';
export { useR2AgendaMeetings } from './useR2AgendaMeetings';
export { useActiveR2Closers } from './useR2Closers';

// Alias types for consistency
export type R2MeetingSlot = import('./useR2AgendaMeetings').R2Meeting;
export type R2CloserWithAvailability = {
  id: string;
  name: string;
  email: string;
  color: string;
  is_active: boolean;
};

// ============ R2 Meeting Status Hooks ============

export function useUpdateR2MeetingStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ meetingId, status }: { meetingId: string; status: string }) => {
      const { error } = await supabase
        .from('meeting_slots')
        .update({ status })
        .eq('id', meetingId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['r2-agenda-meetings'] });
      toast.success('Status atualizado');
    },
    onError: () => {
      toast.error('Erro ao atualizar status');
    },
  });
}

export function useRescheduleR2Meeting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      meetingId, 
      newDate, 
      closerId, 
      rescheduleNote 
    }: { 
      meetingId: string; 
      newDate: Date; 
      closerId?: string; 
      rescheduleNote?: string;
    }) => {
      const updates: Record<string, unknown> = {
        scheduled_at: newDate.toISOString(),
        status: 'rescheduled',
      };
      
      if (closerId) {
        updates.closer_id = closerId;
      }
      
      if (rescheduleNote) {
        const { data: meeting } = await supabase
          .from('meeting_slots')
          .select('notes')
          .eq('id', meetingId)
          .single();
        
        const separator = '\n--- Reagendado em ' + format(new Date(), 'dd/MM/yyyy HH:mm') + ' ---\n';
        updates.notes = (meeting?.notes || '') + separator + rescheduleNote;
      }

      const { error } = await supabase
        .from('meeting_slots')
        .update(updates)
        .eq('id', meetingId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['r2-agenda-meetings'] });
      toast.success('Reunião R2 reagendada');
    },
    onError: () => {
      toast.error('Erro ao reagendar reunião R2');
    },
  });
}

export function useCreateR2Meeting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      closerId,
      dealId,
      contactId,
      scheduledAt,
      notes,
      attendeeName,
      attendeePhone,
      // R2-specific fields
      leadProfile,
      attendanceStatus,
      videoStatus,
      r2StatusId,
      thermometerIds,
      meetingLink,
      r2Confirmation,
      r2Observations,
      bookedBy,
    }: {
      closerId: string;
      dealId?: string;
      contactId?: string;
      scheduledAt: Date;
      notes?: string;
      attendeeName?: string;
      attendeePhone?: string;
      // R2-specific fields
      leadProfile?: string;
      attendanceStatus?: string;
      videoStatus?: 'ok' | 'pendente';
      r2StatusId?: string;
      thermometerIds?: string[];
      meetingLink?: string;
      r2Confirmation?: string;
      r2Observations?: string;
      bookedBy?: string;
    }) => {
      const { data: slot, error: slotError } = await supabase
        .from('meeting_slots')
        .insert({
          closer_id: closerId,
          deal_id: dealId || null,
          contact_id: contactId || null,
          scheduled_at: scheduledAt.toISOString(),
          duration_minutes: 30,
          status: 'scheduled',
          notes: notes || null,
          meeting_type: 'r2',
        })
        .select()
        .single();

      if (slotError) throw slotError;

      const { error: attendeeError } = await supabase
        .from('meeting_slot_attendees')
        .insert({
          meeting_slot_id: slot.id,
          deal_id: dealId || null,
          contact_id: contactId || null,
          attendee_name: attendeeName || null,
          attendee_phone: attendeePhone || null,
          status: attendanceStatus || 'invited',
          lead_profile: leadProfile || null,
          video_status: videoStatus || 'pendente',
          r2_status_id: r2StatusId || null,
          thermometer_ids: thermometerIds || [],
          meeting_link: meetingLink || null,
          r2_confirmation: r2Confirmation || null,
          r2_observations: r2Observations || null,
          booked_by: bookedBy || null,
          notes: notes || null,
        });

      if (attendeeError) throw attendeeError;

      return slot;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['r2-agenda-meetings'] });
      toast.success('Reunião R2 agendada com sucesso');
    },
    onError: () => {
      toast.error('Erro ao agendar reunião R2');
    },
  });
}
