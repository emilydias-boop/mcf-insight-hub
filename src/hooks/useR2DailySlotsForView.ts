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
 * Hook to fetch R2 daily slots for a range of dates and convert to a map.
 * Weekday slots remain available unless a closer has an explicit date schedule
 * with at least one free/manual daily slot. Daily rows created only to mirror an
 * already-booked meeting must not hide the closer's normal weekday agenda.
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

      // Group daily slots by date - normalize to yyyy-MM-dd format
      const dailySlotsByDate: Record<string, typeof dailySlots> = {};
      for (const slot of dailySlots || []) {
        // Normalize slot_date to yyyy-MM-dd (handle both string and Date)
        const dateStr = typeof slot.slot_date === 'string' 
          ? slot.slot_date.slice(0, 10) 
          : format(new Date(slot.slot_date), 'yyyy-MM-dd');
        if (!dailySlotsByDate[dateStr]) {
          dailySlotsByDate[dateStr] = [];
        }
        dailySlotsByDate[dateStr].push(slot);
      }
      
      // Fetch weekday-based slots for fallback (only for R2 closers)
      const weekdayQuery = supabase
        .from('closer_meeting_links')
        .select('closer_id, day_of_week, start_time, google_meet_link')
        .order('start_time');
      
      // Filter by closerIds if provided
      if (closerIds.length > 0) {
        weekdayQuery.in('closer_id', closerIds);
      }
      
      const { data: weekdaySlots, error: weekdayError } = await weekdayQuery;

      if (weekdayError) throw weekdayError;

      // Fetch booked R2 meetings so we can identify daily slots that were
      // implicitly created by scheduling/confirming a lead. Those rows should
      // not turn off the normal weekday fallback for that closer/date.
      const meetingsQuery = supabase
        .from('meeting_slots')
        .select('closer_id, scheduled_at')
        .eq('meeting_type', 'r2')
        .gte('scheduled_at', startOfDay(startDate).toISOString())
        .lte('scheduled_at', endOfDay(endDate).toISOString())
        .neq('status', 'canceled');

      if (closerIds.length > 0) {
        meetingsQuery.in('closer_id', closerIds);
      }

      const { data: bookedMeetings, error: bookedMeetingsError } = await meetingsQuery;

      if (bookedMeetingsError) throw bookedMeetingsError;

      const bookedTimesByCloserDate: Record<string, Set<string>> = {};
      for (const meeting of bookedMeetings || []) {
        if (!meeting.closer_id || !meeting.scheduled_at) continue;
        const meetingDate = new Date(meeting.scheduled_at);
        const dateStr = format(meetingDate, 'yyyy-MM-dd');
        const time = format(meetingDate, 'HH:mm');
        const key = `${dateStr}|${meeting.closer_id}`;
        if (!bookedTimesByCloserDate[key]) {
          bookedTimesByCloserDate[key] = new Set<string>();
        }
        bookedTimesByCloserDate[key].add(time);
      }

      // Group weekday slots by day_of_week
      const weekdaySlotsByDay: Record<number, typeof weekdaySlots> = {};
      for (const slot of weekdaySlots || []) {
        if (!weekdaySlotsByDay[slot.day_of_week]) {
          weekdaySlotsByDay[slot.day_of_week] = [];
        }
        weekdaySlotsByDay[slot.day_of_week].push(slot);
      }

      const addSlotToResult = (
        dateStr: string,
        time: string,
        closerId: string,
        googleMeetLink: string | null,
      ) => {
        if (!result[dateStr][time]) {
          result[dateStr][time] = { time, closerIds: [], meetLinks: {} };
        }
        if (!result[dateStr][time].closerIds.includes(closerId)) {
          result[dateStr][time].closerIds.push(closerId);
        }
        result[dateStr][time].meetLinks[closerId] = googleMeetLink;
      };

      // Build the result map for each date. The override decision is per closer
      // and ignores daily rows that only mirror an already-booked meeting.
      for (const date of dates) {
        const dateStr = format(date, 'yyyy-MM-dd');
        result[dateStr] = {};

        const dailySlotsForDate = dailySlotsByDate[dateStr] || [];
        const dayOfWeek = date.getDay();
        const weekdaySlotsForDay = weekdaySlotsByDay[dayOfWeek] || [];

        const dailySlotsByCloser: Record<string, typeof dailySlotsForDate> = {};
        for (const slot of dailySlotsForDate) {
          if (!dailySlotsByCloser[slot.closer_id]) {
            dailySlotsByCloser[slot.closer_id] = [];
          }
          dailySlotsByCloser[slot.closer_id].push(slot);
        }

        // A closer has an explicit date schedule only when at least one daily
        // slot is not simply the exact time of an existing booked meeting.
        const closersWithExplicitDailySchedule = new Set<string>();
        for (const [closerId, slots] of Object.entries(dailySlotsByCloser)) {
          const bookedTimes = bookedTimesByCloserDate[`${dateStr}|${closerId}`] || new Set<string>();
          const hasManualOrFreeDailySlot = slots.some(
            slot => !bookedTimes.has(slot.start_time.slice(0, 5))
          );
          if (hasManualOrFreeDailySlot) {
            closersWithExplicitDailySchedule.add(closerId);
          }
        }

        // 1) Daily slots take precedence for the closers that defined them.
        for (const slot of dailySlotsForDate) {
          const time = slot.start_time.slice(0, 5); // "HH:MM"
          addSlotToResult(dateStr, time, slot.closer_id, slot.google_meet_link);
        }

        // 2) Weekday fallback ONLY for closers that don't have daily slots
        //    on this date. Also respect the R2 closerIds filter when provided.
        const relevantWeekdaySlots = (closerIds.length > 0
          ? weekdaySlotsForDay.filter(s => closerIds.includes(s.closer_id))
          : weekdaySlotsForDay
        ).filter(s => !closersWithExplicitDailySchedule.has(s.closer_id));

        for (const slot of relevantWeekdaySlots) {
          const time = slot.start_time.slice(0, 5);
          addSlotToResult(dateStr, time, slot.closer_id, slot.google_meet_link);
        }
      }

      return result;
    },
    enabled: !!startDate && !!endDate,
    staleTime: 5000,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
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
