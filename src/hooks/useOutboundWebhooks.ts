import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface OutboundWebhookConfig {
  id: string;
  name: string;
  description: string | null;
  url: string;
  method: string;
  headers: Record<string, string>;
  events: string[];
  sources: string[];
  product_categories: string[] | null;
  is_active: boolean;
  secret_token: string | null;
  success_count: number;
  error_count: number;
  last_triggered_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface CreateOutboundWebhookConfig {
  name: string;
  description?: string | null;
  url: string;
  method?: string;
  headers?: Record<string, string>;
  events?: string[];
  sources?: string[];
  product_categories?: string[] | null;
  is_active?: boolean;
  secret_token?: string | null;
}

export interface OutboundWebhookLog {
  id: string;
  config_id: string;
  event: string;
  transaction_id: string | null;
  payload: any;
  response_status: number | null;
  response_body: string | null;
  duration_ms: number | null;
  success: boolean;
  error_message: string | null;
  created_at: string;
}

export const OUTBOUND_EVENTS = [
  { value: 'sale.created', label: 'Venda Criada' },
  { value: 'sale.updated', label: 'Venda Atualizada' },
  { value: 'sale.refunded', label: 'Venda Reembolsada' },
] as const;

export const OUTBOUND_SOURCES = [
  { value: 'hubla', label: 'Hubla' },
  { value: 'kiwify', label: 'Kiwify' },
  { value: 'mcfpay', label: 'MCFPay' },
  { value: 'make', label: 'Make' },
  { value: 'asaas', label: 'Asaas' },
  { value: 'manual', label: 'Manual' },
] as const;

export function useOutboundWebhooks() {
  return useQuery({
    queryKey: ['outbound-webhooks'],
    queryFn: async (): Promise<OutboundWebhookConfig[]> => {
      const { data, error } = await supabase
        .from('outbound_webhook_configs')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as any;
    },
    refetchInterval: 15000,
  });
}

export function useOutboundWebhookLogs(configId: string | null, limit: number = 100) {
  return useQuery({
    queryKey: ['outbound-webhook-logs', configId, limit],
    queryFn: async (): Promise<OutboundWebhookLog[]> => {
      if (!configId) return [];
      const { data, error } = await supabase
        .from('outbound_webhook_logs')
        .select('*')
        .eq('config_id', configId)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data || []) as any;
    },
    enabled: !!configId,
  });
}

export function useCreateOutboundWebhook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (cfg: CreateOutboundWebhookConfig) => {
      const { data, error } = await supabase
        .from('outbound_webhook_configs')
        .insert(cfg as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['outbound-webhooks'] });
      toast.success('Webhook de saída criado');
    },
    onError: (e: any) => toast.error('Erro ao criar webhook: ' + e.message),
  });
}

export function useUpdateOutboundWebhook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<OutboundWebhookConfig> & { id: string }) => {
      const { data, error } = await supabase
        .from('outbound_webhook_configs')
        .update(updates as any)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['outbound-webhooks'] });
      toast.success('Webhook atualizado');
    },
    onError: (e: any) => toast.error('Erro ao atualizar: ' + e.message),
  });
}

export function useDeleteOutboundWebhook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('outbound_webhook_configs').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['outbound-webhooks'] });
      toast.success('Webhook excluído');
    },
    onError: (e: any) => toast.error('Erro ao excluir: ' + e.message),
  });
}

export function useToggleOutboundWebhook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('outbound_webhook_configs')
        .update({ is_active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['outbound-webhooks'] });
      toast.success(vars.is_active ? 'Webhook ativado' : 'Webhook desativado');
    },
  });
}

export function useTestOutboundWebhook() {
  return useMutation({
    mutationFn: async (configId: string) => {
      const { data, error } = await supabase.functions.invoke('outbound-webhook-test', {
        body: { config_id: configId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      if (data?.success) {
        toast.success(`Teste enviado com sucesso (HTTP ${data.status} em ${data.duration_ms}ms)`);
      } else {
        toast.error(`Falha no teste: ${data?.error || data?.status || 'erro desconhecido'}`);
      }
    },
    onError: (e: any) => toast.error('Erro ao testar: ' + e.message),
  });
}