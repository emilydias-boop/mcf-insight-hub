import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface MatchCondition {
  type: 'product_name' | 'tags' | 'custom_field';
  operator: 'contains' | 'equals' | 'includes_any' | 'includes_all';
  values: string[];
  field?: string;
}

export interface DealReplicationRule {
  id: string;
  name: string;
  description: string | null;
  source_origin_id: string;
  source_stage_id: string;
  target_origin_id: string;
  target_stage_id: string;
  match_condition: MatchCondition | null;
  is_active: boolean;
  copy_custom_fields: boolean;
  copy_tasks: boolean;
  priority: number;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  // Joined data
  source_origin?: { id: string; name: string };
  source_stage?: { id: string; name: string };
  target_origin?: { id: string; name: string };
  target_stage?: { id: string; name: string };
}

export interface CreateReplicationRuleInput {
  name: string;
  description?: string;
  source_origin_id: string;
  source_stage_id: string;
  target_origin_id: string;
  target_stage_id: string;
  match_condition?: MatchCondition | null;
  is_active?: boolean;
  copy_custom_fields?: boolean;
  copy_tasks?: boolean;
  priority?: number;
}

export interface ReplicationLog {
  id: string;
  rule_id: string;
  source_deal_id: string;
  target_deal_id: string;
  executed_at: string;
  status: string;
  error_message: string | null;
  metadata: Record<string, any> | null;
  rule?: { name: string };
  source_deal?: { name: string };
  target_deal?: { name: string };
}

// Fetch all replication rules
export const useDealReplicationRules = (originId?: string) => {
  return useQuery({
    queryKey: ['deal-replication-rules', originId],
    queryFn: async () => {
      let query = supabase
        .from('deal_replication_rules')
        .select(`
          *,
          source_origin:crm_origins!deal_replication_rules_source_origin_id_fkey(id, name),
          source_stage:crm_stages!deal_replication_rules_source_stage_id_fkey(id, stage_name),
          target_origin:crm_origins!deal_replication_rules_target_origin_id_fkey(id, name),
          target_stage:crm_stages!deal_replication_rules_target_stage_id_fkey(id, stage_name)
        `)
        .order('priority', { ascending: true });

      if (originId) {
        query = query.eq('source_origin_id', originId);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      
      // Transform data to handle JSONB parsing and rename stage_name to name
      return (data || []).map((rule: any) => ({
        ...rule,
        match_condition: rule.match_condition as MatchCondition | null,
        source_stage: rule.source_stage ? { id: rule.source_stage.id, name: rule.source_stage.stage_name } : undefined,
        target_stage: rule.target_stage ? { id: rule.target_stage.id, name: rule.target_stage.stage_name } : undefined,
      })) as DealReplicationRule[];
    },
  });
};

// Create a new rule
export const useCreateReplicationRule = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (input: CreateReplicationRuleInput) => {
      const { data, error } = await supabase
        .from('deal_replication_rules')
        .insert({
          ...input,
          match_condition: input.match_condition || {},
          is_active: input.is_active ?? true,
          copy_custom_fields: input.copy_custom_fields ?? true,
          copy_tasks: input.copy_tasks ?? false,
          priority: input.priority ?? 0,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deal-replication-rules'] });
      toast.success('Regra de replicação criada com sucesso');
    },
    onError: (error: any) => {
      console.error('Error creating replication rule:', error);
      toast.error('Erro ao criar regra de replicação');
    },
  });
};

// Update a rule
export const useUpdateReplicationRule = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, source_origin, source_stage, target_origin, target_stage, ...updates }: Partial<DealReplicationRule> & { id: string }) => {
      // Remove joined fields before updating
      const updateData = {
        ...updates,
        match_condition: updates.match_condition as any,
      };
      
      const { data, error } = await supabase
        .from('deal_replication_rules')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deal-replication-rules'] });
      toast.success('Regra atualizada com sucesso');
    },
    onError: (error: any) => {
      console.error('Error updating replication rule:', error);
      toast.error('Erro ao atualizar regra');
    },
  });
};

// Delete a rule
export const useDeleteReplicationRule = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('deal_replication_rules')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deal-replication-rules'] });
      toast.success('Regra excluída com sucesso');
    },
    onError: (error: any) => {
      console.error('Error deleting replication rule:', error);
      toast.error('Erro ao excluir regra');
    },
  });
};

// Toggle rule active status
export const useToggleReplicationRule = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { data, error } = await supabase
        .from('deal_replication_rules')
        .update({ is_active })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['deal-replication-rules'] });
      toast.success(variables.is_active ? 'Regra ativada' : 'Regra desativada');
    },
    onError: (error: any) => {
      console.error('Error toggling replication rule:', error);
      toast.error('Erro ao alterar status da regra');
    },
  });
};

// Fetch replication logs
export const useReplicationLogs = (ruleId?: string, limit = 50) => {
  return useQuery({
    queryKey: ['replication-logs', ruleId, limit],
    queryFn: async () => {
      let query = supabase
        .from('deal_replication_logs')
        .select(`
          *,
          rule:deal_replication_rules(name),
          source_deal:crm_deals!deal_replication_logs_source_deal_id_fkey(name),
          target_deal:crm_deals!deal_replication_logs_target_deal_id_fkey(name)
        `)
        .order('executed_at', { ascending: false })
        .limit(limit);

      if (ruleId) {
        query = query.eq('rule_id', ruleId);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      return data as ReplicationLog[];
    },
  });
};

// Fetch queue status
export const useReplicationQueue = () => {
  return useQuery({
    queryKey: ['replication-queue'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deal_replication_queue')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      return data;
    },
    refetchInterval: 10000, // Refresh every 10 seconds
  });
};

// Process queue manually
export const useProcessReplicationQueue = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('process-deal-replication', {
        body: { process_queue: true }
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['replication-queue'] });
      queryClient.invalidateQueries({ queryKey: ['replication-logs'] });
      toast.success(`Processados ${data?.processed || 0} itens da fila`);
    },
    onError: (error: any) => {
      console.error('Error processing queue:', error);
      toast.error('Erro ao processar fila de replicação');
    },
  });
};
