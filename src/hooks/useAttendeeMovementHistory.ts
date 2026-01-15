import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface MovementLog {
  id: string;
  attendee_id: string;
  from_slot_id: string | null;
  to_slot_id: string;
  from_scheduled_at: string | null;
  to_scheduled_at: string;
  from_closer_id: string | null;
  from_closer_name: string | null;
  to_closer_id: string | null;
  to_closer_name: string | null;
  previous_status: string | null;
  reason: string | null;
  movement_type: string;
  moved_by: string | null;
  moved_by_name: string | null;
  moved_by_role: string | null;
  created_at: string;
}

export function useAttendeeMovementHistory(attendeeId: string | null) {
  return useQuery({
    queryKey: ['attendee-movement-history', attendeeId],
    queryFn: async (): Promise<MovementLog[]> => {
      if (!attendeeId) return [];
      
      const { data, error } = await supabase
        .from('attendee_movement_logs')
        .select('*')
        .eq('attendee_id', attendeeId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return (data || []) as MovementLog[];
    },
    enabled: !!attendeeId
  });
}
