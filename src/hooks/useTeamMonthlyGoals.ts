import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, subMonths, parse } from 'date-fns';

export interface TeamMonthlyGoal {
  id: string;
  ano_mes: string;
  bu: string;
  meta_valor: number;
  meta_premio_ifood: number;
  supermeta_valor: number;
  supermeta_premio_ifood: number;
  ultrameta_valor: number;
  ultrameta_premio_ifood: number;
  meta_divina_valor: number;
  meta_divina_premio_sdr: number;
  meta_divina_premio_closer: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TeamMonthlyGoalWinner {
  id: string;
  goal_id: string;
  tipo_premio: 'ultrameta_ifood' | 'divina_sdr' | 'divina_closer';
  sdr_id: string | null;
  valor_premio: number;
  autorizado: boolean;
  autorizado_por: string | null;
  autorizado_em: string | null;
  created_at: string;
}

// Default values for new goals
export const DEFAULT_GOAL_VALUES = {
  meta_valor: 1000000,
  meta_premio_ifood: 0,
  supermeta_valor: 1300000,
  supermeta_premio_ifood: 0,
  ultrameta_valor: 1600000,
  ultrameta_premio_ifood: 0,
  meta_divina_valor: 2000000,
  meta_divina_premio_sdr: 0,
  meta_divina_premio_closer: 0,
};

// Fetch goals for a specific month and BU
export function useTeamMonthlyGoals(anoMes: string, bu: string) {
  return useQuery({
    queryKey: ['team-monthly-goals', anoMes, bu],
    queryFn: async (): Promise<TeamMonthlyGoal | null> => {
      const { data, error } = await supabase
        .from('team_monthly_goals')
        .select('*')
        .eq('ano_mes', anoMes)
        .eq('bu', bu)
        .maybeSingle();

      if (error) throw error;
      return data as TeamMonthlyGoal | null;
    },
    enabled: !!anoMes && !!bu,
  });
}

// Fetch all goals for a specific month
export function useTeamMonthlyGoalsByMonth(anoMes: string) {
  return useQuery({
    queryKey: ['team-monthly-goals-by-month', anoMes],
    queryFn: async (): Promise<TeamMonthlyGoal[]> => {
      const { data, error } = await supabase
        .from('team_monthly_goals')
        .select('*')
        .eq('ano_mes', anoMes);

      if (error) throw error;
      return (data || []) as TeamMonthlyGoal[];
    },
    enabled: !!anoMes,
  });
}

// Create or update goals
export function useUpsertTeamMonthlyGoals() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (goal: Omit<TeamMonthlyGoal, 'id' | 'created_at' | 'updated_at' | 'created_by'>) => {
      const { data: user } = await supabase.auth.getUser();
      
      // Check if exists
      const { data: existing } = await supabase
        .from('team_monthly_goals')
        .select('id')
        .eq('ano_mes', goal.ano_mes)
        .eq('bu', goal.bu)
        .maybeSingle();

      if (existing) {
        // Update
        const { data, error } = await supabase
          .from('team_monthly_goals')
          .update({
            ...goal,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        // Insert
        const { data, error } = await supabase
          .from('team_monthly_goals')
          .insert({
            ...goal,
            created_by: user.user?.id,
          })
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: (_, variables) => {
      toast.success('Metas salvas com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['team-monthly-goals'] });
      queryClient.invalidateQueries({ queryKey: ['team-monthly-goals-by-month', variables.ano_mes] });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao salvar metas: ${error.message}`);
    },
  });
}

// Copy goals from previous month
export function useCopyGoalsFromPreviousMonth() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ targetAnoMes, bu }: { targetAnoMes: string; bu: string }) => {
      // Parse target month and get previous
      const targetDate = parse(targetAnoMes, 'yyyy-MM', new Date());
      const previousDate = subMonths(targetDate, 1);
      const previousAnoMes = format(previousDate, 'yyyy-MM');

      // Fetch previous month's goals
      const { data: previousGoal, error: fetchError } = await supabase
        .from('team_monthly_goals')
        .select('*')
        .eq('ano_mes', previousAnoMes)
        .eq('bu', bu)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (!previousGoal) {
        throw new Error(`Não há configuração de metas para ${previousAnoMes}`);
      }

      const { data: user } = await supabase.auth.getUser();

      // Check if target already exists
      const { data: existing } = await supabase
        .from('team_monthly_goals')
        .select('id')
        .eq('ano_mes', targetAnoMes)
        .eq('bu', bu)
        .maybeSingle();

      const newGoal = {
        ano_mes: targetAnoMes,
        bu,
        meta_valor: previousGoal.meta_valor,
        meta_premio_ifood: previousGoal.meta_premio_ifood,
        supermeta_valor: previousGoal.supermeta_valor,
        supermeta_premio_ifood: previousGoal.supermeta_premio_ifood,
        ultrameta_valor: previousGoal.ultrameta_valor,
        ultrameta_premio_ifood: previousGoal.ultrameta_premio_ifood,
        meta_divina_valor: previousGoal.meta_divina_valor,
        meta_divina_premio_sdr: previousGoal.meta_divina_premio_sdr,
        meta_divina_premio_closer: previousGoal.meta_divina_premio_closer,
      };

      if (existing) {
        const { data, error } = await supabase
          .from('team_monthly_goals')
          .update({
            ...newGoal,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from('team_monthly_goals')
          .insert({
            ...newGoal,
            created_by: user.user?.id,
          })
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: (_, variables) => {
      toast.success('Metas copiadas do mês anterior!');
      queryClient.invalidateQueries({ queryKey: ['team-monthly-goals'] });
      queryClient.invalidateQueries({ queryKey: ['team-monthly-goals-by-month', variables.targetAnoMes] });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao copiar metas: ${error.message}`);
    },
  });
}

// Get winners for a goal
export function useTeamMonthlyGoalWinners(goalId: string | undefined) {
  return useQuery({
    queryKey: ['team-monthly-goal-winners', goalId],
    queryFn: async (): Promise<TeamMonthlyGoalWinner[]> => {
      if (!goalId) return [];
      
      const { data, error } = await supabase
        .from('team_monthly_goal_winners')
        .select('*')
        .eq('goal_id', goalId);

      if (error) throw error;
      return (data || []) as TeamMonthlyGoalWinner[];
    },
    enabled: !!goalId,
  });
}

// Authorize a winner
export function useAuthorizeWinner() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (winnerId: string) => {
      const { data: user } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('team_monthly_goal_winners')
        .update({
          autorizado: true,
          autorizado_por: user.user?.id,
          autorizado_em: new Date().toISOString(),
        })
        .eq('id', winnerId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Premiação autorizada!');
      queryClient.invalidateQueries({ queryKey: ['team-monthly-goal-winners'] });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao autorizar: ${error.message}`);
    },
  });
}
