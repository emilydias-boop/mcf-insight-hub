import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ReprocessResult {
  success: boolean;
  dry_run: boolean;
  total: number;
  processed: number;
  errors: number;
  results: Array<{
    id: string;
    success: boolean;
    error?: string;
    contact_id?: string;
    deal_id?: string;
    activity_created?: boolean;
  }>;
}

export interface FailedWebhookSummary {
  total: number;
  byType: Record<string, number>;
  byError: Record<string, number>;
  bySdr: Record<string, number>;
  oldestDate: string | null;
}

export interface FailedWebhook {
  id: string;
  event_type: string;
  event_data: any;
  error_message: string | null;
  created_at: string;
}

export const useFailedWebhooksSummary = (daysBack: number = 30) => {
  return useQuery({
    queryKey: ['failed-webhooks-summary', daysBack],
    queryFn: async (): Promise<FailedWebhookSummary> => {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysBack);

      const { data, error } = await supabase
        .from('webhook_events')
        .select('id, event_type, error_message, event_data, created_at')
        .eq('status', 'error')
        .gte('created_at', cutoffDate.toISOString())
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) throw error;

      const webhooks = data || [];
      
      // Aggregate by type
      const byType: Record<string, number> = {};
      const byError: Record<string, number> = {};
      const bySdr: Record<string, number> = {};

      webhooks.forEach((w) => {
        // By type
        byType[w.event_type] = (byType[w.event_type] || 0) + 1;
        
        // By error (simplified)
        const errorKey = w.error_message?.slice(0, 50) || 'Unknown error';
        byError[errorKey] = (byError[errorKey] || 0) + 1;

        // By SDR (extract from event_data)
        const eventData = w.event_data as Record<string, any> | null;
        const sdrEmail = eventData?.deal_user || eventData?.deal?.user || 'Unknown';
        if (sdrEmail && sdrEmail !== 'Unknown') {
          bySdr[sdrEmail] = (bySdr[sdrEmail] || 0) + 1;
        }
      });

      return {
        total: webhooks.length,
        byType,
        byError,
        bySdr,
        oldestDate: webhooks.length > 0 ? webhooks[webhooks.length - 1].created_at : null
      };
    },
    refetchInterval: 30000 // Refresh every 30 seconds
  });
};

export const useFailedWebhooksList = (daysBack: number = 7, limit: number = 100) => {
  return useQuery({
    queryKey: ['failed-webhooks-list', daysBack, limit],
    queryFn: async (): Promise<FailedWebhook[]> => {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysBack);

      const { data, error } = await supabase
        .from('webhook_events')
        .select('id, event_type, event_data, error_message, created_at')
        .eq('status', 'error')
        .gte('created_at', cutoffDate.toISOString())
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data as FailedWebhook[];
    },
    refetchInterval: 30000
  });
};

export const useReprocessFailedWebhooks = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { all?: boolean; webhookIds?: string[]; daysBack?: number }): Promise<ReprocessResult> => {
      const { data, error } = await supabase.functions.invoke('reprocess-failed-webhooks', {
        body: {
          all: params.all || false,
          webhook_ids: params.webhookIds,
          days_back: params.daysBack || 30,
          dry_run: false
        }
      });

      if (error) throw error;
      return data as ReprocessResult;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['failed-webhooks-summary'] });
      queryClient.invalidateQueries({ queryKey: ['failed-webhooks-list'] });
      queryClient.invalidateQueries({ queryKey: ['webhook-logs'] });
      queryClient.invalidateQueries({ queryKey: ['webhook-stats'] });
    }
  });
};
