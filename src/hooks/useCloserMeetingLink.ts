import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

/**
 * Hook to fetch the Google Meet link for a closer based on day of week and time slot.
 * Falls back to undefined if no link is configured for that slot.
 */
export function useCloserMeetingLink(closerId: string | undefined, scheduledAt: string | undefined) {
  return useQuery({
    queryKey: ['closer-meeting-link', closerId, scheduledAt],
    queryFn: async () => {
      if (!closerId || !scheduledAt) return null;
      
      const date = new Date(scheduledAt);
      const dayOfWeek = date.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
      const timeStr = format(date, 'HH:mm:ss'); // Format as TIME for DB comparison
      
      const { data, error } = await supabase
        .from('closer_meeting_links')
        .select('google_meet_link')
        .eq('closer_id', closerId)
        .eq('day_of_week', dayOfWeek)
        .eq('start_time', timeStr)
        .maybeSingle();
      
      if (error) {
        console.error('Error fetching closer meeting link:', error);
        return null;
      }
      
      return data?.google_meet_link || null;
    },
    enabled: !!closerId && !!scheduledAt,
    staleTime: 1000 * 60 * 60, // Cache for 1 hour - links don't change often
  });
}
