import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface IngestFailure {
  id: string;
  source: string;
  hubla_id: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  customer_name: string | null;
  product_name: string | null;
  failure_reason: string;
  attempts: number;
  status: 'pending' | 'retrying' | 'resolved' | 'abandoned';
  last_error: string | null;
  resolved_at: string | null;
  resolved_deal_id: string | null;
  created_at: string;
  updated_at: string;
}

export function useIngestFailures(hoursBack = 24) {
  return useQuery({
    queryKey: ['ingest-failures', hoursBack],
    queryFn: async () => {
      const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('webhook_ingest_failures')
        .select('*')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      const rows = (data || []) as IngestFailure[];
      const summary = {
        total: rows.length,
        pending: rows.filter(r => r.status === 'pending').length,
        retrying: rows.filter(r => r.status === 'retrying').length,
        resolved: rows.filter(r => r.status === 'resolved').length,
        abandoned: rows.filter(r => r.status === 'abandoned').length,
        unresolved: rows.filter(r => r.status === 'pending' || r.status === 'retrying' || r.status === 'abandoned').length,
      };
      return { rows, summary };
    },
    refetchInterval: 60_000,
  });
}

export async function triggerRetryFailures() {
  const { data, error } = await supabase.functions.invoke('retry-webhook-failures', { body: {} });
  if (error) throw error;
  return data;
}