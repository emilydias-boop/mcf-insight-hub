import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AutomationLog {
  id: string;
  flow_id?: string;
  step_id?: string;
  template_id?: string;
  deal_id?: string;
  contact_id?: string;
  channel: 'whatsapp' | 'email';
  recipient: string;
  content_sent?: string;
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed' | 'cancelled';
  error_message?: string;
  external_id?: string;
  external_status?: string;
  metadata?: Record<string, any>;
  sent_at?: string;
  delivered_at?: string;
  read_at?: string;
  replied_at?: string;
  created_at: string;
  // Joined data
  contact?: { id: string; name: string; email?: string; phone?: string };
  deal?: { id: string; name: string };
  template?: { id: string; name: string };
  flow?: { id: string; name: string };
}

export interface AutomationLogFilters {
  channel?: 'whatsapp' | 'email';
  status?: string;
  flowId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  limit?: number;
}

export function useAutomationLogs(filters: AutomationLogFilters = {}) {
  return useQuery({
    queryKey: ["automation-logs", filters],
    queryFn: async () => {
      let query = supabase
        .from("automation_logs")
        .select(`
          *,
          contact:crm_contacts(id, name, email, phone),
          deal:crm_deals(id, name),
          template:automation_templates(id, name),
          flow:automation_flows(id, name)
        `)
        .order("created_at", { ascending: false })
        .limit(filters.limit || 100);

      if (filters.channel) {
        query = query.eq("channel", filters.channel);
      }

      if (filters.status) {
        query = query.eq("status", filters.status as any);
      }

      if (filters.flowId) {
        query = query.eq("flow_id", filters.flowId);
      }

      if (filters.startDate) {
        query = query.gte("created_at", filters.startDate);
      }

      if (filters.endDate) {
        query = query.lte("created_at", filters.endDate);
      }

      if (filters.search) {
        query = query.or(`recipient.ilike.%${filters.search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as AutomationLog[];
    },
  });
}

export interface AutomationMetricsData {
  total_sent: number;
  total_delivered: number;
  total_read: number;
  total_failed: number;
  total_pending: number;
  delivery_rate: number;
  read_rate: number;
  whatsapp_count: number;
  email_count: number;
}

export function useAutomationMetrics(period: 'today' | 'week' | 'month' | 'all' = 'week') {
  return useQuery({
    queryKey: ["automation-metrics", period],
    queryFn: async () => {
      let startDate: string | null = null;
      
      const now = new Date();
      switch (period) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
          break;
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
          break;
        case 'month':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
          break;
        case 'all':
          startDate = null;
          break;
      }

      let query = supabase
        .from("automation_logs")
        .select("status, channel");

      if (startDate) {
        query = query.gte("created_at", startDate);
      }

      const { data, error } = await query;
      if (error) throw error;

      const logs = data || [];
      
      const metrics: AutomationMetricsData = {
        total_sent: logs.filter(l => ['sent', 'delivered', 'read'].includes(l.status)).length,
        total_delivered: logs.filter(l => ['delivered', 'read'].includes(l.status)).length,
        total_read: logs.filter(l => l.status === 'read').length,
        total_failed: logs.filter(l => l.status === 'failed').length,
        total_pending: logs.filter(l => l.status === 'pending').length,
        delivery_rate: 0,
        read_rate: 0,
        whatsapp_count: logs.filter(l => l.channel === 'whatsapp').length,
        email_count: logs.filter(l => l.channel === 'email').length,
      };

      if (metrics.total_sent > 0) {
        metrics.delivery_rate = Math.round((metrics.total_delivered / metrics.total_sent) * 100);
        metrics.read_rate = Math.round((metrics.total_read / metrics.total_sent) * 100);
      }

      return metrics;
    },
  });
}

export function useQueueStatus() {
  return useQuery({
    queryKey: ["automation-queue-status"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("automation_queue")
        .select("status")
        .eq("status", "pending");

      if (error) throw error;
      
      return {
        pending_count: data?.length || 0,
      };
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}
