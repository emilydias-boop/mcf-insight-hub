import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, startOfDay, endOfDay } from 'date-fns';

export interface EncaixeQueueItem {
  id: string;
  deal_id: string;
  contact_id: string | null;
  closer_id: string;
  preferred_date: string;
  preferred_time_start: string | null;
  preferred_time_end: string | null;
  lead_type: string;
  priority: number;
  status: 'waiting' | 'notified' | 'scheduled' | 'expired' | 'canceled';
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  notified_at: string | null;
  scheduled_meeting_id: string | null;
  // Joined data
  deal?: {
    id: string;
    name: string;
    contact?: {
      id: string;
      name: string;
      email: string | null;
      phone: string | null;
    };
  };
  closer?: {
    id: string;
    name: string;
  };
}

export interface CloserDayCapacity {
  closerId: string;
  date: Date;
  totalSlotsAvailable: number;
  bookedCount: number;
  isFull: boolean;
  availableSlots: number;
}

// Fetch encaixe queue for a closer/date
export function useEncaixeQueue(closerId?: string, date?: Date) {
  return useQuery({
    queryKey: ['encaixe-queue', closerId, date?.toISOString()],
    queryFn: async () => {
      let query = supabase
        .from('encaixe_queue')
        .select(`
          *,
          deal:crm_deals(id, name, contact:crm_contacts(id, name, email, phone)),
          closer:closers(id, name)
        `)
        .in('status', ['waiting', 'notified'])
        .order('priority', { ascending: true })
        .order('created_at', { ascending: true });

      if (closerId) {
        query = query.eq('closer_id', closerId);
      }

      if (date) {
        query = query.eq('preferred_date', format(date, 'yyyy-MM-dd'));
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as EncaixeQueueItem[];
    },
    enabled: true,
  });
}

// Check if a closer's day is full
export function useCloserDayCapacity(closerId?: string, date?: Date) {
  return useQuery({
    queryKey: ['closer-day-capacity', closerId, date?.toISOString()],
    queryFn: async (): Promise<CloserDayCapacity | null> => {
      if (!closerId || !date) return null;

      const dayOfWeek = date.getDay() === 0 ? 7 : date.getDay();

      // 1. Get closer availability for this day
      const { data: availability, error: availError } = await supabase
        .from('closer_availability')
        .select('start_time, end_time, slot_duration_minutes, max_slots_per_hour')
        .eq('closer_id', closerId)
        .eq('day_of_week', dayOfWeek)
        .eq('is_active', true);

      if (availError) throw availError;

      if (!availability || availability.length === 0) {
        return {
          closerId,
          date,
          totalSlotsAvailable: 0,
          bookedCount: 0,
          isFull: true, // No availability = consider full
          availableSlots: 0,
        };
      }

      // 2. Calculate total slots available
      let totalSlotsAvailable = 0;
      for (const avail of availability) {
        const [startHour, startMin] = avail.start_time.split(':').map(Number);
        const [endHour, endMin] = avail.end_time.split(':').map(Number);
        const startMinutes = startHour * 60 + startMin;
        const endMinutes = endHour * 60 + endMin;
        const slotDuration = avail.slot_duration_minutes || 30;
        const slotCount = Math.floor((endMinutes - startMinutes) / slotDuration);
        const maxPerSlot = avail.max_slots_per_hour || 3;
        totalSlotsAvailable += slotCount * maxPerSlot;
      }

      // 3. Count booked attendees for the day
      const dayStart = startOfDay(date);
      const dayEnd = endOfDay(date);

      const { data: meetings, error: meetingsError } = await supabase
        .from('meeting_slots')
        .select('id')
        .eq('closer_id', closerId)
        .gte('scheduled_at', dayStart.toISOString())
        .lte('scheduled_at', dayEnd.toISOString())
        .in('status', ['scheduled', 'rescheduled']);

      if (meetingsError) throw meetingsError;

      let bookedCount = 0;
      if (meetings && meetings.length > 0) {
        const meetingIds = meetings.map(m => m.id);
        const { count, error: countError } = await supabase
          .from('meeting_slot_attendees')
          .select('id', { count: 'exact', head: true })
          .in('meeting_slot_id', meetingIds)
          .neq('status', 'no_show');

        if (countError) throw countError;
        bookedCount = count || 0;
      }

      const isFull = bookedCount >= totalSlotsAvailable;
      const availableSlots = Math.max(0, totalSlotsAvailable - bookedCount);

      return {
        closerId,
        date,
        totalSlotsAvailable,
        bookedCount,
        isFull,
        availableSlots,
      };
    },
    enabled: !!closerId && !!date,
  });
}

// Add a lead to the encaixe queue
export function useAddToEncaixeQueue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      dealId: string;
      contactId?: string;
      closerId: string;
      preferredDate: Date;
      preferredTimeStart?: string;
      preferredTimeEnd?: string;
      leadType: 'A' | 'B';
      priority?: number;
      notes?: string;
      createdBy?: string;
    }) => {
      const { data, error } = await supabase
        .from('encaixe_queue')
        .insert({
          deal_id: params.dealId,
          contact_id: params.contactId || null,
          closer_id: params.closerId,
          preferred_date: format(params.preferredDate, 'yyyy-MM-dd'),
          preferred_time_start: params.preferredTimeStart || null,
          preferred_time_end: params.preferredTimeEnd || null,
          lead_type: params.leadType,
          priority: params.priority || 1,
          notes: params.notes || null,
          created_by: params.createdBy || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['encaixe-queue'] });
      toast.success('Lead adicionado à fila de encaixe');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao adicionar à fila: ${error.message}`);
    },
  });
}

// Update encaixe queue item status
export function useUpdateEncaixeStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      id: string;
      status: 'waiting' | 'notified' | 'scheduled' | 'expired' | 'canceled';
      scheduledMeetingId?: string;
    }) => {
      const updateData: Record<string, unknown> = {
        status: params.status,
        updated_at: new Date().toISOString(),
      };

      if (params.status === 'notified') {
        updateData.notified_at = new Date().toISOString();
      }

      if (params.scheduledMeetingId) {
        updateData.scheduled_meeting_id = params.scheduledMeetingId;
      }

      const { data, error } = await supabase
        .from('encaixe_queue')
        .update(updateData)
        .eq('id', params.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['encaixe-queue'] });
      
      const statusMessages: Record<string, string> = {
        scheduled: 'Lead encaixado com sucesso',
        canceled: 'Lead removido da fila',
        notified: 'Lead notificado',
        expired: 'Encaixe expirado',
      };
      
      const message = statusMessages[variables.status];
      if (message) toast.success(message);
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar status: ${error.message}`);
    },
  });
}

// Remove from encaixe queue
export function useRemoveFromEncaixeQueue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('encaixe_queue')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['encaixe-queue'] });
      toast.success('Removido da fila de encaixe');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao remover da fila: ${error.message}`);
    },
  });
}

// Get encaixe queue count for a closer/date
export function useEncaixeQueueCount(closerId?: string, date?: Date) {
  return useQuery({
    queryKey: ['encaixe-queue-count', closerId, date?.toISOString()],
    queryFn: async () => {
      let query = supabase
        .from('encaixe_queue')
        .select('id', { count: 'exact', head: true })
        .in('status', ['waiting', 'notified']);

      if (closerId) {
        query = query.eq('closer_id', closerId);
      }

      if (date) {
        query = query.eq('preferred_date', format(date, 'yyyy-MM-dd'));
      }

      const { count, error } = await query;
      if (error) throw error;
      return count || 0;
    },
    enabled: true,
  });
}

// Check if there are leads waiting for encaixe when a no-show happens
export function useCheckEncaixeOnNoShow() {
  return useMutation({
    mutationFn: async (params: { closerId: string; date: Date }) => {
      const { data, error } = await supabase
        .from('encaixe_queue')
        .select(`
          *,
          deal:crm_deals(id, name, contact:crm_contacts(id, name, email, phone))
        `)
        .eq('closer_id', params.closerId)
        .eq('preferred_date', format(params.date, 'yyyy-MM-dd'))
        .in('status', ['waiting', 'notified'])
        .order('priority', { ascending: true })
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as EncaixeQueueItem[];
    },
  });
}
