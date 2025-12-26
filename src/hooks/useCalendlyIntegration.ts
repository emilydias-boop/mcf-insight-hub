import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface BookMeetingWithCalendlyParams {
  closerId: string;
  dealId: string;
  contactId?: string;
  scheduledAt: Date;
  durationMinutes?: number;
  leadType?: string;
  notes?: string;
}

interface BookMeetingResult {
  success: boolean;
  slotId: string;
  meetingLink: string;
  attendeeId?: string;
  slot: any;
}

export function useBookMeetingWithCalendly() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: BookMeetingWithCalendlyParams): Promise<BookMeetingResult> => {
      const { data, error } = await supabase.functions.invoke('calendly-create-event', {
        body: {
          closerId: params.closerId,
          dealId: params.dealId,
          contactId: params.contactId,
          scheduledAt: params.scheduledAt.toISOString(),
          durationMinutes: params.durationMinutes || 60,
          leadType: params.leadType || 'A',
          notes: params.notes,
        },
      });

      if (error) {
        throw new Error(error.message || 'Failed to book meeting');
      }

      if (!data.success) {
        throw new Error(data.error || 'Failed to book meeting');
      }

      return data as BookMeetingResult;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meeting_slots'] });
      queryClient.invalidateQueries({ queryKey: ['deal_meetings'] });
      queryClient.invalidateQueries({ queryKey: ['crm_deals'] });
    },
  });
}

// Hook to add another lead to an existing meeting slot
export function useAddLeadToMeeting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      meetingSlotId,
      dealId,
      contactId,
    }: {
      meetingSlotId: string;
      dealId: string;
      contactId?: string;
    }) => {
      // Check current attendees count
      const { count, error: countError } = await supabase
        .from('meeting_slot_attendees')
        .select('id', { count: 'exact', head: true })
        .eq('meeting_slot_id', meetingSlotId);

      if (countError) throw countError;

      // Get slot max attendees
      const { data: slot } = await supabase
        .from('meeting_slots')
        .select('max_attendees')
        .eq('id', meetingSlotId)
        .single();

      const maxAttendees = slot?.max_attendees || 3;
      const currentCount = count || 0;

      if (currentCount >= maxAttendees) {
        throw new Error(`Slot já tem o máximo de ${maxAttendees} participantes`);
      }

      // Add attendee
      const { data: attendee, error: insertError } = await supabase
        .from('meeting_slot_attendees')
        .insert({
          meeting_slot_id: meetingSlotId,
          deal_id: dealId,
          contact_id: contactId,
          status: 'invited',
        })
        .select()
        .single();

      if (insertError) throw insertError;

      return attendee;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meeting_slots'] });
      queryClient.invalidateQueries({ queryKey: ['meeting_slot_attendees'] });
    },
  });
}

// Hook to get attendees for a meeting slot
export function useMeetingAttendees(meetingSlotId?: string) {
  return useQuery({
    queryKey: ['meeting_slot_attendees', meetingSlotId],
    queryFn: async () => {
      if (!meetingSlotId) return [];

      const { data, error } = await supabase
        .from('meeting_slot_attendees')
        .select(`
          *,
          contact:crm_contacts(id, name, email, phone),
          deal:crm_deals(id, name)
        `)
        .eq('meeting_slot_id', meetingSlotId)
        .order('created_at');

      if (error) throw error;
      return data;
    },
    enabled: !!meetingSlotId,
  });
}

// Hook to get meeting slots with attendee count
export function useMeetingSlotsWithAttendees(startDate: Date, endDate: Date) {
  return useQuery({
    queryKey: ['meeting_slots_with_attendees', startDate.toISOString(), endDate.toISOString()],
    queryFn: async () => {
      const { data: slots, error: slotsError } = await supabase
        .from('meeting_slots')
        .select(`
          *,
          closers(*),
          contact:crm_contacts(id, name, email, phone)
        `)
        .gte('scheduled_at', startDate.toISOString())
        .lte('scheduled_at', endDate.toISOString())
        .in('status', ['scheduled', 'rescheduled']);

      if (slotsError) throw slotsError;

      // Get attendee counts for each slot
      const slotsWithCounts = await Promise.all(
        (slots || []).map(async (slot) => {
          const { count } = await supabase
            .from('meeting_slot_attendees')
            .select('id', { count: 'exact', head: true })
            .eq('meeting_slot_id', slot.id);

          return {
            ...slot,
            attendeesCount: count || 0,
            hasSpace: (count || 0) < (slot.max_attendees || 3),
          };
        })
      );

      return slotsWithCounts;
    },
  });
}
