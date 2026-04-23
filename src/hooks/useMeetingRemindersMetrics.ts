import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface MetricsBucket {
  sent: number;
  skipped: number;
  failed: number;
  total: number;
}

export interface MeetingRemindersMetrics {
  last24h: MetricsBucket;
  last7d: MetricsBucket;
  last30d: MetricsBucket;
  byOffset: Record<string, MetricsBucket>;
}

function emptyBucket(): MetricsBucket {
  return { sent: 0, skipped: 0, failed: 0, total: 0 };
}

function aggregate(rows: { status: string }[]): MetricsBucket {
  const b = emptyBucket();
  for (const r of rows) {
    b.total++;
    if (r.status === 'sent') b.sent++;
    else if (r.status === 'skipped') b.skipped++;
    else if (r.status === 'failed') b.failed++;
  }
  return b;
}

export function useMeetingRemindersMetrics() {
  return useQuery({
    queryKey: ['meeting-reminders-metrics'],
    queryFn: async (): Promise<MeetingRemindersMetrics> => {
      const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('meeting_reminders_log')
        .select('status, offset_key, sent_at')
        .gte('sent_at', since30d)
        .order('sent_at', { ascending: false })
        .limit(5000);

      if (error) throw error;
      const rows = data ?? [];
      const now = Date.now();
      const ms24 = 24 * 60 * 60 * 1000;
      const ms7 = 7 * ms24;

      const r24 = rows.filter(r => now - new Date(r.sent_at).getTime() <= ms24);
      const r7 = rows.filter(r => now - new Date(r.sent_at).getTime() <= ms7);

      const byOffset: Record<string, MetricsBucket> = {};
      for (const r of rows) {
        if (!byOffset[r.offset_key]) byOffset[r.offset_key] = emptyBucket();
        byOffset[r.offset_key].total++;
        if (r.status === 'sent') byOffset[r.offset_key].sent++;
        else if (r.status === 'skipped') byOffset[r.offset_key].skipped++;
        else if (r.status === 'failed') byOffset[r.offset_key].failed++;
      }

      return {
        last24h: aggregate(r24),
        last7d: aggregate(r7),
        last30d: aggregate(rows),
        byOffset,
      };
    },
  });
}
