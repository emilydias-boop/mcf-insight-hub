import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { subDays, format } from 'date-fns';

export interface PastMeetingResult {
  attendeeId: string;
  attendeeName: string | null;
  attendeePhone: string | null;
  attendeeStatus: string;
  meeting: {
    id: string;
    scheduled_at: string;
    status: string;
    closer_id: string;
    duration_minutes: number;
    closer?: {
      id: string;
      name: string;
      color: string | null;
    };
  };
}

export function useSearchPastMeetings(query: string, closerId?: string, daysBack: number = 60) {
  return useQuery({
    queryKey: ['search-past-meetings', query, closerId, daysBack],
    queryFn: async (): Promise<PastMeetingResult[]> => {
      if (!query || query.length < 2) return [];

      const startDate = format(subDays(new Date(), daysBack), 'yyyy-MM-dd');
      const normalizedQuery = query.toLowerCase().trim();
      const phoneDigits = query.replace(/\D/g, '');

      // Build the query for attendees with their meeting slots
      let attendeeQuery = supabase
        .from('meeting_slot_attendees')
        .select(`
          id,
          attendee_name,
          attendee_phone,
          status,
          meeting_slot:meeting_slots!inner(
            id,
            scheduled_at,
            status,
            closer_id,
            duration_minutes,
            closer:closers(id, name, color)
          )
        `)
        .gte('meeting_slot.scheduled_at', startDate)
        .in('meeting_slot.status', ['completed', 'no_show'])
        .order('meeting_slot(scheduled_at)', { ascending: false })
        .limit(20);

      // Filter by closer if provided
      if (closerId) {
        attendeeQuery = attendeeQuery.eq('meeting_slot.closer_id', closerId);
      }

      // Search by name OR phone
      if (phoneDigits.length >= 4) {
        attendeeQuery = attendeeQuery.or(
          `attendee_name.ilike.%${normalizedQuery}%,attendee_phone.ilike.%${phoneDigits}%`
        );
      } else {
        attendeeQuery = attendeeQuery.ilike('attendee_name', `%${normalizedQuery}%`);
      }

      const { data, error } = await attendeeQuery;
      if (error) throw error;

      // Transform to the expected format
      return (data || [])
        .filter((att: any) => att.meeting_slot)
        .map((att: any) => ({
          attendeeId: att.id,
          attendeeName: att.attendee_name,
          attendeePhone: att.attendee_phone,
          attendeeStatus: att.status,
          meeting: att.meeting_slot
        }));
    },
    enabled: query.length >= 2,
    staleTime: 30000, // 30 seconds
  });
}
