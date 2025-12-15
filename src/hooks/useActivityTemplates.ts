import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ActivityTemplate {
  id: string;
  name: string;
  description: string | null;
  type: 'call' | 'email' | 'meeting' | 'whatsapp' | 'other';
  origin_id: string | null;
  stage_id: string | null;
  default_due_days: number | null;
  order_index: number;
  is_active: boolean | null;
  created_at: string | null;
  created_by: string | null;
  // New fields
  script_title: string | null;
  script_body: string | null;
  sla_offset_minutes: number | null;
}

export function useActivityTemplates(originId?: string, stageId?: string) {
  return useQuery({
    queryKey: ['activity-templates', originId, stageId],
    queryFn: async () => {
      let query = supabase
        .from('activity_templates')
        .select('*')
        .eq('is_active', true)
        .order('order_index', { ascending: true });

      if (originId) {
        query = query.or(`origin_id.eq.${originId},origin_id.is.null`);
      }
      if (stageId) {
        query = query.or(`stage_id.eq.${stageId},stage_id.is.null`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ActivityTemplate[];
    },
  });
}

export function useActivityTemplatesByStage(originId?: string, stageId?: string) {
  return useQuery({
    queryKey: ['activity-templates-by-stage', originId, stageId],
    queryFn: async () => {
      if (!stageId) return [];
      
      let query = supabase
        .from('activity_templates')
        .select('*')
        .eq('is_active', true)
        .eq('stage_id', stageId)
        .order('order_index', { ascending: true });

      if (originId) {
        query = query.or(`origin_id.eq.${originId},origin_id.is.null`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ActivityTemplate[];
    },
    enabled: !!stageId,
  });
}

export function useAllActivityTemplates() {
  return useQuery({
    queryKey: ['activity-templates-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activity_templates')
        .select('*')
        .order('order_index', { ascending: true });
      if (error) throw error;
      return data as ActivityTemplate[];
    },
  });
}

export function useCreateActivityTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (template: Omit<ActivityTemplate, 'id' | 'created_at' | 'created_by'>) => {
      const { data, error } = await supabase
        .from('activity_templates')
        .insert(template)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activity-templates'] });
      toast.success('Template criado com sucesso');
    },
    onError: (error) => {
      toast.error('Erro ao criar template: ' + error.message);
    },
  });
}

export function useUpdateActivityTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ActivityTemplate> & { id: string }) => {
      const { data, error } = await supabase
        .from('activity_templates')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activity-templates'] });
      toast.success('Template atualizado');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar template: ' + error.message);
    },
  });
}

export function useDeleteActivityTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('activity_templates')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activity-templates'] });
      toast.success('Template removido');
    },
    onError: (error) => {
      toast.error('Erro ao remover template: ' + error.message);
    },
  });
}
