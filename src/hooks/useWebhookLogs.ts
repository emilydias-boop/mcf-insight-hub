import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface WebhookEvent {
  id: string;
  event_type: string;
  event_data: any;
  status: 'pending' | 'processing' | 'success' | 'error';
  error_message: string | null;
  processing_time_ms: number | null;
  created_at: string;
  processed_at: string | null;
}

export const useWebhookLogs = (limit: number = 50) => {
  return useQuery({
    queryKey: ['webhook-logs', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('webhook_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      return data as WebhookEvent[];
    },
    refetchInterval: 5000 // Atualizar a cada 5 segundos
  });
};

export const useWebhookStats = () => {
  return useQuery({
    queryKey: ['webhook-stats'],
    queryFn: async () => {
      // Total hoje
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const { count: totalToday } = await supabase
        .from('webhook_events')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', startOfDay.toISOString());

      // Sucesso hoje
      const { count: successToday } = await supabase
        .from('webhook_events')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'success')
        .gte('created_at', startOfDay.toISOString());

      // Erros hoje
      const { count: errorsToday } = await supabase
        .from('webhook_events')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'error')
        .gte('created_at', startOfDay.toISOString());

      // Último webhook
      const { data: lastWebhook } = await supabase
        .from('webhook_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      // Estatísticas por tipo (últimos 7 dias)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: typeStats } = await supabase
        .from('webhook_events')
        .select('event_type')
        .gte('created_at', sevenDaysAgo.toISOString());

      const eventTypeCounts: Record<string, number> = {};
      typeStats?.forEach((event) => {
        eventTypeCounts[event.event_type] = (eventTypeCounts[event.event_type] || 0) + 1;
      });

      const successRate = totalToday ? ((successToday || 0) / totalToday) * 100 : 0;

      return {
        totalToday: totalToday || 0,
        successToday: successToday || 0,
        errorsToday: errorsToday || 0,
        successRate: successRate.toFixed(1),
        lastWebhook: lastWebhook as WebhookEvent | null,
        eventTypeCounts
      };
    },
    refetchInterval: 10000 // Atualizar a cada 10 segundos
  });
};

export const useReprocessWebhook = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (webhookId: string) => {
      // Buscar webhook
      const { data: webhook, error: fetchError } = await supabase
        .from('webhook_events')
        .select('*')
        .eq('id', webhookId)
        .single();

      if (fetchError) throw fetchError;

      // Chamar edge function para reprocessar
      const { data, error } = await supabase.functions.invoke('clint-webhook-handler', {
        body: webhook.event_data as Record<string, any>
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhook-logs'] });
      queryClient.invalidateQueries({ queryKey: ['webhook-stats'] });
      toast.success('Webhook reprocessado com sucesso');
    },
    onError: (error: any) => {
      console.error('Error reprocessing webhook:', error);
      toast.error('Erro ao reprocessar webhook');
    }
  });
};
