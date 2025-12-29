import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface MeetingStats {
  total: number;
  bySource: {
    manual: number;
    clint: number;
    calendly: number;
  };
  byStatus: {
    scheduled: number;
    completed: number;
    no_show: number;
    cancelled: number;
    rescheduled: number;
  };
  byLeadType: {
    A: number;
    B: number;
    unknown: number;
  };
  conversionRate: number;
}

export function useMeetingStats(startDate: Date, endDate: Date) {
  return useQuery({
    queryKey: ['meeting-stats', startDate.toISOString(), endDate.toISOString()],
    queryFn: async (): Promise<MeetingStats> => {
      const { data, error } = await supabase
        .from('meeting_slots')
        .select('source, status, lead_type')
        .gte('scheduled_at', startDate.toISOString())
        .lte('scheduled_at', endDate.toISOString());

      if (error) throw error;

      const meetings = data || [];

      // Group by source
      const manual = meetings.filter(m => m.source === 'manual' || !m.source);
      const clint = meetings.filter(m => m.source === 'clint_webhook');
      const calendly = meetings.filter(m => m.source === 'calendly_webhook');

      // Group by status
      const scheduled = meetings.filter(m => m.status === 'scheduled');
      const completed = meetings.filter(m => m.status === 'completed');
      const noShow = meetings.filter(m => m.status === 'no_show');
      const cancelled = meetings.filter(m => m.status === 'cancelled');
      const rescheduled = meetings.filter(m => m.status === 'rescheduled');

      // Group by lead type
      const leadA = meetings.filter(m => m.lead_type === 'A');
      const leadB = meetings.filter(m => m.lead_type === 'B');
      const leadUnknown = meetings.filter(m => !m.lead_type || (m.lead_type !== 'A' && m.lead_type !== 'B'));

      // Calculate conversion rate (completed / (completed + no_show + cancelled))
      const finalized = completed.length + noShow.length + cancelled.length;
      const conversionRate = finalized > 0 ? (completed.length / finalized) * 100 : 0;

      return {
        total: meetings.length,
        bySource: {
          manual: manual.length,
          clint: clint.length,
          calendly: calendly.length,
        },
        byStatus: {
          scheduled: scheduled.length,
          completed: completed.length,
          no_show: noShow.length,
          cancelled: cancelled.length,
          rescheduled: rescheduled.length,
        },
        byLeadType: {
          A: leadA.length,
          B: leadB.length,
          unknown: leadUnknown.length,
        },
        conversionRate,
      };
    },
  });
}
