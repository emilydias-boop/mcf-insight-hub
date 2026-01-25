import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface WebhookEndpoint {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  origin_id: string | null;
  stage_id: string | null;
  auto_tags: string[];
  field_mapping: Record<string, string>;
  required_fields: string[];
  auth_header_name: string | null;
  auth_header_value: string | null;
  is_active: boolean;
  leads_received: number;
  last_lead_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface CreateWebhookEndpoint {
  slug: string;
  name: string;
  description?: string;
  origin_id: string;
  stage_id?: string;
  auto_tags?: string[];
  field_mapping?: Record<string, string>;
  required_fields?: string[];
  auth_header_name?: string;
  auth_header_value?: string;
  is_active?: boolean;
}

const SUPABASE_URL = 'https://rehcfgqvigfcekiipqkc.supabase.co';

export const getWebhookUrl = (slug: string) => {
  return `${SUPABASE_URL}/functions/v1/webhook-lead-receiver/${slug}`;
};

export const useWebhookEndpoints = (originId?: string) => {
  return useQuery({
    queryKey: ['webhook-endpoints', originId],
    queryFn: async () => {
      let query = supabase
        .from('webhook_endpoints')
        .select('*')
        .order('created_at', { ascending: false });

      if (originId) {
        query = query.eq('origin_id', originId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as WebhookEndpoint[];
    },
  });
};

export const useCreateWebhookEndpoint = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (endpoint: CreateWebhookEndpoint) => {
      const { data, error } = await supabase
        .from('webhook_endpoints')
        .insert({
          slug: endpoint.slug,
          name: endpoint.name,
          description: endpoint.description || null,
          origin_id: endpoint.origin_id,
          stage_id: endpoint.stage_id || null,
          auto_tags: endpoint.auto_tags || [],
          field_mapping: endpoint.field_mapping || {},
          required_fields: endpoint.required_fields || ['name', 'email'],
          auth_header_name: endpoint.auth_header_name || null,
          auth_header_value: endpoint.auth_header_value || null,
          is_active: endpoint.is_active ?? true,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhook-endpoints'] });
      toast.success('Webhook de entrada criado com sucesso!');
    },
    onError: (error) => {
      console.error('Error creating webhook endpoint:', error);
      if (error.message?.includes('duplicate key')) {
        toast.error('Já existe um webhook com este slug');
      } else {
        toast.error('Erro ao criar webhook: ' + error.message);
      }
    },
  });
};

export const useUpdateWebhookEndpoint = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<WebhookEndpoint> & { id: string }) => {
      const { data, error } = await supabase
        .from('webhook_endpoints')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhook-endpoints'] });
      toast.success('Webhook atualizado com sucesso!');
    },
    onError: (error) => {
      console.error('Error updating webhook endpoint:', error);
      toast.error('Erro ao atualizar webhook: ' + error.message);
    },
  });
};

export const useDeleteWebhookEndpoint = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('webhook_endpoints')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhook-endpoints'] });
      toast.success('Webhook excluído com sucesso!');
    },
    onError: (error) => {
      console.error('Error deleting webhook endpoint:', error);
      toast.error('Erro ao excluir webhook: ' + error.message);
    },
  });
};

export const useToggleWebhookEndpoint = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { data, error } = await supabase
        .from('webhook_endpoints')
        .update({ is_active })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['webhook-endpoints'] });
      toast.success(data.is_active ? 'Webhook ativado!' : 'Webhook desativado!');
    },
    onError: (error) => {
      console.error('Error toggling webhook endpoint:', error);
      toast.error('Erro ao alterar status: ' + error.message);
    },
  });
};
