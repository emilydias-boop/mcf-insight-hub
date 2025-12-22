import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfWeek, endOfWeek, format, addDays } from 'date-fns';
import { toast } from 'sonner';

export interface MeetingSlot {
  id: string;
  closer_id: string;
  deal_id: string | null;
  contact_id: string | null;
  scheduled_at: string;
  duration_minutes: number;
  status: string;
  booked_by: string | null;
  notes: string | null;
  meeting_link: string | null;
  created_at: string;
  closer?: {
    id: string;
    name: string;
    email: string;
  };
  deal?: {
    id: string;
    name: string;
    contact?: {
      id: string;
      name: string;
      phone: string | null;
      email: string | null;
    };
  };
}

export interface CloserWithAvailability {
  id: string;
  name: string;
  email: string;
  is_active: boolean;
  availability: {
    id: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
    slot_duration_minutes: number;
    is_active: boolean;
  }[];
}

export interface AgendaStats {
  totalMeetingsToday: number;
  totalMeetingsWeek: number;
  completedMeetings: number;
  noShowMeetings: number;
  canceledMeetings: number;
}

export function useAgendaMeetings(startDate: Date, endDate: Date) {
  return useQuery({
    queryKey: ['agenda-meetings', format(startDate, 'yyyy-MM-dd'), format(endDate, 'yyyy-MM-dd')],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meeting_slots')
        .select(`
          *,
          closer:closers(id, name, email),
          deal:crm_deals(
            id, 
            name,
            contact:crm_contacts(id, name, phone, email)
          )
        `)
        .gte('scheduled_at', startDate.toISOString())
        .lte('scheduled_at', endDate.toISOString())
        .order('scheduled_at', { ascending: true });

      if (error) throw error;
      return data as MeetingSlot[];
    },
  });
}

export function useAgendaStats(date: Date) {
  const weekStart = startOfWeek(date, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(date, { weekStartsOn: 1 });
  const todayStart = new Date(date);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(date);
  todayEnd.setHours(23, 59, 59, 999);

  return useQuery({
    queryKey: ['agenda-stats', format(date, 'yyyy-MM-dd')],
    queryFn: async () => {
      // Meetings today
      const { data: todayData } = await supabase
        .from('meeting_slots')
        .select('id, status')
        .gte('scheduled_at', todayStart.toISOString())
        .lte('scheduled_at', todayEnd.toISOString());

      // Meetings this week
      const { data: weekData } = await supabase
        .from('meeting_slots')
        .select('id, status')
        .gte('scheduled_at', weekStart.toISOString())
        .lte('scheduled_at', weekEnd.toISOString());

      const stats: AgendaStats = {
        totalMeetingsToday: todayData?.length || 0,
        totalMeetingsWeek: weekData?.length || 0,
        completedMeetings: weekData?.filter(m => m.status === 'completed').length || 0,
        noShowMeetings: weekData?.filter(m => m.status === 'no_show').length || 0,
        canceledMeetings: weekData?.filter(m => m.status === 'canceled').length || 0,
      };

      return stats;
    },
  });
}

export function useClosersWithAvailability() {
  return useQuery({
    queryKey: ['closers-with-availability'],
    queryFn: async () => {
      const { data: closers, error: closersError } = await supabase
        .from('closers')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (closersError) throw closersError;

      const { data: availability, error: availError } = await supabase
        .from('closer_availability')
        .select('*')
        .eq('is_active', true);

      if (availError) throw availError;

      const closersWithAvailability: CloserWithAvailability[] = closers.map(closer => ({
        ...closer,
        availability: availability?.filter(a => a.closer_id === closer.id) || [],
      }));

      return closersWithAvailability;
    },
  });
}

export function useUpdateMeetingStatus() {
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
      queryClient.invalidateQueries({ queryKey: ['agenda-meetings'] });
      queryClient.invalidateQueries({ queryKey: ['agenda-stats'] });
      toast.success('Status atualizado');
    },
    onError: () => {
      toast.error('Erro ao atualizar status');
    },
  });
}

export function useUpdateAvailability() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      closerId,
      availability,
    }: {
      closerId: string;
      availability: {
        day_of_week: number;
        start_time: string;
        end_time: string;
        slot_duration_minutes: number;
        is_active: boolean;
      }[];
    }) => {
      // Delete existing availability for this closer
      await supabase
        .from('closer_availability')
        .delete()
        .eq('closer_id', closerId);

      // Insert new availability
      if (availability.length > 0) {
        const { error } = await supabase
          .from('closer_availability')
          .insert(
            availability.map(a => ({
              closer_id: closerId,
              ...a,
            }))
          );

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['closers-with-availability'] });
      toast.success('Disponibilidade atualizada');
    },
    onError: () => {
      toast.error('Erro ao atualizar disponibilidade');
    },
  });
}

export function useCancelMeeting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (meetingId: string) => {
      const { error } = await supabase
        .from('meeting_slots')
        .update({ status: 'canceled' })
        .eq('id', meetingId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agenda-meetings'] });
      queryClient.invalidateQueries({ queryKey: ['agenda-stats'] });
      toast.success('Reunião cancelada');
    },
    onError: () => {
      toast.error('Erro ao cancelar reunião');
    },
  });
}
