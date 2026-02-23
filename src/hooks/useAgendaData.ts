import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfWeek, endOfWeek, format, addDays, isSameDay, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { WEEK_STARTS_ON } from '@/lib/businessDays';
import { getDealStatusFromStage } from '@/lib/dealStatusHelper';

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
  parent_attendee_id?: string | null;
  already_builds: boolean | null;
  contract_paid_at?: string | null;
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
  parent_attendee?: {
    id: string;
    attendee_name: string | null;
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
  meeting_duration_minutes: number;
  max_leads_per_slot: number;
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
  blocked_start_time: string | null;
  blocked_end_time: string | null;
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

export function useAgendaMeetings(
  startDate: Date, 
  endDate: Date, 
  meetingType: 'r1' | 'r2' | 'all' = 'r1',
  closerIds?: string[]
) {
  return useQuery({
    queryKey: ['agenda-meetings', format(startDate, 'yyyy-MM-dd'), format(endDate, 'yyyy-MM-dd'), meetingType, closerIds],
    queryFn: async () => {
      // Fetch meetings
      let query = supabase
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
            parent_attendee_id,
            already_builds,
            contract_paid_at,
            contact:crm_contacts(id, name, phone, email),
            deal:crm_deals(id, name),
            parent_attendee:meeting_slot_attendees!parent_attendee_id(
              id,
              attendee_name,
              status,
              meeting_slot:meeting_slots(
                scheduled_at,
                closer:closers(id, name)
              )
            )
          )
        `)
        .gte('scheduled_at', startDate.toISOString())
        .lte('scheduled_at', endDate.toISOString());
      
      // Filter by meeting type (default r1 to avoid R2 meetings showing in R1 agenda)
      if (meetingType !== 'all') {
        query = query.eq('meeting_type', meetingType);
      }
      
      // Filter by specific closers (BU isolation)
      if (closerIds && closerIds.length > 0) {
        query = query.in('closer_id', closerIds);
      }
      
      const { data: meetings, error } = await query.order('scheduled_at', { ascending: true });

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
  const weekStart = startOfWeek(date, { weekStartsOn: WEEK_STARTS_ON });
  const weekEnd = endOfWeek(date, { weekStartsOn: WEEK_STARTS_ON });
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

export function useClosersWithAvailability(buFilter?: string | null) {
  return useQuery({
    queryKey: ['closers-with-availability', buFilter],
    queryFn: async () => {
      let query = supabase
        .from('closers')
        .select('*')
        .eq('is_active', true)
        .or('meeting_type.is.null,meeting_type.eq.r1');
      
      // Filtrar por BU se especificado
      if (buFilter) {
        query = query.eq('bu', buFilter);
      }
      
      const { data: closers, error: closersError } = await query.order('name');

      if (closersError) throw closersError;

      const { data: availability, error: availError } = await supabase
        .from('closer_availability')
        .select('*');

      if (availError) throw availError;

      const closersWithAvailability: CloserWithAvailability[] = closers.map(closer => ({
        ...closer,
        color: closer.color || '#3B82F6',
        meeting_duration_minutes: (closer as any).meeting_duration_minutes ?? 45,
        max_leads_per_slot: (closer as any).max_leads_per_slot ?? 4,
        availability: (availability?.filter(a => a.closer_id === closer.id) || []).map(a => ({
          id: a.id,
          day_of_week: a.day_of_week,
          start_time: a.start_time,
          end_time: a.end_time,
          slot_duration_minutes: a.slot_duration_minutes,
          is_active: a.is_active,
          lead_type: (a.lead_type || 'A') as LeadType,
          max_slots_per_hour: a.max_slots_per_hour || 4,
        })),
      }));

      return closersWithAvailability;
    },
  });
}

export function useCloserMetrics(date: Date) {
  const weekStart = startOfWeek(date, { weekStartsOn: WEEK_STARTS_ON });
  const weekEnd = endOfWeek(date, { weekStartsOn: WEEK_STARTS_ON });
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

      const dayOfWeek = date.getDay();

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

export function useUpdateCloserSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ closerId, data }: { closerId: string; data: Record<string, any> }) => {
      const { error } = await supabase
        .from('closers')
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('id', closerId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['closers-with-availability'] });
      queryClient.invalidateQueries({ queryKey: ['agenda-closers'] });
      queryClient.invalidateQueries({ queryKey: ['closers-list'] });
    },
    onError: () => {
      toast.error('Erro ao salvar configuração');
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
    mutationFn: async ({ closerId, date, reason, blocked_start_time, blocked_end_time }: { 
      closerId: string; 
      date: Date; 
      reason?: string;
      blocked_start_time?: string;
      blocked_end_time?: string;
    }) => {
      const { error } = await supabase
        .from('closer_blocked_dates')
        .insert({
          closer_id: closerId,
          blocked_date: format(date, 'yyyy-MM-dd'),
          reason,
          blocked_start_time: blocked_start_time || null,
          blocked_end_time: blocked_end_time || null,
        } as any);

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

// ============ Mark Contract Paid Hook ============

export function useMarkContractPaid() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ meetingId, attendeeId }: { meetingId: string; attendeeId?: string }) => {
      // Buscar a data da reunião para usar como contract_paid_at
      const { data: meetingData } = await supabase
        .from('meeting_slots')
        .select('scheduled_at')
        .eq('id', meetingId)
        .single();

      const contractPaidAt = meetingData?.scheduled_at || new Date().toISOString();

      // Update only the attendee status (not the meeting slot)
      // This allows other attendees in the same meeting to still appear in search
      if (attendeeId) {
        const { error: attendeeError } = await supabase
          .from('meeting_slot_attendees')
          .update({ 
            status: 'contract_paid',
            contract_paid_at: contractPaidAt // Usar data da reunião, não data atual
          })
          .eq('id', attendeeId);

        if (attendeeError) throw attendeeError;

        // Check if ALL attendees in this meeting are now paid
        const { data: attendees } = await supabase
          .from('meeting_slot_attendees')
          .select('status')
          .eq('meeting_slot_id', meetingId);

        const allPaid = attendees?.every(a => a.status === 'contract_paid');

        // Only update meeting status if all attendees are paid
        if (allPaid) {
          const { error: meetingError } = await supabase
            .from('meeting_slots')
            .update({ status: 'contract_paid' })
            .eq('id', meetingId);

          if (meetingError) throw meetingError;
        }
      } else {
        // Fallback: update meeting status directly if no attendeeId provided
        const { error: meetingError } = await supabase
          .from('meeting_slots')
          .update({ status: 'contract_paid' })
          .eq('id', meetingId);

        if (meetingError) throw meetingError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agenda-meetings'] });
      queryClient.invalidateQueries({ queryKey: ['agenda-stats'] });
      queryClient.invalidateQueries({ queryKey: ['upcoming-meetings'] });
      queryClient.invalidateQueries({ queryKey: ['search-past-meetings'] });
      queryClient.invalidateQueries({ queryKey: ['closer-metrics'] });
      toast.success('Contrato marcado como pago!');
    },
    onError: () => {
      toast.error('Erro ao marcar contrato como pago');
    },
  });
}

// ============ Quick Schedule Hooks ============

// Search deals by phone number directly
export function useSearchDealsByPhone(phoneQuery: string) {
  return useQuery({
    queryKey: ['schedule-search-phone', phoneQuery],
    queryFn: async () => {
  const digits = phoneQuery.replace(/\D/g, '');
    if (digits.length < 6) return [];

      // Buscar contatos pelo telefone
      const { data: contacts } = await supabase
        .from('crm_contacts')
        .select('id')
        .ilike('phone', `%${digits}%`)
        .limit(10);

      if (!contacts || contacts.length === 0) return [];

      // Buscar deals dos contatos encontrados
      const { data: deals } = await supabase
        .from('crm_deals')
        .select(`id, name, tags, contact:crm_contacts(id, name, phone, email), stage:crm_stages(id, stage_name)`)
        .in('contact_id', contacts.map(c => c.id))
        .limit(10);

      // Normalizar contact e stage (podem vir como array)
      return (deals || []).map(deal => ({
        ...deal,
        contact: Array.isArray(deal.contact) ? deal.contact[0] : deal.contact,
        stage: Array.isArray(deal.stage) ? deal.stage[0] : deal.stage
      }));
    },
    enabled: phoneQuery.replace(/\D/g, '').length >= 6,
  });
}

export function useSearchDealsByEmail(emailQuery: string) {
  return useQuery({
    queryKey: ['schedule-search-email', emailQuery],
    queryFn: async () => {
      if (emailQuery.length < 3) return [];

      // Buscar contatos pelo email
      const { data: contacts } = await supabase
        .from('crm_contacts')
        .select('id')
        .ilike('email', `%${emailQuery}%`)
        .limit(10);

      if (!contacts || contacts.length === 0) return [];

      // Buscar deals dos contatos encontrados
      const { data: deals } = await supabase
        .from('crm_deals')
        .select(`id, name, tags, contact:crm_contacts(id, name, phone, email), stage:crm_stages(id, stage_name)`)
        .in('contact_id', contacts.map(c => c.id))
        .limit(10);

      // Normalizar contact e stage (podem vir como array)
      return (deals || []).map(deal => ({
        ...deal,
        contact: Array.isArray(deal.contact) ? deal.contact[0] : deal.contact,
        stage: Array.isArray(deal.stage) ? deal.stage[0] : deal.stage
      }));
    },
    enabled: emailQuery.length >= 3,
  });
}

export function useSearchDealsForSchedule(query: string, originIds?: string[]) {
  return useQuery({
    queryKey: ['schedule-search', query, originIds],
    queryFn: async () => {
      if (!query || query.length < 2) return [];

      // 1. Buscar deals pelo nome do deal (case-insensitive)
      let dealsQuery = supabase
        .from('crm_deals')
        .select(`id, name, tags, contact:crm_contacts(id, name, phone, email), stage:crm_stages(id, stage_name)`)
        .ilike('name', `%${query}%`);
      
      // Filtrar por origin_id se especificado
      if (originIds && originIds.length > 0) {
        dealsQuery = dealsQuery.in('origin_id', originIds);
      }
      
      const { data: dealsByName } = await dealsQuery.limit(10);

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
        let contactDealsQuery = supabase
          .from('crm_deals')
          .select(`id, name, tags, contact:crm_contacts(id, name, phone, email), stage:crm_stages(id, stage_name)`)
          .in('contact_id', contactIds);
        
        // Filtrar por origin_id se especificado
        if (originIds && originIds.length > 0) {
          contactDealsQuery = contactDealsQuery.in('origin_id', originIds);
        }
        
        const { data } = await contactDealsQuery.limit(10);
        dealsByContact = data || [];
      }

      // 4. Combinar resultados sem duplicatas
      const allDeals = [...(dealsByName || []), ...dealsByContact];
      const uniqueDeals = allDeals.filter((deal, index, self) => 
        index === self.findIndex(d => d.id === deal.id)
      );

      // 5. Normalizar contact e stage (podem vir como array do Supabase)
      const normalizedDeals = uniqueDeals.map(deal => ({
        ...deal,
        contact: Array.isArray(deal.contact) ? deal.contact[0] : deal.contact,
        stage: Array.isArray(deal.stage) ? deal.stage[0] : deal.stage
      }));

      // 6. Buscar o último attendee de cada deal para vincular reagendamentos
      const dealIds = normalizedDeals.map(d => d.id);
      let lastAttendeeMap: Record<string, { id: string; status: string }> = {};
      
      if (dealIds.length > 0) {
        const { data: lastAttendees } = await supabase
          .from('meeting_slot_attendees')
          .select('id, deal_id, status')
          .in('deal_id', dealIds)
          .in('status', ['no_show', 'invited', 'scheduled'])
          .order('created_at', { ascending: false });
        
        // Pegar apenas o mais recente de cada deal
        if (lastAttendees) {
          lastAttendees.forEach(att => {
            if (att.deal_id && !lastAttendeeMap[att.deal_id]) {
              lastAttendeeMap[att.deal_id] = { id: att.id, status: att.status };
            }
          });
        }
      }

      // 7. Filtrar deals finalizados (won/lost) - apenas retornar deals abertos
      const openDeals = normalizedDeals.filter(deal => {
        const stageName = deal.stage?.stage_name;
        const status = getDealStatusFromStage(stageName);
        return status === 'open'; // Excluir 'won' e 'lost'
      });

      // 8. Adicionar informação do último attendee aos deals
      const dealsWithLastAttendee = openDeals.map(deal => ({
        ...deal,
        lastAttendee: lastAttendeeMap[deal.id] || null
      }));

      return dealsWithLastAttendee.slice(0, 10);
    },
    enabled: query.length >= 2,
  });
}

// Hook to search weekly meeting leads with optional BU closer filtering
export function useSearchWeeklyMeetingLeads(statusFilter?: string, closerIds?: string[]) {
  return useQuery({
    queryKey: ['weekly-meeting-leads', statusFilter, closerIds],
    queryFn: async () => {
      const now = new Date();
      const weekStart = startOfWeek(now, { weekStartsOn: WEEK_STARTS_ON });
      const weekEnd = endOfWeek(now, { weekStartsOn: WEEK_STARTS_ON });
      
      let query = supabase
        .from('meeting_slot_attendees')
        .select(`
          id,
          status,
          deal_id,
          meeting_slot_id,
          notes,
          meeting_slots!inner(
            scheduled_at,
            closer_id,
            closer:closers(name)
          )
        `)
        .gte('meeting_slots.scheduled_at', weekStart.toISOString())
        .lte('meeting_slots.scheduled_at', weekEnd.toISOString());
      
      if (statusFilter && statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }
      
      // Filter by specific closers (BU isolation)
      if (closerIds && closerIds.length > 0) {
        query = query.in('meeting_slots.closer_id', closerIds);
      }
      
      const { data: attendees, error } = await query.order('meeting_slots(scheduled_at)', { ascending: false });
      
      if (error) throw error;
      
      // Buscar dados dos deals
      const dealIds = [...new Set(attendees?.map(a => a.deal_id).filter(Boolean))];
      
      let deals: any[] = [];
      if (dealIds.length > 0) {
        const { data } = await supabase
          .from('crm_deals')
          .select(`id, name, tags, contact:crm_contacts(id, name, phone, email)`)
          .in('id', dealIds);
        deals = data || [];
      }
      
      // Combinar dados
      return (attendees || []).map(a => {
        const deal = deals.find(d => d.id === a.deal_id);
        const meetingSlot = a.meeting_slots as any;
        return {
          id: a.id,
          status: a.status,
          deal_id: a.deal_id,
          scheduled_at: meetingSlot?.scheduled_at,
          closer_name: meetingSlot?.closer?.name || 'Sem closer',
          original_notes: a.notes,
          deal: deal ? {
            ...deal,
            contact: Array.isArray(deal.contact) ? deal.contact[0] : deal.contact
          } : null
        };
      });
    },
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
      sdrEmail,
      alreadyBuilds,
      parentAttendeeId,
      bookedAt,
    }: {
      closerId: string;
      dealId: string;
      contactId?: string;
      scheduledAt: Date;
      durationMinutes?: number;
      notes?: string;
      leadType?: LeadType;
      sendNotification?: boolean;
      sdrEmail?: string;
      alreadyBuilds?: boolean | null;
      parentAttendeeId?: string;
      bookedAt?: Date;
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
          sdrEmail,
          alreadyBuilds,
          parentAttendeeId,
          bookedAt: bookedAt?.toISOString(),
        },
      });

      console.log('📅 Create meeting response:', { data, error });

      // Handle errors
      if (data && (data.error || data.success === false)) {
        if (data.error === 'Closer not found') {
          throw new Error('Closer não encontrado');
        }
        throw new Error(data.error || 'Erro ao agendar reunião');
      }
      
      if (error) {
        throw error;
      }

      return { ...data, sendNotification };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['agenda-meetings'] });
      queryClient.invalidateQueries({ queryKey: ['agenda-stats'] });
      queryClient.invalidateQueries({ queryKey: ['upcoming-meetings'] });
      queryClient.invalidateQueries({ queryKey: ['closer-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['slot-availability'] });
      queryClient.invalidateQueries({ queryKey: ['weekly-meeting-leads'] });
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
      parentAttendeeId,
    }: {
      meetingSlotId: string;
      dealId?: string;
      contactId?: string;
      attendeeName?: string;
      attendeePhone?: string;
      isPartner?: boolean;
      parentAttendeeId?: string;
    }) => {
      // Se for sócio, herdar booked_by e deal_id do parent
      let inheritedBookedBy: string | null = null;
      let inheritedDealId: string | null = null;
      if (parentAttendeeId) {
        const { data: parentData } = await supabase
          .from('meeting_slot_attendees')
          .select('booked_by, deal_id')
          .eq('id', parentAttendeeId)
          .maybeSingle();
        
        inheritedBookedBy = parentData?.booked_by || null;
        inheritedDealId = parentData?.deal_id || null;
      }

      const { error } = await supabase.from('meeting_slot_attendees').insert({
        meeting_slot_id: meetingSlotId,
        deal_id: dealId || inheritedDealId || null,
        contact_id: contactId || null,
        attendee_name: attendeeName || null,
        attendee_phone: attendeePhone || null,
        is_partner: isPartner,
        status: 'invited',
        parent_attendee_id: parentAttendeeId || null,
        booked_by: inheritedBookedBy,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ['agenda-meetings'] });
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
      return attendeeId;
    },
    onMutate: async (attendeeId) => {
      await queryClient.cancelQueries({ queryKey: ['agenda-meetings'] });
      
      const previousMeetings = queryClient.getQueriesData({ queryKey: ['agenda-meetings'] });
      
      queryClient.setQueriesData({ queryKey: ['agenda-meetings'] }, (old: MeetingSlot[] | undefined) => {
        if (!old) return old;
        return old.map((meeting) => ({
          ...meeting,
          attendees: meeting.attendees?.filter((a) => a.id !== attendeeId) || [],
        }));
      });
      
      return { previousMeetings };
    },
    onError: (_err, _attendeeId, context) => {
      if (context?.previousMeetings) {
        context.previousMeetings.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      toast.error('Erro ao remover participante');
    },
    onSuccess: () => {
      toast.success('Participante removido');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['agenda-meetings'] });
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
      queryClient.refetchQueries({ queryKey: ['agenda-meetings'] });
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

      // Get attendees in those meetings (including already_builds field)
      const ids = (meetingIds || []).map(m => m.id);
      let attendees: { id: string; already_builds: boolean | null; attendee_name: string | null }[] = [];
      
      if (ids.length > 0) {
        const { data } = await supabase
          .from('meeting_slot_attendees')
          .select('id, already_builds, attendee_name')
          .in('meeting_slot_id', ids);
        attendees = data || [];
      }

      // Always available - no limit on attendees
      return {
        available: true,
        currentCount: attendees.length,
        attendees,
      };
    },
    enabled: !!closerId && !!scheduledAt,
  });
}

export function useRescheduleMeeting() {
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
      // 1. Buscar dados originais do meeting e attendees
      const { data: meeting } = await supabase
        .from('meeting_slots')
        .select(`
          scheduled_at, 
          attendees:meeting_slot_attendees(id, notes)
        `)
        .eq('id', meetingId)
        .single();

      // 2. Atualizar o meeting_slot
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

      // 3. Para cada attendee, atualizar a nota preservando histórico
      if (meeting?.attendees && rescheduleNote) {
        const oldDate = format(new Date(meeting.scheduled_at), "dd/MM 'às' HH:mm", { locale: ptBR });
        const newDateFormatted = format(newDate, "dd/MM 'às' HH:mm", { locale: ptBR });
        const historyEntry = `\n\n--- Reagendado em ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR })} ---\nDe: ${oldDate} → Para: ${newDateFormatted}\nMotivo: ${rescheduleNote}`;
        
        for (const attendee of meeting.attendees) {
          const updatedNote = (attendee.notes || '') + historyEntry;
          await supabase
            .from('meeting_slot_attendees')
            .update({ notes: updatedNote })
            .eq('id', attendee.id);
        }
      }
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

// Helper function to sync deal stage from agenda status
// Also handles ownership transfer: completed/contract_paid -> closer becomes owner
// Preserves complete ownership chain: SDR → Closer R1 → Closer R2
export async function syncDealStageFromAgenda(
  dealId: string, 
  agendaStatus: string,
  meetingType: 'r1' | 'r2' = 'r1',
  closerEmail?: string  // optional closer email for ownership transfer
): Promise<void> {
  try {
    // 1. Fetch deal to get origin_id and current stage (including new closer fields)
    const { data: deal, error: dealError } = await supabase
      .from('crm_deals')
      .select('origin_id, stage_id, owner_id, original_sdr_email, r1_closer_email, r2_closer_email')
      .eq('id', dealId)
      .single();

    // 1b. Fetch all active closers to determine if current owner is a closer
    const { data: closersList } = await supabase
      .from('closers')
      .select('email')
      .eq('is_active', true);
    
    const closerEmails = closersList?.map(c => c.email.toLowerCase()) || [];

    if (dealError || !deal) {
      console.warn('Deal not found for CRM sync:', dealId);
      return;
    }

    // 2. Map agenda status to target stage name
    // R2 No-Shows go to a separate stage so SDRs don't see them
    const stageNameMap: Record<string, string[]> = {
      'no_show': meetingType === 'r2'
        ? ['No-Show R2', 'No-Show Closer', 'NO-SHOW R2', 'No-show R2']
        : ['No-Show', 'NO-SHOW', 'No-show', 'NoShow'],
      'rescheduled': meetingType === 'r2'
        ? ['Reunião 02 Agendada', 'Reunião 02 Agendado', 'Reunião 2 Agendada', 'R2 Agendada', 'REUNIÃO 2 AGENDADA']
        : ['Reunião 01 Agendada', 'Reunião 1 Agendada', 'R1 Agendada', 'REUNIÃO 1 AGENDADA'],
      'completed': meetingType === 'r2' 
        ? ['Reunião 02 Realizada', 'Reunião 2 Realizada', 'R2 Realizada', 'REUNIÃO 2 REALIZADA']
        : ['Reunião 01 Realizada', 'Reunião 1 Realizada', 'R1 Realizada', 'REUNIÃO 1 REALIZADA'],
      'contract_paid': ['Contrato Pago', 'CONTRATO PAGO', 'Contrato pago'],
      'r2_scheduled': ['Reunião 02 Agendada', 'Reunião 02 Agendado', 'Reunião 2 Agendada', 'R2 Agendada', 'REUNIÃO 2 AGENDADA'],
    };

    const targetStageNames = stageNameMap[agendaStatus];
    if (!targetStageNames) return;

    // 3. Find matching stage in the same origin/pipeline
    let targetStage: { id: string } | null = null;
    
    for (const stageName of targetStageNames) {
      const { data } = await supabase
        .from('crm_stages')
        .select('id')
        .eq('origin_id', deal.origin_id)
        .ilike('stage_name', stageName)
        .limit(1);
      
      if (data && data.length > 0) {
        targetStage = data[0];
        break;
      }
    }

    if (!targetStage) {
      console.warn(`No matching stage found for status "${agendaStatus}" in origin ${deal.origin_id}`);
      return;
    }

    // 4. Determine if we should transfer ownership
    // Transfer ownership to closer when: completed, contract_paid, or R2 no_show
    // R2 no-shows stay with closer so Yanca (coordinator) can reschedule them
    const ownershipTransferStatuses = ['completed', 'contract_paid'];
    const isR2NoShow = meetingType === 'r2' && agendaStatus === 'no_show';
    const shouldTransferOwnership = (ownershipTransferStatuses.includes(agendaStatus) || isR2NoShow) && closerEmail;

    // 5. Skip if already in target stage AND no ownership transfer needed
    if (deal.stage_id === targetStage.id && !shouldTransferOwnership) return;

    // 6. Build update object
    const updateData: Record<string, unknown> = {};
    
    if (deal.stage_id !== targetStage.id) {
      updateData.stage_id = targetStage.id;
    }
    
    // Transfer ownership to closer for completed/contract_paid
    // No-show keeps the SDR as owner so they can reschedule
    // Preserve complete ownership chain: SDR → Closer R1 → Closer R2
    if (shouldTransferOwnership) {
      const currentOwnerLower = deal.owner_id?.toLowerCase() || '';
      const isOwnerCloser = closerEmails.includes(currentOwnerLower);
      
      // Preserve original SDR email only if:
      // 1. Not already set
      // 2. Current owner exists  
      // 3. Current owner is NOT a closer (R1 or R2)
      if (!deal.original_sdr_email && deal.owner_id && !isOwnerCloser) {
        updateData.original_sdr_email = deal.owner_id;
        console.log(`Preserved original SDR: ${deal.owner_id}`);
      }
      
      // Save R1 closer email when R1 meeting is completed
      if (meetingType === 'r1' && !deal.r1_closer_email && closerEmail) {
        updateData.r1_closer_email = closerEmail;
        console.log(`Saved R1 Closer: ${closerEmail}`);
      }
      
      // Save R2 closer email when R2 meeting is completed  
      if (meetingType === 'r2' && !deal.r2_closer_email && closerEmail) {
        updateData.r2_closer_email = closerEmail;
        console.log(`Saved R2 Closer: ${closerEmail}`);
      }
      
      // Buscar profile_id do closer para manter owner_profile_id sincronizado
      const { data: closerProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', closerEmail)
        .maybeSingle();
      
      updateData.owner_id = closerEmail;
      if (closerProfile) {
        updateData.owner_profile_id = closerProfile.id;
      }
      console.log(`Ownership transfer: Deal ${dealId} -> ${closerEmail} (profile: ${closerProfile?.id || 'not found'}, status: ${agendaStatus}, type: ${meetingType})`);
    }

    if (Object.keys(updateData).length === 0) return;

    // 7. Update deal
    const { error: updateError } = await supabase
      .from('crm_deals')
      .update(updateData)
      .eq('id', dealId);

    if (updateError) {
      console.error('Failed to update deal:', updateError);
      return;
    }

    // 8. Log activity
    await supabase
      .from('deal_activities')
      .insert({
        deal_id: dealId,
        activity_type: 'stage_change',
        description: shouldTransferOwnership 
          ? `Status atualizado via Agenda: ${agendaStatus}. Responsável transferido para Closer.`
          : `Status atualizado via Agenda: ${agendaStatus}`,
        from_stage: deal.stage_id,
        to_stage: targetStage.id,
        metadata: { 
          via: 'agenda_sync', 
          status: agendaStatus, 
          meetingType,
          ownershipTransferred: shouldTransferOwnership,
          newOwner: shouldTransferOwnership ? closerEmail : undefined,
          previousOwner: shouldTransferOwnership ? deal.owner_id : undefined,
        }
      });
    
    console.log(`CRM synced: Deal ${dealId} moved to stage ${targetStage.id} (${agendaStatus})${shouldTransferOwnership ? ` - owner: ${closerEmail}` : ''}`);
  } catch (error) {
    console.error('Error syncing deal stage from agenda:', error);
  }
}

// Combined mutation to update attendee AND meeting slot status atomically
// This prevents race conditions where the cache is invalidated with inconsistent data
// Also syncs the deal stage in CRM when status changes
export function useUpdateAttendeeAndSlotStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      attendeeId, 
      status, 
      meetingId,
      syncSlot = false,
      meetingType = 'r1'
    }: { 
      attendeeId: string; 
      status: string;
      meetingId?: string;
      syncSlot?: boolean;
      meetingType?: 'r1' | 'r2';
    }) => {
      // 1. Fetch attendee to get deal_id and meeting_slot_id for CRM sync
      const { data: attendee } = await supabase
        .from('meeting_slot_attendees')
        .select('deal_id, meeting_slot_id')
        .eq('id', attendeeId)
        .single();

      // 2. Fetch closer email for ownership transfer
      let closerEmail: string | undefined;
      if (attendee?.meeting_slot_id) {
        const { data: slot } = await supabase
          .from('meeting_slots')
          .select('closer:closers(email)')
          .eq('id', attendee.meeting_slot_id)
          .single();
        
        const closer = slot?.closer as { email: string } | null;
        closerEmail = closer?.email;
      }

      // 3. Update attendee status
      const updateData: { status: string; contract_paid_at?: string } = { status };
      
      // Se o status for contract_paid, registrar timestamp do pagamento
      if (status === 'contract_paid') {
        updateData.contract_paid_at = new Date().toISOString();
      }
      
      const { error: attendeeError } = await supabase
        .from('meeting_slot_attendees')
        .update(updateData)
        .eq('id', attendeeId);

      if (attendeeError) throw attendeeError;

      // 4. Optionally sync meeting_slots status (for principal participants)
      if (syncSlot && meetingId) {
        const { error: slotError } = await supabase
          .from('meeting_slots')
          .update({ status })
          .eq('id', meetingId);

        if (slotError) throw slotError;
      }

      // 5. Sync deal stage in CRM if applicable (with ownership transfer)
      const statusesToSync = ['no_show', 'completed', 'contract_paid'];
      if (attendee?.deal_id && statusesToSync.includes(status)) {
        await syncDealStageFromAgenda(attendee.deal_id, status, meetingType, closerEmail);
      }
    },
    onSuccess: () => {
      // Invalidate all relevant queries (R1 + R2)
      queryClient.invalidateQueries({ queryKey: ['agenda-meetings'] });
      queryClient.invalidateQueries({ queryKey: ['agenda-stats'] });
      queryClient.invalidateQueries({ queryKey: ['upcoming-meetings'] });
      queryClient.invalidateQueries({ queryKey: ['closer-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['crm-deals'] });
      queryClient.invalidateQueries({ queryKey: ['r2-agenda-meetings'] });
      queryClient.invalidateQueries({ queryKey: ['r2-meetings-extended'] });
      toast.success('Status atualizado');
    },
    onError: () => {
      toast.error('Erro ao atualizar status');
    },
  });
}

// syncDealStageFromAgenda is now exported directly in its declaration

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

export function useUpdateAttendeePhone() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ attendeeId, phone }: { attendeeId: string; phone: string }) => {
      const { error } = await supabase
        .from('meeting_slot_attendees')
        .update({ attendee_phone: phone })
        .eq('id', attendeeId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agenda-meetings'] });
      toast.success('Telefone atualizado');
    },
    onError: () => {
      toast.error('Erro ao atualizar telefone');
    },
  });
}

// ============ Move Attendee to Another Meeting ============

export function useMoveAttendeeToMeeting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      attendeeId, 
      targetMeetingSlotId,
      currentMeetingId,
      currentMeetingDate,
      currentAttendeeStatus,
      currentCloserId,
      currentCloserName,
      targetCloserId,
      targetCloserName,
      targetScheduledAt,
      reason,
      isNoShow,
      preserveStatus
    }: { 
      attendeeId: string; 
      targetMeetingSlotId: string;
      currentMeetingId?: string;
      currentMeetingDate?: string;
      currentAttendeeStatus?: string;
      currentCloserId?: string;
      currentCloserName?: string;
      targetCloserId?: string;
      targetCloserName?: string;
      targetScheduledAt?: string;
      reason?: string;
      isNoShow?: boolean;
      preserveStatus?: boolean;
    }) => {
      // Admin preserva status original (contract_paid, completed, etc)
      const shouldPreserve = preserveStatus && 
        ['contract_paid', 'completed', 'refunded', 'approved', 'rejected'].includes(currentAttendeeStatus || '');

      // Move the main attendee and update status
      const { error: mainError } = await supabase
        .from('meeting_slot_attendees')
        .update({ 
          meeting_slot_id: targetMeetingSlotId,
          status: shouldPreserve ? currentAttendeeStatus : 'rescheduled',
          is_reschedule: !shouldPreserve,
          updated_at: new Date().toISOString()
        })
        .eq('id', attendeeId);

      if (mainError) throw mainError;

      // Move any partners linked to this attendee
      const { error: partnersError } = await supabase
        .from('meeting_slot_attendees')
        .update({ meeting_slot_id: targetMeetingSlotId })
        .eq('parent_attendee_id', attendeeId);

      if (partnersError) throw partnersError;

      // Log the movement
      const { data: authData } = await supabase.auth.getUser();
      let movedByName = null;
      
      if (authData?.user?.id) {
        const { data: userProfile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', authData.user.id)
          .single();
        movedByName = userProfile?.full_name;
      }

      await supabase.from('attendee_movement_logs').insert({
        attendee_id: attendeeId,
        from_slot_id: currentMeetingId || null,
        to_slot_id: targetMeetingSlotId,
        from_scheduled_at: currentMeetingDate || null,
        to_scheduled_at: targetScheduledAt || new Date().toISOString(),
        from_closer_id: currentCloserId || null,
        from_closer_name: currentCloserName || null,
        to_closer_id: targetCloserId || null,
        to_closer_name: targetCloserName || null,
        previous_status: currentAttendeeStatus || null,
        reason: reason || null,
        movement_type: shouldPreserve ? 'transfer_preserved' : (isNoShow ? 'no_show_reschedule' : 'same_day_reschedule'),
        moved_by: authData?.user?.id || null,
        moved_by_name: movedByName
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agenda-meetings'] });
      queryClient.invalidateQueries({ queryKey: ['agenda-stats'] });
      queryClient.invalidateQueries({ queryKey: ['attendee-movement-history'] });
      queryClient.invalidateQueries({ queryKey: ['sdr-meetings-from-agenda'] });
      queryClient.invalidateQueries({ queryKey: ['sdr-meetings-v2'] });
      queryClient.invalidateQueries({ queryKey: ['sdr-metrics-v2'] });
      toast.success('Participante movido para outra reunião');
    },
    onError: () => {
      toast.error('Erro ao mover participante');
    },
  });
}

// ============ Fetch Meetings for a Date (for move attendee modal) ============

export function useMeetingsForDate(date: Date | null, includeCompleted: boolean = false) {
  return useQuery({
    queryKey: ['meetings-for-date', date?.toISOString(), includeCompleted],
    queryFn: async () => {
      if (!date) return [];

      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      // Admin pode ver todas, incluindo completed
      const statusFilter = includeCompleted 
        ? ['scheduled', 'rescheduled', 'completed'] 
        : ['scheduled', 'rescheduled'];

      const { data, error } = await supabase
        .from('meeting_slots')
        .select(`
          id,
          scheduled_at,
          status,
          duration_minutes,
          closer:closers(id, name, color),
          attendees:meeting_slot_attendees(id, attendee_name, is_partner)
        `)
        .gte('scheduled_at', startOfDay.toISOString())
        .lte('scheduled_at', endOfDay.toISOString())
        .in('status', statusFilter)
        .order('scheduled_at', { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!date,
  });
}

// Hook to get available slots count by date for calendar display
export function useAvailableSlotsCountByDate(
  closerId: string | undefined,
  dates: Date[],
  leadType: 'A' | 'B' = 'A'
) {
  return useQuery({
    queryKey: ['available-slots-count', closerId, dates.map(d => format(d, 'yyyy-MM-dd')), leadType],
    queryFn: async () => {
      if (!closerId || dates.length === 0) return {};
      
      const result: Record<string, { available: number; total: number }> = {};
      
      for (const date of dates) {
        const dateKey = format(date, 'yyyy-MM-dd');
        const dayOfWeek = date.getDay();
        
        // Fetch availability config for this closer and day
        const { data: availability } = await supabase
          .from('closer_availability')
          .select('start_time, end_time, max_slots_per_hour')
          .eq('closer_id', closerId)
          .eq('day_of_week', dayOfWeek)
          .eq('lead_type', leadType)
          .eq('is_active', true);
        
        if (!availability || availability.length === 0) {
          result[dateKey] = { available: 0, total: 0 };
          continue;
        }
        
        // Calculate total slots for the day
        let totalSlots = 0;
        
        for (const slot of availability) {
          const startHour = parseInt(slot.start_time.split(':')[0]);
          const endHour = parseInt(slot.end_time.split(':')[0]);
          const hoursInSlot = endHour - startHour;
          const maxPerHour = slot.max_slots_per_hour || 4;
          totalSlots += hoursInSlot * maxPerHour;
        }
        
        // Count existing bookings for this day
        const dayStart = new Date(date);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(date);
        dayEnd.setHours(23, 59, 59, 999);
        
        const { count } = await supabase
          .from('meeting_slot_attendees')
          .select('*, meeting_slots!inner(*)', { count: 'exact', head: true })
          .eq('meeting_slots.closer_id', closerId)
          .eq('meeting_slots.lead_type', leadType)
          .gte('meeting_slots.scheduled_at', dayStart.toISOString())
          .lte('meeting_slots.scheduled_at', dayEnd.toISOString())
          .neq('meeting_slots.status', 'canceled');
        
        const bookedSlots = count || 0;
        result[dateKey] = { available: Math.max(0, totalSlots - bookedSlots), total: totalSlots };
      }
      
      return result;
    },
    enabled: !!closerId && dates.length > 0,
    staleTime: 30000,
  });
}
