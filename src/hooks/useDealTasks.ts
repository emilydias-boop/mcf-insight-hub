import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { addMinutes } from 'date-fns';
import { ActivityTemplate } from './useActivityTemplates';

export type TaskStatus = 'pending' | 'done' | 'canceled';
export type TaskType = 'call' | 'email' | 'meeting' | 'whatsapp' | 'other';

export interface DealTask {
  id: string;
  deal_id: string;
  contact_id: string | null;
  template_id: string | null;
  owner_id: string | null;
  title: string;
  description: string | null;
  type: TaskType;
  due_date: string | null;
  status: TaskStatus;
  completed_at: string | null;
  completed_by: string | null;
  created_at: string | null;
  created_by: string | null;
  // Joined template data (optional)
  template?: ActivityTemplate | null;
}

export function useDealTasks(dealId: string) {
  return useQuery({
    queryKey: ['deal-tasks', dealId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deal_tasks')
        .select(`
          *,
          template:activity_templates(*)
        `)
        .eq('deal_id', dealId)
        .order('due_date', { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data as DealTask[];
    },
    enabled: !!dealId,
  });
}

export function useCreateDealTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (task: Omit<DealTask, 'id' | 'created_at' | 'completed_at' | 'completed_by' | 'template'>) => {
      const { data, error } = await supabase
        .from('deal_tasks')
        .insert(task)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['deal-tasks', variables.deal_id] });
      toast.success('Tarefa criada');
    },
    onError: (error) => {
      toast.error('Erro ao criar tarefa: ' + error.message);
    },
  });
}

export function useUpdateDealTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, dealId, ...updates }: Partial<DealTask> & { id: string; dealId: string }) => {
      const { template, ...updateData } = updates as any;
      const { data, error } = await supabase
        .from('deal_tasks')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return { data, dealId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['deal-tasks', result.dealId] });
    },
    onError: (error) => {
      toast.error('Erro ao atualizar tarefa: ' + error.message);
    },
  });
}

export function useCompleteDealTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, dealId, userId }: { id: string; dealId: string; userId: string }) => {
      const { data, error } = await supabase
        .from('deal_tasks')
        .update({
          status: 'done',
          completed_at: new Date().toISOString(),
          completed_by: userId,
        })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      
      // Log activity for task completion
      await supabase.from('deal_activities').insert({
        deal_id: dealId,
        activity_type: 'task_completed',
        description: `Tarefa "${data.title}" concluída`,
        user_id: userId,
        metadata: { task_id: id, task_title: data.title, task_type: data.type }
      });
      
      return { data, dealId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['deal-tasks', result.dealId] });
      queryClient.invalidateQueries({ queryKey: ['deal-activities'] });
      toast.success('Tarefa concluída');
    },
    onError: (error) => {
      toast.error('Erro ao concluir tarefa: ' + error.message);
    },
  });
}

export function useCancelDealTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, dealId }: { id: string; dealId: string }) => {
      const { error } = await supabase
        .from('deal_tasks')
        .update({ status: 'canceled' })
        .eq('id', id);
      if (error) throw error;
      return dealId;
    },
    onSuccess: (dealId) => {
      queryClient.invalidateQueries({ queryKey: ['deal-tasks', dealId] });
      toast.success('Tarefa cancelada');
    },
    onError: (error) => {
      toast.error('Erro ao cancelar tarefa: ' + error.message);
    },
  });
}

export function useCreateTasksFromTemplates() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      dealId,
      contactId,
      ownerId,
      templates,
      createdBy,
    }: {
      dealId: string;
      contactId?: string | null;
      ownerId?: string | null;
      templates: ActivityTemplate[];
      createdBy?: string;
    }) => {
      const now = new Date();
      const tasks = templates.map((template) => ({
        deal_id: dealId,
        contact_id: contactId || null,
        template_id: template.id,
        owner_id: ownerId || null,
        title: template.name,
        description: template.description,
        type: template.type,
        status: 'pending' as TaskStatus,
        due_date: template.sla_offset_minutes 
          ? addMinutes(now, template.sla_offset_minutes).toISOString()
          : template.default_due_days
            ? addMinutes(now, template.default_due_days * 24 * 60).toISOString()
            : null,
        created_by: createdBy || null,
      }));

      const { data, error } = await supabase
        .from('deal_tasks')
        .insert(tasks)
        .select();

      if (error) throw error;
      return { data, dealId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['deal-tasks', result.dealId] });
    },
    onError: (error) => {
      toast.error('Erro ao criar tarefas: ' + error.message);
    },
  });
}

export function useGenerateTasksForStage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      dealId,
      contactId,
      ownerId,
      originId,
      stageId,
      createdBy,
    }: {
      dealId: string;
      contactId?: string | null;
      ownerId?: string | null;
      originId?: string | null;
      stageId: string;
      createdBy?: string;
    }) => {
      // Fetch templates for this stage
      let query = supabase
        .from('activity_templates')
        .select('*')
        .eq('is_active', true)
        .eq('stage_id', stageId)
        .order('order_index', { ascending: true });

      if (originId) {
        query = query.or(`origin_id.eq.${originId},origin_id.is.null`);
      }

      const { data: templates, error: fetchError } = await query;
      if (fetchError) throw fetchError;

      if (!templates || templates.length === 0) {
        return { created: 0, dealId };
      }

      // Create tasks from templates
      const now = new Date();
      const tasks = templates.map((template: any) => ({
        deal_id: dealId,
        contact_id: contactId || null,
        template_id: template.id,
        owner_id: ownerId || null,
        title: template.name,
        description: template.description,
        type: template.type,
        status: 'pending' as TaskStatus,
        due_date: template.sla_offset_minutes 
          ? addMinutes(now, template.sla_offset_minutes).toISOString()
          : template.default_due_days
            ? addMinutes(now, template.default_due_days * 24 * 60).toISOString()
            : null,
        created_by: createdBy || null,
      }));

      const { data, error } = await supabase
        .from('deal_tasks')
        .insert(tasks)
        .select();

      if (error) throw error;
      return { created: data?.length || 0, dealId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['deal-tasks', result.dealId] });
      if (result.created > 0) {
        toast.success(`${result.created} tarefa(s) criada(s) automaticamente`);
      }
    },
    onError: (error) => {
      console.error('Erro ao gerar tarefas:', error);
    },
  });
}
