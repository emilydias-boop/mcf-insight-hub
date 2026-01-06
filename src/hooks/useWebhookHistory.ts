import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface WebhookEvent {
  id: string;
  event_type: string;
  status: string;
  created_at: string;
  processed_at: string | null;
  processing_time_ms: number | null;
  event_data: any;
  error_message: string | null;
}

export function useWebhookHistoryByEmail(email: string | null) {
  return useQuery({
    queryKey: ['webhook-history', email],
    queryFn: async (): Promise<WebhookEvent[]> => {
      if (!email) return [];

      const { data, error } = await supabase
        .from('webhook_events')
        .select('*')
        .ilike('event_data::text', `%${email}%`)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data || [];
    },
    enabled: !!email,
  });
}

export function useWebhookHistoryByDealName(dealName: string | null) {
  return useQuery({
    queryKey: ['webhook-history-deal', dealName],
    queryFn: async (): Promise<WebhookEvent[]> => {
      if (!dealName) return [];

      const { data, error } = await supabase
        .from('webhook_events')
        .select('*')
        .ilike('event_data::text', `%${dealName}%`)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data || [];
    },
    enabled: !!dealName,
  });
}
