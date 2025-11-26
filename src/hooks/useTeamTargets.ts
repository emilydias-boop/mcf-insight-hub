import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface TeamTarget {
  id: string;
  target_type: 'funnel_stage' | 'ultrameta' | 'closer' | 'sdr' | 'team_revenue' | 'team_sales';
  target_name: string;
  reference_id: string | null;
  week_start: string;
  week_end: string;
  target_value: number;
  current_value: number;
  origin_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export const useTeamTargets = (weekStart?: Date, weekEnd?: Date, targetType?: string) => {
  return useQuery({
    queryKey: ['team-targets', weekStart?.toISOString(), weekEnd?.toISOString(), targetType],
    queryFn: async () => {
      let query = supabase
        .from('team_targets')
        .select('*')
        .order('target_name', { ascending: true });

      if (weekStart) {
        query = query.eq('week_start', weekStart.toISOString().split('T')[0]);
      }
      if (weekEnd) {
        query = query.eq('week_end', weekEnd.toISOString().split('T')[0]);
      }
      if (targetType) {
        query = query.eq('target_type', targetType);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      return data as TeamTarget[];
    },
  });
};

export const useCreateTeamTarget = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (target: Omit<TeamTarget, 'id' | 'created_at' | 'updated_at' | 'created_by'>) => {
      const { data, error } = await supabase
        .from('team_targets')
        .insert(target)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-targets'] });
      toast.success('Meta criada com sucesso');
    },
    onError: (error) => {
      toast.error('Erro ao criar meta: ' + error.message);
    },
  });
};

export const useUpdateTeamTarget = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<TeamTarget> }) => {
      const { data, error } = await supabase
        .from('team_targets')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-targets'] });
      toast.success('Meta atualizada com sucesso');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar meta: ' + error.message);
    },
  });
};

export const useDeleteTeamTarget = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('team_targets')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-targets'] });
      toast.success('Meta removida com sucesso');
    },
    onError: (error) => {
      toast.error('Erro ao remover meta: ' + error.message);
    },
  });
};

export const useCopyTargetsFromPreviousWeek = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ fromWeekStart, toWeekStart, toWeekEnd }: { fromWeekStart: Date; toWeekStart: Date; toWeekEnd: Date }) => {
      // Buscar metas da semana anterior
      const { data: previousTargets, error: fetchError } = await supabase
        .from('team_targets')
        .select('*')
        .eq('week_start', fromWeekStart.toISOString().split('T')[0]);

      if (fetchError) throw fetchError;
      if (!previousTargets || previousTargets.length === 0) {
        throw new Error('Nenhuma meta encontrada na semana anterior');
      }

      // Criar novas metas com as datas da nova semana
      const newTargets = previousTargets.map(target => ({
        target_type: target.target_type,
        target_name: target.target_name,
        reference_id: target.reference_id,
        week_start: toWeekStart.toISOString().split('T')[0],
        week_end: toWeekEnd.toISOString().split('T')[0],
        target_value: target.target_value,
        current_value: 0,
        origin_id: target.origin_id,
      }));

      const { error: insertError } = await supabase
        .from('team_targets')
        .insert(newTargets);

      if (insertError) throw insertError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-targets'] });
      toast.success('Metas copiadas com sucesso');
    },
    onError: (error) => {
      toast.error('Erro ao copiar metas: ' + error.message);
    },
  });
};
