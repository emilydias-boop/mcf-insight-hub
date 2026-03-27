import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface R2PreScheduledLead {
  id: string;
  attendee_name: string | null;
  attendee_phone: string | null;
  status: string;
  deal_id: string | null;
  booked_by: string | null;
  created_at: string;
  notes: string | null;
  r2_observations: string | null;
  meeting_slot: {
    id: string;
    scheduled_at: string;
    closer: {
      id: string;
      name: string;
      color: string | null;
    } | null;
  } | null;
  booker_profile: {
    full_name: string | null;
  } | null;
  deal: {
    name: string;
    contact: {
      name: string;
      phone: string | null;
      email: string | null;
    } | null;
  } | null;
}

export function useR2PreScheduledLeads() {
  return useQuery({
    queryKey: ['r2-pre-scheduled-leads'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meeting_slot_attendees')
        .select(`
          id,
          attendee_name,
          attendee_phone,
          status,
          deal_id,
          booked_by,
          created_at,
          notes,
          r2_observations,
          meeting_slot:meeting_slots!meeting_slot_id(
            id,
            scheduled_at,
            closer:closers!closer_id(id, name, color)
          ),
          deal:crm_deals!deal_id(
            name,
            contact:crm_contacts!contact_id(name, phone, email)
          )
        `)
        .eq('status', 'pre_scheduled')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch booker profiles separately
      const bookerIds = [...new Set((data || []).map(d => d.booked_by).filter(Boolean))];
      let bookerMap: Record<string, string> = {};
      
      if (bookerIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', bookerIds);
        
        if (profiles) {
          bookerMap = Object.fromEntries(profiles.map(p => [p.id, p.full_name || '']));
        }
      }

      return (data || []).map(item => ({
        ...item,
        booker_profile: item.booked_by ? { full_name: bookerMap[item.booked_by] || null } : null,
      })) as R2PreScheduledLead[];
    },
  });
}

export function useR2PreScheduledCount() {
  const { data } = useR2PreScheduledLeads();
  return data?.length || 0;
}

export function useConfirmR2PreScheduled() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (attendeeId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      // 1. Get attendee + meeting slot info to check if r2_daily_slot exists
      const { data: attendee } = await supabase
        .from('meeting_slot_attendees')
        .select('meeting_slot_id')
        .eq('id', attendeeId)
        .single();

      if (attendee?.meeting_slot_id) {
        const { data: slot } = await supabase
          .from('meeting_slots')
          .select('closer_id, scheduled_at')
          .eq('id', attendee.meeting_slot_id)
          .single();

        if (slot) {
          const scheduledDate = new Date(slot.scheduled_at);
          const dateStr = scheduledDate.toISOString().split('T')[0];
          const timeStr = `${String(scheduledDate.getHours()).padStart(2, '0')}:${String(scheduledDate.getMinutes()).padStart(2, '0')}`;

          // Check if r2_daily_slot exists for this closer/date/time
          const { data: existingDailySlot } = await supabase
            .from('r2_daily_slots')
            .select('id')
            .eq('closer_id', slot.closer_id)
            .eq('slot_date', dateStr)
            .eq('start_time', timeStr)
            .maybeSingle();

          // Auto-create r2_daily_slot if it doesn't exist
          if (!existingDailySlot) {
            await supabase
              .from('r2_daily_slots')
              .insert({
                closer_id: slot.closer_id,
                slot_date: dateStr,
                start_time: timeStr,
                is_available: true,
              });
          }
        }
      }

      // 2. Confirm the attendee
      const { error } = await supabase
        .from('meeting_slot_attendees')
        .update({
          status: 'invited',
          confirmed_by: user?.id || null,
          confirmed_at: new Date().toISOString(),
        } as Record<string, unknown>)
        .eq('id', attendeeId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['r2-pre-scheduled-leads'] });
      queryClient.invalidateQueries({ queryKey: ['r2-agenda-meetings'] });
      queryClient.invalidateQueries({ queryKey: ['r2-meetings-extended'] });
      queryClient.invalidateQueries({ queryKey: ['r2-pending-leads'] });
      toast.success('Agendamento confirmado');
    },
    onError: () => {
      toast.error('Erro ao confirmar agendamento');
    },
  });
}

export function useCancelR2PreScheduled() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (attendeeId: string) => {
      const { error } = await supabase
        .from('meeting_slot_attendees')
        .update({ status: 'cancelled' })
        .eq('id', attendeeId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['r2-pre-scheduled-leads'] });
      queryClient.invalidateQueries({ queryKey: ['r2-agenda-meetings'] });
      queryClient.invalidateQueries({ queryKey: ['r2-meetings-extended'] });
      queryClient.invalidateQueries({ queryKey: ['r2-pending-leads'] });
      toast.success('Pré-agendamento cancelado');
    },
    onError: () => {
      toast.error('Erro ao cancelar pré-agendamento');
    },
  });
}
