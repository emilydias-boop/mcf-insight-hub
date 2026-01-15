import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, getDay, startOfDay, endOfDay, startOfMonth, endOfMonth } from 'date-fns';

interface ConfiguredSlot {
  start_time: string;
  google_meet_link: string | null;
}

interface AvailableSlot {
  time: string;
  link: string | null;
  isAvailable: boolean;
}

export function useR2CloserAvailableSlots(closerId: string | undefined, date: Date | undefined) {
  return useQuery({
    queryKey: ['r2-closer-slots', closerId, date ? format(date, 'yyyy-MM-dd') : null],
    queryFn: async () => {
      if (!closerId || !date) return { configuredSlots: [], bookedTimes: [], availableSlots: [] };

      const dayOfWeek = getDay(date); // 0=Sunday, 1=Monday, etc.
      const dateStr = format(date, 'yyyy-MM-dd');

      // 1. Fetch configured slots for this closer on this day of week
      const { data: configuredSlots, error: slotsError } = await supabase
        .from('closer_meeting_links')
        .select('start_time, google_meet_link')
        .eq('closer_id', closerId)
        .eq('day_of_week', dayOfWeek)
        .order('start_time');

      if (slotsError) throw slotsError;

      // 2. Fetch already booked meetings for this closer on this specific date
      const startOfDayStr = `${dateStr}T00:00:00`;
      const endOfDayStr = `${dateStr}T23:59:59`;

      const { data: bookedMeetings, error: meetingsError } = await supabase
        .from('meeting_slots')
        .select('scheduled_at')
        .eq('closer_id', closerId)
        .gte('scheduled_at', startOfDayStr)
        .lte('scheduled_at', endOfDayStr);

      if (meetingsError) throw meetingsError;

      // Extract booked times (HH:mm format)
      const bookedTimes = (bookedMeetings || []).map(m => {
        const d = new Date(m.scheduled_at);
        return format(d, 'HH:mm');
      });

      // 3. Build available slots list
      const availableSlots: AvailableSlot[] = (configuredSlots || []).map((slot: ConfiguredSlot) => {
        const time = slot.start_time.substring(0, 5); // "HH:mm"
        return {
          time,
          link: slot.google_meet_link,
          isAvailable: !bookedTimes.includes(time),
        };
      });

      return {
        configuredSlots: configuredSlots || [],
        bookedTimes,
        availableSlots,
      };
    },
    enabled: !!closerId && !!date,
  });
}

// Hook to fetch all R2 meetings for a closer in a given month (for calendar indicators)
export function useR2MonthMeetings(closerId: string | undefined, month: Date | undefined) {
  return useQuery({
    queryKey: ['r2-month-meetings', closerId, month ? format(month, 'yyyy-MM') : null],
    queryFn: async () => {
      if (!closerId || !month) return [];

      const startDate = format(startOfMonth(month), 'yyyy-MM-dd');
      const endDate = format(endOfMonth(month), 'yyyy-MM-dd');

      const { data, error } = await supabase
        .from('meeting_slots')
        .select('scheduled_at')
        .eq('closer_id', closerId)
        .eq('meeting_type', 'r2')
        .gte('scheduled_at', `${startDate}T00:00:00`)
        .lte('scheduled_at', `${endDate}T23:59:59`);

      if (error) throw error;

      // Return unique dates (as Date objects)
      const uniqueDates = [...new Set((data || []).map(m => format(new Date(m.scheduled_at), 'yyyy-MM-dd')))];
      return uniqueDates.map(d => new Date(d));
    },
    enabled: !!closerId && !!month,
  });
}
