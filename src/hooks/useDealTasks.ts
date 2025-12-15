import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type TaskStatus = 'pending' | 'done' | 'canceled';
export type TaskType = 'call' | 'email' | 'meeting' | 'whatsapp' | 'other';

export interface DealTask {
  id: string;
  deal_id: string;
  contact_id: string | null;
  template_id: string | null;
  title: string;
  description: string | null;
  type: TaskType;
  status: TaskStatus;
  due_date: string | null;
  completed_at: string | null;
  completed_by: string | null;
  created_at: string | null;
  created_by: string | null;
  owner_id: string | null;
}

export function useDealTasks(dealId: string) {
  return useQuery({
    queryKey: ['deal-tasks', dealId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deal_tasks')
        .select('*')
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
    mutationFn: async (task: Omit<DealTask, 'id' | 'created_at' | 'completed_at' | 'completed_by'>) => {
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
      toast.success('Atividade criada');
    },
    onError: (error) => {
      toast.error('Erro ao criar atividade: ' + error.message);
    },
  });
}

export function useUpdateDealTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, dealId, ...updates }: Partial<DealTask> & { id: string; dealId: string }) => {
      const { data, error } = await supabase
        .from('deal_tasks')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return { data, dealId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['deal-tasks', result.dealId] });
      toast.success('Atividade atualizada');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar atividade: ' + error.message);
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
          status: 'done' as const,
          completed_at: new Date().toISOString(),
          completed_by: userId,
        })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return { data, dealId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['deal-tasks', result.dealId] });
      toast.success('Atividade concluída');
    },
    onError: (error) => {
      toast.error('Erro ao concluir atividade: ' + error.message);
    },
  });
}

export function useCancelDealTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, dealId }: { id: string; dealId: string }) => {
      const { data, error } = await supabase
        .from('deal_tasks')
        .update({ status: 'canceled' })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return { data, dealId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['deal-tasks', result.dealId] });
      toast.success('Atividade cancelada');
    },
    onError: (error) => {
      toast.error('Erro ao cancelar atividade: ' + error.message);
    },
  });
}

export function useCreateTasksFromTemplates() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      dealId, 
      templates, 
      createdBy,
      ownerId 
    }: { 
      dealId: string; 
      templates: Array<{ id: string; name: string; description: string | null; type: string; default_due_days: number | null }>;
      createdBy: string;
      ownerId?: string;
    }) => {
      const tasks = templates.map(template => ({
        deal_id: dealId,
        template_id: template.id,
        title: template.name,
        description: template.description,
        type: template.type as TaskType,
        status: 'pending' as TaskStatus,
        due_date: template.default_due_days 
          ? new Date(Date.now() + template.default_due_days * 24 * 60 * 60 * 1000).toISOString()
          : null,
        created_by: createdBy,
        owner_id: ownerId || null,
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
      toast.success('Atividades criadas a partir dos templates');
    },
    onError: (error) => {
      toast.error('Erro ao criar atividades: ' + error.message);
    },
  });
}
