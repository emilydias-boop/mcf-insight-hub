import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, isSameDay } from 'date-fns';
import { toast } from 'sonner';
import { syncDealStageFromAgenda } from './useAgendaData';

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
      // 1. Update meeting status
      const { error } = await supabase
        .from('meeting_slots')
        .update({ status })
        .eq('id', meetingId);

      if (error) throw error;

      // 2. Fetch deal_id and closer email for CRM sync
      const { data: attendees } = await supabase
        .from('meeting_slot_attendees')
        .select('deal_id')
        .eq('meeting_slot_id', meetingId)
        .not('deal_id', 'is', null)
        .limit(1);

      const dealId = attendees?.[0]?.deal_id;

      // 3. Fetch closer email for ownership transfer
      const { data: meeting } = await supabase
        .from('meeting_slots')
        .select('closer:closers(email)')
        .eq('id', meetingId)
        .single();

      const closerEmail = (meeting?.closer as { email?: string } | null)?.email;

      // 4. Sync with CRM if deal is linked (R2 no-shows go to separate stage + keep with closer)
      const statusesToSync = ['no_show', 'completed', 'contract_paid', 'refunded'];
      if (dealId && statusesToSync.includes(status)) {
        await syncDealStageFromAgenda(dealId, status, 'r2', closerEmail);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['r2-agenda-meetings'] });
      queryClient.invalidateQueries({ queryKey: ['r2-meetings-extended'] });
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
      attendeeId,
      originalDate,
      originalCloserId,
      originalAttendeeStatus,
      rescheduleNote 
    }: { 
      meetingId: string; 
      newDate: Date; 
      closerId?: string; 
      attendeeId?: string;
      originalDate?: string;
      originalCloserId?: string;
      originalAttendeeStatus?: string;
      rescheduleNote?: string;
    }) => {
      const isNoShow = originalAttendeeStatus === 'no_show';
      const isDifferentDay = originalDate ? !isSameDay(newDate, new Date(originalDate)) : false;
      const targetCloserId = closerId || originalCloserId;

      // Case 1: No-show being rescheduled to a different day - create linked attendee
      if (isNoShow && isDifferentDay && attendeeId && targetCloserId) {
        // 1. Fetch original attendee data
        const { data: originalAttendee, error: fetchError } = await supabase
          .from('meeting_slot_attendees')
          .select('contact_id, deal_id, booked_by, attendee_name, attendee_phone, lead_profile, video_status, r2_status_id, thermometer_ids, meeting_link, r2_confirmation, r2_observations, notes')
          .eq('id', attendeeId)
          .single();

        if (fetchError) throw fetchError;

        // 2. Find or create target slot for the new date/time
        const targetDateTime = newDate.toISOString();
        const { data: existingSlot } = await supabase
          .from('meeting_slots')
          .select('id')
          .eq('closer_id', targetCloserId)
          .eq('scheduled_at', targetDateTime)
          .eq('meeting_type', 'r2')
          .maybeSingle();

        let targetSlotId = existingSlot?.id;

        if (!targetSlotId) {
          // Create new slot
          const { data: newSlot, error: slotError } = await supabase
            .from('meeting_slots')
            .insert({
              closer_id: targetCloserId,
              scheduled_at: targetDateTime,
              duration_minutes: 30,
              status: 'scheduled',
              meeting_type: 'r2',
              notes: rescheduleNote ? `Reagendado: ${rescheduleNote}` : null,
            })
            .select()
            .single();

          if (slotError) throw slotError;
          targetSlotId = newSlot.id;
        }

        // 3. Create NEW attendee linked to original via parent_attendee_id
        const { error: attendeeError } = await supabase
          .from('meeting_slot_attendees')
          .insert({
            meeting_slot_id: targetSlotId,
            contact_id: originalAttendee.contact_id,
            deal_id: originalAttendee.deal_id,
            booked_by: originalAttendee.booked_by,
            attendee_name: originalAttendee.attendee_name,
            attendee_phone: originalAttendee.attendee_phone,
            lead_profile: originalAttendee.lead_profile,
            video_status: originalAttendee.video_status,
            r2_status_id: originalAttendee.r2_status_id,
            thermometer_ids: originalAttendee.thermometer_ids,
            meeting_link: originalAttendee.meeting_link,
            r2_confirmation: originalAttendee.r2_confirmation,
            r2_observations: originalAttendee.r2_observations,
            notes: originalAttendee.notes,
            status: 'rescheduled',
            is_reschedule: true,
            parent_attendee_id: attendeeId,
          });

        if (attendeeError) throw attendeeError;

        // 4. Mark original slot as rescheduled (keep original attendee as no_show for history)
        await supabase
          .from('meeting_slots')
          .update({ status: 'rescheduled' })
          .eq('id', meetingId);

        // 5. Update deal custom_fields for tracking
        if (originalAttendee.deal_id) {
          const { data: deal } = await supabase
            .from('crm_deals')
            .select('custom_fields')
            .eq('id', originalAttendee.deal_id)
            .single();

          const currentFields = (deal?.custom_fields as Record<string, unknown>) || {};
          const rescheduleCount = (currentFields.reschedule_count as number) || 0;

          await supabase
            .from('crm_deals')
            .update({
              custom_fields: {
                ...currentFields,
                is_rescheduled: true,
                reschedule_count: rescheduleCount + 1,
                last_reschedule_at: new Date().toISOString(),
              }
            })
            .eq('id', originalAttendee.deal_id);
        }

        return { type: 'new_attendee_created' };
      }

      // Case 2: Simple reschedule (same day or not a no-show) - update existing records
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

      // Update attendee status and mark as reschedule
      if (attendeeId) {
        await supabase
          .from('meeting_slot_attendees')
          .update({ 
            status: 'rescheduled',
            is_reschedule: true 
          })
          .eq('id', attendeeId);
      }

      return { type: 'updated_existing' };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['r2-agenda-meetings'] });
      queryClient.invalidateQueries({ queryKey: ['r2-meetings-extended'] });
      queryClient.invalidateQueries({ queryKey: ['r2-noshows'] });
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
          booked_by: bookedBy || null,
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
      queryClient.invalidateQueries({ queryKey: ['r2-meetings-extended'] });
      toast.success('Reunião R2 agendada com sucesso');
    },
    onError: () => {
      toast.error('Erro ao agendar reunião R2');
    },
  });
}
