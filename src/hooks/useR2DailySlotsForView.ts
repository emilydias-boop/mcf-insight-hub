import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, eachDayOfInterval, startOfDay, endOfDay } from 'date-fns';

interface DailySlotInfo {
  time: string;
  closerIds: string[];
  meetLinks: Record<string, string | null>;
}

export interface R2DailySlotsMap {
  [dateStr: string]: {
    [time: string]: DailySlotInfo;
  };
}

/**
 * Hook to fetch R2 daily slots for a range of dates and convert to a map
 * If no daily slots exist for a date, falls back to weekday-based slots from closer_meeting_links
 */
export function useR2DailySlotsForView(
  startDate: Date | undefined,
  endDate: Date | undefined,
  closerIds: string[] = []
) {
  return useQuery({
    queryKey: ['r2-daily-slots-view', startDate?.toISOString(), endDate?.toISOString(), closerIds],
    queryFn: async (): Promise<R2DailySlotsMap> => {
      if (!startDate || !endDate) return {};

      const dates = eachDayOfInterval({ start: startOfDay(startDate), end: endOfDay(endDate) });
      const result: R2DailySlotsMap = {};

      // Fetch all daily slots for the date range
      const { data: dailySlots, error: dailyError } = await supabase
        .from('r2_daily_slots')
        .select('*')
        .gte('slot_date', format(startDate, 'yyyy-MM-dd'))
        .lte('slot_date', format(endDate, 'yyyy-MM-dd'))
        .order('slot_date')
        .order('start_time');

      if (dailyError) throw dailyError;

      // Group daily slots by date
      const dailySlotsByDate: Record<string, typeof dailySlots> = {};
      for (const slot of dailySlots || []) {
        const dateStr = slot.slot_date;
        if (!dailySlotsByDate[dateStr]) {
          dailySlotsByDate[dateStr] = [];
        }
        dailySlotsByDate[dateStr].push(slot);
      }

      // Fetch weekday-based slots for fallback
      const { data: weekdaySlots, error: weekdayError } = await supabase
        .from('closer_meeting_links')
        .select('closer_id, day_of_week, start_time, google_meet_link')
        .order('start_time');

      if (weekdayError) throw weekdayError;

      // Group weekday slots by day_of_week
      const weekdaySlotsByDay: Record<number, typeof weekdaySlots> = {};
      for (const slot of weekdaySlots || []) {
        if (!weekdaySlotsByDay[slot.day_of_week]) {
          weekdaySlotsByDay[slot.day_of_week] = [];
        }
        weekdaySlotsByDay[slot.day_of_week].push(slot);
      }

      // Build the result map for each date
      for (const date of dates) {
        const dateStr = format(date, 'yyyy-MM-dd');
        result[dateStr] = {};

        // Check if there are daily slots for this specific date
        const dailySlotsForDate = dailySlotsByDate[dateStr];

        if (dailySlotsForDate && dailySlotsForDate.length > 0) {
          // Use daily slots
          for (const slot of dailySlotsForDate) {
            const time = slot.start_time.slice(0, 5); // "HH:MM"
            if (!result[dateStr][time]) {
              result[dateStr][time] = { time, closerIds: [], meetLinks: {} };
            }
            result[dateStr][time].closerIds.push(slot.closer_id);
            result[dateStr][time].meetLinks[slot.closer_id] = slot.google_meet_link;
          }
        } else {
          // Fallback to weekday slots
          const dayOfWeek = date.getDay();
          const weekdaySlotsForDay = weekdaySlotsByDay[dayOfWeek] || [];
          
          // Filter by R2 closers if provided
          const relevantSlots = closerIds.length > 0
            ? weekdaySlotsForDay.filter(s => closerIds.includes(s.closer_id))
            : weekdaySlotsForDay;

          for (const slot of relevantSlots) {
            const time = slot.start_time.slice(0, 5);
            if (!result[dateStr][time]) {
              result[dateStr][time] = { time, closerIds: [], meetLinks: {} };
            }
            result[dateStr][time].closerIds.push(slot.closer_id);
            result[dateStr][time].meetLinks[slot.closer_id] = slot.google_meet_link;
          }
        }
      }

      return result;
    },
    enabled: !!startDate && !!endDate,
    staleTime: 30000,
  });
}

/**
 * Convert R2DailySlotsMap to the format expected by AgendaCalendar's isSlotConfigured
 */
export function getConfiguredSlotsForDate(
  slotsMap: R2DailySlotsMap | undefined,
  date: Date
): { time: string; closerIds: string[] }[] {
  if (!slotsMap) return [];
  const dateStr = format(date, 'yyyy-MM-dd');
  const dateSlots = slotsMap[dateStr];
  if (!dateSlots) return [];
  
  return Object.values(dateSlots).map(s => ({
    time: s.time,
    closerIds: s.closerIds,
  }));
}
