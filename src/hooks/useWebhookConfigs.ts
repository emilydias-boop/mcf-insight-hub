import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface WebhookConfig {
  id: string;
  origin_id: string | null;
  name: string;
  description: string | null;
  url: string;
  method: string;
  headers: Record<string, string>;
  events: string[];
  stage_ids: string[] | null;
  is_active: boolean;
  last_triggered_at: string | null;
  success_count: number;
  error_count: number;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface CreateWebhookConfig {
  origin_id?: string | null;
  name: string;
  description?: string | null;
  url: string;
  method?: string;
  headers?: Record<string, string>;
  events: string[];
  stage_ids?: string[] | null;
  is_active?: boolean;
}

export interface UpdateWebhookConfig extends Partial<CreateWebhookConfig> {
  id: string;
}

export const WEBHOOK_EVENTS = [
  { value: 'deal.created', label: 'Negócio Criado' },
  { value: 'deal.updated', label: 'Negócio Atualizado' },
  { value: 'deal.stage_changed', label: 'Mudança de Etapa' },
  { value: 'deal.won', label: 'Negócio Ganho' },
  { value: 'deal.lost', label: 'Negócio Perdido' },
  { value: 'contact.created', label: 'Contato Criado' },
  { value: 'contact.updated', label: 'Contato Atualizado' },
] as const;

export function useWebhookConfigs(originId?: string | null) {
  return useQuery({
    queryKey: ['webhook-configs', originId],
    queryFn: async (): Promise<WebhookConfig[]> => {
      let query = supabase
        .from('webhook_configs')
        .select('*')
        .order('created_at', { ascending: false });

      if (originId) {
        query = query.eq('origin_id', originId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data || []) as WebhookConfig[];
    },
  });
}

export function useCreateWebhookConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (config: CreateWebhookConfig) => {
      const { data, error } = await supabase
        .from('webhook_configs')
        .insert(config)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhook-configs'] });
      toast.success('Webhook criado com sucesso');
    },
    onError: (error) => {
      console.error('Error creating webhook:', error);
      toast.error('Erro ao criar webhook');
    },
  });
}

export function useUpdateWebhookConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: UpdateWebhookConfig) => {
      const { data, error } = await supabase
        .from('webhook_configs')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhook-configs'] });
      toast.success('Webhook atualizado');
    },
    onError: (error) => {
      console.error('Error updating webhook:', error);
      toast.error('Erro ao atualizar webhook');
    },
  });
}

export function useDeleteWebhookConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('webhook_configs')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhook-configs'] });
      toast.success('Webhook excluído');
    },
    onError: (error) => {
      console.error('Error deleting webhook:', error);
      toast.error('Erro ao excluir webhook');
    },
  });
}

export function useToggleWebhookConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { data, error } = await supabase
        .from('webhook_configs')
        .update({ is_active })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, { is_active }) => {
      queryClient.invalidateQueries({ queryKey: ['webhook-configs'] });
      toast.success(is_active ? 'Webhook ativado' : 'Webhook desativado');
    },
    onError: (error) => {
      console.error('Error toggling webhook:', error);
      toast.error('Erro ao alterar status do webhook');
    },
  });
}
