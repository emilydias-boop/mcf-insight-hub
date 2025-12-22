import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { addDays, format, parseISO, setHours, setMinutes, startOfDay, isBefore, isAfter, addMinutes } from 'date-fns';

export interface Closer {
  id: string;
  name: string;
  email: string;
  is_active: boolean;
  employee_id?: string;
}

export interface CloserAvailability {
  id: string;
  closer_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  slot_duration_minutes: number;
  is_active: boolean;
}

export interface MeetingSlot {
  id: string;
  closer_id: string;
  deal_id?: string;
  contact_id?: string;
  scheduled_at: string;
  duration_minutes: number;
  status: string;
  booked_by?: string;
  notes?: string;
  meeting_link?: string;
  closers?: Closer;
}

export interface AvailableSlot {
  closerId: string;
  closerName: string;
  datetime: Date;
  duration: number;
}

// Fetch all active closers
export function useClosers() {
  return useQuery({
    queryKey: ['closers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('closers')
        .select('*')
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      return data as Closer[];
    },
  });
}

// Fetch closer availability
export function useCloserAvailability(closerId?: string) {
  return useQuery({
    queryKey: ['closer_availability', closerId],
    queryFn: async () => {
      let query = supabase
        .from('closer_availability')
        .select('*')
        .eq('is_active', true);
      
      if (closerId) {
        query = query.eq('closer_id', closerId);
      }
      
      const { data, error } = await query.order('day_of_week').order('start_time');
      
      if (error) throw error;
      return data as CloserAvailability[];
    },
  });
}

// Fetch booked slots for a date range
export function useBookedSlots(startDate: Date, endDate: Date) {
  return useQuery({
    queryKey: ['meeting_slots', format(startDate, 'yyyy-MM-dd'), format(endDate, 'yyyy-MM-dd')],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meeting_slots')
        .select('*, closers(*)')
        .gte('scheduled_at', startDate.toISOString())
        .lte('scheduled_at', endDate.toISOString())
        .in('status', ['scheduled', 'rescheduled']);
      
      if (error) throw error;
      return data as MeetingSlot[];
    },
  });
}

// Calculate available slots for a date range
export function useAvailableSlots(startDate: Date, daysAhead: number = 7) {
  const endDate = addDays(startDate, daysAhead);
  
  const { data: closers } = useClosers();
  const { data: availability } = useCloserAvailability();
  const { data: bookedSlots } = useBookedSlots(startDate, endDate);
  
  const availableSlots: AvailableSlot[] = [];
  
  if (closers && availability && bookedSlots) {
    // For each day in the range
    for (let i = 0; i < daysAhead; i++) {
      const currentDate = addDays(startOfDay(startDate), i);
      const dayOfWeek = currentDate.getDay(); // 0 = Sunday
      
      // Skip past dates
      if (isBefore(currentDate, startOfDay(new Date()))) continue;
      
      // Get availability for this day
      const dayAvailability = availability.filter(a => a.day_of_week === dayOfWeek);
      
      for (const avail of dayAvailability) {
        const closer = closers.find(c => c.id === avail.closer_id);
        if (!closer) continue;
        
        // Parse start and end times
        const [startHour, startMin] = avail.start_time.split(':').map(Number);
        const [endHour, endMin] = avail.end_time.split(':').map(Number);
        
        let slotTime = setMinutes(setHours(currentDate, startHour), startMin);
        const endTime = setMinutes(setHours(currentDate, endHour), endMin);
        
        // Generate slots
        while (isBefore(slotTime, endTime)) {
          // Check if slot is in the future
          if (isAfter(slotTime, new Date())) {
            // Check if slot is not already booked
            const isBooked = bookedSlots.some(booked => {
              const bookedTime = new Date(booked.scheduled_at);
              return booked.closer_id === closer.id && 
                Math.abs(bookedTime.getTime() - slotTime.getTime()) < avail.slot_duration_minutes * 60 * 1000;
            });
            
            if (!isBooked) {
              availableSlots.push({
                closerId: closer.id,
                closerName: closer.name,
                datetime: new Date(slotTime),
                duration: avail.slot_duration_minutes,
              });
            }
          }
          
          slotTime = addMinutes(slotTime, avail.slot_duration_minutes);
        }
      }
    }
  }
  
  return {
    slots: availableSlots.sort((a, b) => a.datetime.getTime() - b.datetime.getTime()),
    isLoading: !closers || !availability || !bookedSlots,
  };
}

// Book a meeting slot
export function useBookMeeting() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({
      closerId,
      dealId,
      contactId,
      scheduledAt,
      durationMinutes = 60,
      notes,
    }: {
      closerId: string;
      dealId: string;
      contactId?: string;
      scheduledAt: Date;
      durationMinutes?: number;
      notes?: string;
    }) => {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      
      // Create the meeting slot
      const { data: slot, error: slotError } = await supabase
        .from('meeting_slots')
        .insert({
          closer_id: closerId,
          deal_id: dealId,
          contact_id: contactId,
          scheduled_at: scheduledAt.toISOString(),
          duration_minutes: durationMinutes,
          booked_by: user.id,
          notes,
          status: 'scheduled',
        })
        .select('*, closers(*)')
        .single();
      
      if (slotError) throw slotError;
      
      // Update the deal to stage "Reunião 01 Agendada" and set next_action_date
      // First, find the stage ID
      const { data: stages } = await supabase
        .from('crm_stages')
        .select('id')
        .ilike('stage_name', '%Reunião 01 Agendada%')
        .limit(1);
      
      const stageId = stages?.[0]?.id;
      
      if (stageId) {
        const { error: dealError } = await supabase
          .from('crm_deals')
          .update({
            stage_id: stageId,
            next_action_date: scheduledAt.toISOString(),
            next_action_type: 'meeting',
            next_action_note: `Reunião agendada com ${(slot as any).closers?.name}`,
          })
          .eq('id', dealId);
        
        if (dealError) throw dealError;
        
        // Log activity
        await supabase.from('deal_activities').insert({
          deal_id: dealId,
          activity_type: 'meeting_scheduled',
          description: `Reunião agendada para ${format(scheduledAt, 'dd/MM/yyyy HH:mm')} com ${(slot as any).closers?.name}`,
          user_id: user.id,
          metadata: {
            closer_id: closerId,
            closer_name: (slot as any).closers?.name,
            scheduled_at: scheduledAt.toISOString(),
            slot_id: slot.id,
          },
        });
      }
      
      return slot;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meeting_slots'] });
      queryClient.invalidateQueries({ queryKey: ['crm_deals'] });
    },
  });
}

// Get meetings for a deal
export function useDealMeetings(dealId?: string) {
  return useQuery({
    queryKey: ['deal_meetings', dealId],
    queryFn: async () => {
      if (!dealId) return [];
      
      const { data, error } = await supabase
        .from('meeting_slots')
        .select('*, closers(*)')
        .eq('deal_id', dealId)
        .order('scheduled_at', { ascending: false });
      
      if (error) throw error;
      return data as MeetingSlot[];
    },
    enabled: !!dealId,
  });
}
