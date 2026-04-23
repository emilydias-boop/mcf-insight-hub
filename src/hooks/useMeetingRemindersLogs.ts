import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface MeetingReminderLog {
  id: string;
  meeting_slot_id: string;
  attendee_id: string;
  contact_email: string;
  offset_key: string;
  meeting_type: string;
  status: string;
  skip_reason: string | null;
  ac_contact_id: string | null;
  error_message: string | null;
  scheduled_at: string | null;
  sent_at: string;
}

export interface LogsFilter {
  status?: string;
  offsetKey?: string;
  limit?: number;
}

export function useMeetingRemindersLogs(filters: LogsFilter = {}) {
  return useQuery({
    queryKey: ['meeting-reminders-logs', filters],
    queryFn: async () => {
      let q = supabase
        .from('meeting_reminders_log')
        .select('*')
        .order('sent_at', { ascending: false })
        .limit(filters.limit ?? 100);

      if (filters.status) q = q.eq('status', filters.status);
      if (filters.offsetKey) q = q.eq('offset_key', filters.offsetKey);

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as MeetingReminderLog[];
    },
  });
}
