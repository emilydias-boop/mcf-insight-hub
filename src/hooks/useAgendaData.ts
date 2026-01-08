import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfWeek, endOfWeek, format, addDays, isSameDay, parseISO } from 'date-fns';
import { toast } from 'sonner';

export interface MeetingAttendee {
  id: string;
  deal_id: string | null;
  contact_id: string | null;
  attendee_name: string | null;
  attendee_phone: string | null;
  is_partner: boolean;
  status: string;
  notified_at: string | null;
  booked_by: string | null;
  notes: string | null;
  closer_notes: string | null;
  contact?: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
  };
  deal?: {
    id: string;
    name: string;
  };
  booked_by_profile?: {
    id: string;
    full_name: string | null;
    email: string | null;
  };
}

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
  closer_notes: string | null;
  meeting_link: string | null;
  video_conference_link: string | null;
  google_event_id: string | null;
  created_at: string;
  closer?: {
    id: string;
    name: string;
    email: string;
    color?: string;
    google_calendar_id?: string;
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
  attendees?: MeetingAttendee[];
  booked_by_profile?: {
    id: string;
    full_name: string | null;
    email: string | null;
  };
}

export type LeadType = 'A' | 'B';

export interface CloserWithAvailability {
  id: string;
  name: string;
  email: string;
  color: string;
  is_active: boolean;
  availability: {
    id: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
    slot_duration_minutes: number;
    is_active: boolean;
    lead_type?: LeadType;
    max_slots_per_hour?: number;
  }[];
}

export interface BlockedDate {
  id: string;
  closer_id: string;
  blocked_date: string;
  reason: string | null;
  created_at: string;
}

export interface AgendaStats {
  totalMeetingsToday: number;
  totalMeetingsWeek: number;
  completedMeetings: number;
  noShowMeetings: number;
  canceledMeetings: number;
}

export interface CloserMetrics {
  closerId: string;
  closerName: string;
  color: string;
  totalSlots: number;
  bookedSlots: number;
  occupancyRate: number;
  completedMeetings: number;
  noShowMeetings: number;
  conversionRate: number;
}

// ============ Meetings Hooks ============

export function useAgendaMeetings(startDate: Date, endDate: Date) {
  return useQuery({
    queryKey: ['agenda-meetings', format(startDate, 'yyyy-MM-dd'), format(endDate, 'yyyy-MM-dd')],
    queryFn: async () => {
      // Fetch meetings
      const { data: meetings, error } = await supabase
        .from('meeting_slots')
        .select(`
          *,
          closer:closers(id, name, email, color, google_calendar_id),
          deal:crm_deals(
            id, 
            name,
            contact:crm_contacts(id, name, phone, email)
          ),
          attendees:meeting_slot_attendees(
            id,
            deal_id,
            contact_id,
            attendee_name,
            attendee_phone,
            is_partner,
            status,
            notified_at,
            booked_by,
            notes,
            closer_notes,
            contact:crm_contacts(id, name, phone, email),
            deal:crm_deals(id, name)
          )
        `)
        .gte('scheduled_at', startDate.toISOString())
        .lte('scheduled_at', endDate.toISOString())
        .order('scheduled_at', { ascending: true });

      if (error) throw error;

      // Get unique booked_by IDs from meetings AND attendees to fetch SDR profiles
      const meetingBookedByIds = meetings?.map(m => m.booked_by).filter(Boolean) as string[];
      const attendeeBookedByIds = meetings?.flatMap(m => 
        (m.attendees || []).map((a: any) => a.booked_by).filter(Boolean)
      ) as string[];
      const bookedByIds = [...new Set([...meetingBookedByIds, ...attendeeBookedByIds])];
      
      let profilesMap: Record<string, { id: string; full_name: string | null; email: string | null }> = {};
      
      if (bookedByIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', bookedByIds);
        
        if (profiles) {
          profilesMap = profiles.reduce((acc, p) => {
            acc[p.id] = p;
            return acc;
          }, {} as Record<string, { id: string; full_name: string | null; email: string | null }>);
        }
      }

      // Map profiles to meetings and attendees
      const meetingsWithProfiles = meetings?.map(m => ({
        ...m,
        booked_by_profile: m.booked_by ? profilesMap[m.booked_by] : undefined,
        attendees: (m.attendees || []).map((a: any) => ({
          ...a,
          booked_by_profile: a.booked_by ? profilesMap[a.booked_by] : undefined,
        })),
      })) || [];

      return meetingsWithProfiles as MeetingSlot[];
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
      const { data: todayData } = await supabase
        .from('meeting_slots')
        .select('id, status')
        .gte('scheduled_at', todayStart.toISOString())
        .lte('scheduled_at', todayEnd.toISOString());

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

export function useUpcomingMeetings(date: Date) {
  const todayStart = new Date(date);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(date);
  todayEnd.setHours(23, 59, 59, 999);

  return useQuery({
    queryKey: ['upcoming-meetings', format(date, 'yyyy-MM-dd')],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meeting_slots')
        .select(`
          *,
          closer:closers(id, name, email, color),
          deal:crm_deals(
            id, 
            name,
            contact:crm_contacts(id, name, phone, email)
          )
        `)
        .gte('scheduled_at', todayStart.toISOString())
        .lte('scheduled_at', todayEnd.toISOString())
        .in('status', ['scheduled', 'rescheduled'])
        .order('scheduled_at', { ascending: true });

      if (error) throw error;
      return data as MeetingSlot[];
    },
  });
}

// ============ Closers Hooks ============

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
        .select('*');

      if (availError) throw availError;

      const closersWithAvailability: CloserWithAvailability[] = closers.map(closer => ({
        ...closer,
        color: closer.color || '#3B82F6',
        availability: (availability?.filter(a => a.closer_id === closer.id) || []).map(a => ({
          id: a.id,
          day_of_week: a.day_of_week,
          start_time: a.start_time,
          end_time: a.end_time,
          slot_duration_minutes: a.slot_duration_minutes,
          is_active: a.is_active,
          lead_type: (a.lead_type || 'A') as LeadType,
          max_slots_per_hour: a.max_slots_per_hour || 3,
        })),
      }));

      return closersWithAvailability;
    },
  });
}

export function useCloserMetrics(date: Date) {
  const weekStart = startOfWeek(date, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(date, { weekStartsOn: 1 });
  const todayStart = new Date(date);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(date);
  todayEnd.setHours(23, 59, 59, 999);

  return useQuery({
    queryKey: ['closer-metrics', format(date, 'yyyy-MM-dd')],
    queryFn: async () => {
      const { data: closers } = await supabase
        .from('closers')
        .select('id, name, color')
        .eq('is_active', true);

      const { data: availability } = await supabase
        .from('closer_availability')
        .select('*')
        .eq('is_active', true);

      const { data: todayMeetings } = await supabase
        .from('meeting_slots')
        .select('closer_id, status')
        .gte('scheduled_at', todayStart.toISOString())
        .lte('scheduled_at', todayEnd.toISOString());

      const { data: weekMeetings } = await supabase
        .from('meeting_slots')
        .select('closer_id, status')
        .gte('scheduled_at', weekStart.toISOString())
        .lte('scheduled_at', weekEnd.toISOString());

      const dayOfWeek = date.getDay() === 0 ? 7 : date.getDay();

      const metrics: CloserMetrics[] = (closers || []).map(closer => {
        const closerAvailability = availability?.filter(a => a.closer_id === closer.id && a.day_of_week === dayOfWeek) || [];
        
        let totalSlots = 0;
        closerAvailability.forEach(a => {
          const startHour = parseInt(a.start_time.split(':')[0]);
          const endHour = parseInt(a.end_time.split(':')[0]);
          const slotDuration = a.slot_duration_minutes || 60;
          totalSlots += Math.floor((endHour - startHour) * 60 / slotDuration);
        });

        const closerTodayMeetings = todayMeetings?.filter(m => m.closer_id === closer.id) || [];
        const closerWeekMeetings = weekMeetings?.filter(m => m.closer_id === closer.id) || [];
        const bookedSlots = closerTodayMeetings.length;
        const completed = closerWeekMeetings.filter(m => m.status === 'completed').length;
        const noShow = closerWeekMeetings.filter(m => m.status === 'no_show').length;
        const total = closerWeekMeetings.length;

        return {
          closerId: closer.id,
          closerName: closer.name,
          color: closer.color || '#3B82F6',
          totalSlots,
          bookedSlots,
          occupancyRate: totalSlots > 0 ? Math.round((bookedSlots / totalSlots) * 100) : 0,
          completedMeetings: completed,
          noShowMeetings: noShow,
          conversionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
        };
      });

      return metrics;
    },
  });
}

export function useUpdateCloserColor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ closerId, color }: { closerId: string; color: string }) => {
      const { error } = await supabase
        .from('closers')
        .update({ color })
        .eq('id', closerId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['closers-with-availability'] });
      queryClient.invalidateQueries({ queryKey: ['agenda-meetings'] });
      queryClient.invalidateQueries({ queryKey: ['closer-metrics'] });
      toast.success('Cor atualizada');
    },
    onError: () => {
      toast.error('Erro ao atualizar cor');
    },
  });
}

// ============ Blocked Dates Hooks ============

export function useBlockedDates(closerId?: string) {
  return useQuery({
    queryKey: ['blocked-dates', closerId],
    queryFn: async () => {
      let query = supabase
        .from('closer_blocked_dates')
        .select('*')
        .order('blocked_date', { ascending: true });

      if (closerId) {
        query = query.eq('closer_id', closerId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as BlockedDate[];
    },
  });
}

export function useAddBlockedDate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ closerId, date, reason }: { closerId: string; date: Date; reason?: string }) => {
      const { error } = await supabase
        .from('closer_blocked_dates')
        .insert({
          closer_id: closerId,
          blocked_date: format(date, 'yyyy-MM-dd'),
          reason,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blocked-dates'] });
      toast.success('Data bloqueada');
    },
    onError: () => {
      toast.error('Erro ao bloquear data');
    },
  });
}

export function useRemoveBlockedDate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (blockedDateId: string) => {
      const { error } = await supabase
        .from('closer_blocked_dates')
        .delete()
        .eq('id', blockedDateId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blocked-dates'] });
      toast.success('Bloqueio removido');
    },
    onError: () => {
      toast.error('Erro ao remover bloqueio');
    },
  });
}

// ============ Meeting Status Hooks ============

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
      queryClient.invalidateQueries({ queryKey: ['upcoming-meetings'] });
      queryClient.invalidateQueries({ queryKey: ['closer-metrics'] });
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
      leadType,
      availability,
    }: {
      closerId: string;
      leadType: LeadType;
      availability: {
        day_of_week: number;
        start_time: string;
        end_time: string;
        slot_duration_minutes: number;
        is_active: boolean;
        lead_type: LeadType;
        max_slots_per_hour: number;
      }[];
    }) => {
      // Delete only entries for this closer and lead type
      await supabase
        .from('closer_availability')
        .delete()
        .eq('closer_id', closerId)
        .eq('lead_type', leadType);

      if (availability.length > 0) {
        const { error } = await supabase
          .from('closer_availability')
          .insert(
            availability.map(a => ({
              closer_id: closerId,
              day_of_week: a.day_of_week,
              start_time: a.start_time,
              end_time: a.end_time,
              slot_duration_minutes: a.slot_duration_minutes,
              is_active: a.is_active,
              lead_type: a.lead_type,
              max_slots_per_hour: a.max_slots_per_hour,
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
      queryClient.invalidateQueries({ queryKey: ['upcoming-meetings'] });
      toast.success('Reunião cancelada');
    },
    onError: () => {
      toast.error('Erro ao cancelar reunião');
    },
  });
}

export function useUpdateMeetingNotes() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ meetingId, notes, field = 'notes' }: { meetingId: string; notes: string; field?: 'notes' | 'closer_notes' }) => {
      const updateData = field === 'closer_notes' ? { closer_notes: notes } : { notes };
      const { error } = await supabase
        .from('meeting_slots')
        .update(updateData)
        .eq('id', meetingId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agenda-meetings'] });
      toast.success('Notas salvas');
    },
    onError: () => {
      toast.error('Erro ao salvar notas');
    },
  });
}

// ============ Quick Schedule Hooks ============

export function useSearchDealsForSchedule(query: string) {
  return useQuery({
    queryKey: ['schedule-search', query],
    queryFn: async () => {
      if (!query || query.length < 2) return [];

      // 1. Buscar deals pelo nome do deal (case-insensitive)
      const { data: dealsByName } = await supabase
        .from('crm_deals')
        .select(`id, name, tags, contact:crm_contacts(id, name, phone, email)`)
        .ilike('name', `%${query}%`)
        .limit(10);

      // 2. Buscar contatos pelo nome ou telefone (case-insensitive)
      const normalizedQuery = query.replace(/\D/g, ''); // Remove non-digits for phone search
      const phoneFilter = normalizedQuery.length >= 4 ? `,phone.ilike.%${normalizedQuery}%` : '';
      
      const { data: contacts } = await supabase
        .from('crm_contacts')
        .select('id')
        .or(`name.ilike.%${query}%${phoneFilter}`)
        .limit(10);

      // 3. Se achou contatos, buscar os deals relacionados
      let dealsByContact: typeof dealsByName = [];
      if (contacts && contacts.length > 0) {
        const contactIds = contacts.map(c => c.id);
        const { data } = await supabase
          .from('crm_deals')
          .select(`id, name, tags, contact:crm_contacts(id, name, phone, email)`)
          .in('contact_id', contactIds)
          .limit(10);
        dealsByContact = data || [];
      }

      // 4. Combinar resultados sem duplicatas
      const allDeals = [...(dealsByName || []), ...dealsByContact];
      const uniqueDeals = allDeals.filter((deal, index, self) => 
        index === self.findIndex(d => d.id === deal.id)
      );

      return uniqueDeals.slice(0, 10);
    },
    enabled: query.length >= 2,
  });
}

export function useCreateMeeting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      closerId,
      dealId,
      contactId,
      scheduledAt,
      durationMinutes = 60,
      notes,
      leadType,
      sendNotification = true,
    }: {
      closerId: string;
      dealId: string;
      contactId?: string;
      scheduledAt: Date;
      durationMinutes?: number;
      notes?: string;
      leadType?: LeadType;
      sendNotification?: boolean;
    }) => {
      // Chamar a edge function que cria o evento no Google Calendar com Meet
      const { data, error } = await supabase.functions.invoke('calendly-create-event', {
        body: {
          closerId,
          dealId,
          contactId,
          scheduledAt: scheduledAt.toISOString(),
          durationMinutes,
          notes,
          leadType,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      return { ...data, sendNotification };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['agenda-meetings'] });
      queryClient.invalidateQueries({ queryKey: ['agenda-stats'] });
      queryClient.invalidateQueries({ queryKey: ['upcoming-meetings'] });
      queryClient.invalidateQueries({ queryKey: ['closer-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['slot-availability'] });
      toast.success('Reunião agendada com Google Meet');
    },
    onError: (error: any) => {
      console.error('Error creating meeting:', error);
      toast.error(error?.message || 'Erro ao agendar reunião');
    },
  });
}

// Hook to send meeting notifications
export function useSendMeetingNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ meetingSlotId, resendAttendeeId }: { meetingSlotId: string; resendAttendeeId?: string }) => {
      const { data, error } = await supabase.functions.invoke('send-meeting-notification', {
        body: { meetingSlotId, resendAttendeeId },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['agenda-meetings'] });
      if (data?.summary) {
        if (data.summary.sent > 0) {
          toast.success(`${data.summary.sent} notificação(ões) enviada(s)`);
        }
        if (data.summary.failed > 0) {
          toast.error(`${data.summary.failed} notificação(ões) falhou(aram)`);
        }
      }
    },
    onError: (error) => {
      console.error('Error sending notification:', error);
      toast.error('Erro ao enviar notificações');
    },
  });
}

// Hook to add attendee to a meeting
export function useAddMeetingAttendee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      meetingSlotId,
      dealId,
      contactId,
      attendeeName,
      attendeePhone,
      isPartner = false,
    }: {
      meetingSlotId: string;
      dealId?: string;
      contactId?: string;
      attendeeName?: string;
      attendeePhone?: string;
      isPartner?: boolean;
    }) => {
      const { error } = await supabase.from('meeting_slot_attendees').insert({
        meeting_slot_id: meetingSlotId,
        deal_id: dealId || null,
        contact_id: contactId || null,
        attendee_name: attendeeName || null,
        attendee_phone: attendeePhone || null,
        is_partner: isPartner,
        status: 'invited',
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agenda-meetings'] });
      toast.success('Participante adicionado');
    },
    onError: () => {
      toast.error('Erro ao adicionar participante');
    },
  });
}

// Hook to remove attendee from a meeting
export function useRemoveMeetingAttendee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (attendeeId: string) => {
      const { error } = await supabase
        .from('meeting_slot_attendees')
        .delete()
        .eq('id', attendeeId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agenda-meetings'] });
      toast.success('Participante removido');
    },
    onError: () => {
      toast.error('Erro ao remover participante');
    },
  });
}

// Hook to mark attendee as notified
export function useMarkAttendeeNotified() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (attendeeId: string) => {
      const { error } = await supabase
        .from('meeting_slot_attendees')
        .update({ notified_at: new Date().toISOString() })
        .eq('id', attendeeId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agenda-meetings'] });
    },
  });
}

// Check slot availability for a specific time and lead type
export function useCheckSlotAvailability(
  closerId: string | undefined,
  scheduledAt: Date | undefined,
  leadType: LeadType
) {
  return useQuery({
    queryKey: ['slot-availability', closerId, scheduledAt?.toISOString(), leadType],
    queryFn: async () => {
      if (!closerId || !scheduledAt) return null;

      const dayOfWeek = scheduledAt.getDay() === 0 ? 7 : scheduledAt.getDay();
      const hour = scheduledAt.getHours();

      // Get the max slots config for this closer/day/lead_type
      const { data: availability } = await supabase
        .from('closer_availability')
        .select('max_slots_per_hour')
        .eq('closer_id', closerId)
        .eq('day_of_week', dayOfWeek)
        .eq('lead_type', leadType)
        .eq('is_active', true)
        .limit(1)
        .single();

      const maxSlots = availability?.max_slots_per_hour || 3;

      // Count existing attendees in meetings for this hour and lead type
      const hourStart = new Date(scheduledAt);
      hourStart.setMinutes(0, 0, 0);
      const hourEnd = new Date(scheduledAt);
      hourEnd.setMinutes(59, 59, 999);

      // First get meeting IDs for this slot
      const { data: meetingIds } = await supabase
        .from('meeting_slots')
        .select('id')
        .eq('closer_id', closerId)
        .eq('lead_type', leadType)
        .gte('scheduled_at', hourStart.toISOString())
        .lte('scheduled_at', hourEnd.toISOString())
        .neq('status', 'canceled');

      // Count attendees in those meetings
      const ids = (meetingIds || []).map(m => m.id);
      let currentCount = 0;
      
      if (ids.length > 0) {
        const { count } = await supabase
          .from('meeting_slot_attendees')
          .select('id', { count: 'exact' })
          .in('meeting_slot_id', ids);
        currentCount = count || 0;
      }

      return {
        available: currentCount < maxSlots,
        currentCount,
        maxSlots,
      };
    },
    enabled: !!closerId && !!scheduledAt,
  });
}

export function useRescheduleMeeting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ meetingId, newDate, closerId }: { meetingId: string; newDate: Date; closerId?: string }) => {
      const updateData: Record<string, unknown> = {
        scheduled_at: newDate.toISOString(),
        status: 'rescheduled',
      };
      
      if (closerId) {
        updateData.closer_id = closerId;
      }

      const { error } = await supabase
        .from('meeting_slots')
        .update(updateData)
        .eq('id', meetingId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agenda-meetings'] });
      queryClient.invalidateQueries({ queryKey: ['agenda-stats'] });
      queryClient.invalidateQueries({ queryKey: ['upcoming-meetings'] });
      toast.success('Reunião reagendada');
    },
    onError: () => {
      toast.error('Erro ao reagendar reunião');
    },
  });
}

// ============ Meeting Schedule Update (for drag-and-drop) ============

export function useUpdateMeetingSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ meetingId, scheduledAt }: { meetingId: string; scheduledAt: string }) => {
      const { error } = await supabase
        .from('meeting_slots')
        .update({ scheduled_at: scheduledAt })
        .eq('id', meetingId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agenda-meetings'] });
      queryClient.invalidateQueries({ queryKey: ['agenda-stats'] });
      queryClient.invalidateQueries({ queryKey: ['upcoming-meetings'] });
      queryClient.invalidateQueries({ queryKey: ['closer-metrics'] });
      toast.success('Reunião reagendada');
    },
    onError: () => {
      toast.error('Erro ao reagendar reunião');
    },
  });
}

export function useDeleteMeeting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (meetingId: string) => {
      // Primeiro deletar os attendees relacionados
      await supabase
        .from('meeting_slot_attendees')
        .delete()
        .eq('meeting_slot_id', meetingId);

      // Depois deletar a reunião
      const { error } = await supabase
        .from('meeting_slots')
        .delete()
        .eq('id', meetingId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agenda-meetings'] });
      queryClient.invalidateQueries({ queryKey: ['agenda-stats'] });
      queryClient.invalidateQueries({ queryKey: ['upcoming-meetings'] });
      queryClient.invalidateQueries({ queryKey: ['closer-metrics'] });
      toast.success('Reunião excluída');
    },
    onError: () => {
      toast.error('Erro ao excluir reunião');
    },
  });
}

// ============ Attendee Status and Notes Hooks ============

export function useUpdateAttendeeStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ attendeeId, status }: { attendeeId: string; status: string }) => {
      const { error } = await supabase
        .from('meeting_slot_attendees')
        .update({ status })
        .eq('id', attendeeId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agenda-meetings'] });
      toast.success('Status atualizado');
    },
    onError: () => {
      toast.error('Erro ao atualizar status');
    },
  });
}

export function useUpdateAttendeeNotes() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      attendeeId, 
      field, 
      notes 
    }: { 
      attendeeId: string; 
      field: 'notes' | 'closer_notes'; 
      notes: string;
    }) => {
      const { error } = await supabase
        .from('meeting_slot_attendees')
        .update({ [field]: notes })
        .eq('id', attendeeId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agenda-meetings'] });
      toast.success('Nota salva');
    },
    onError: () => {
      toast.error('Erro ao salvar nota');
    },
  });
}
