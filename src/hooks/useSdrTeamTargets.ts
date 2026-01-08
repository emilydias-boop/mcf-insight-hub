import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { startOfWeek, endOfWeek, startOfDay, endOfDay, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Types for SDR targets
export type SdrTargetType = 
  | 'sdr_agendamento_dia'
  | 'sdr_r1_agendada_dia'
  | 'sdr_r1_realizada_dia'
  | 'sdr_noshow_dia'
  | 'sdr_contrato_dia'
  | 'sdr_agendamento_semana'
  | 'sdr_r1_agendada_semana'
  | 'sdr_r1_realizada_semana'
  | 'sdr_noshow_semana'
  | 'sdr_contrato_semana';

export interface SdrTarget {
  id: string;
  target_type: string;
  target_name: string;
  week_start: string;
  week_end: string;
  target_value: number;
  current_value: number;
}

export interface SdrTargetConfig {
  type: SdrTargetType;
  label: string;
  period: 'day' | 'week';
}

export const SDR_TARGET_CONFIGS: SdrTargetConfig[] = [
  { type: 'sdr_agendamento_dia', label: 'Agendamento', period: 'day' },
  { type: 'sdr_r1_agendada_dia', label: 'R1 Agendada', period: 'day' },
  { type: 'sdr_r1_realizada_dia', label: 'R1 Realizada', period: 'day' },
  { type: 'sdr_noshow_dia', label: 'No-Show', period: 'day' },
  { type: 'sdr_contrato_dia', label: 'Contrato Pago', period: 'day' },
  { type: 'sdr_agendamento_semana', label: 'Agendamento', period: 'week' },
  { type: 'sdr_r1_agendada_semana', label: 'R1 Agendada', period: 'week' },
  { type: 'sdr_r1_realizada_semana', label: 'R1 Realizada', period: 'week' },
  { type: 'sdr_noshow_semana', label: 'No-Show', period: 'week' },
  { type: 'sdr_contrato_semana', label: 'Contrato Pago', period: 'week' },
];

// Fetch SDR team targets for current day/week
export const useSdrTeamTargets = () => {
  const today = new Date();
  const weekStart = startOfWeek(today, { locale: ptBR });
  const weekEnd = endOfWeek(today, { locale: ptBR });
  const dayStart = startOfDay(today);
  const dayEnd = endOfDay(today);

  return useQuery({
    queryKey: ['sdr-team-targets', format(weekStart, 'yyyy-MM-dd')],
    queryFn: async () => {
      // Fetch all SDR targets for this week
      const { data, error } = await supabase
        .from('team_targets')
        .select('*')
        .like('target_type', 'sdr_%')
        .eq('week_start', format(weekStart, 'yyyy-MM-dd'));

      if (error) throw error;
      
      return (data || []) as SdrTarget[];
    },
  });
};

// Upsert (create or update) SDR targets
export const useUpsertSdrTargets = () => {
  const queryClient = useQueryClient();
  const today = new Date();
  const weekStart = startOfWeek(today, { locale: ptBR });
  const weekEnd = endOfWeek(today, { locale: ptBR });

  return useMutation({
    mutationFn: async (targets: Record<SdrTargetType, number>) => {
      const weekStartStr = format(weekStart, 'yyyy-MM-dd');
      const weekEndStr = format(weekEnd, 'yyyy-MM-dd');

      // For each target type, upsert the value
      const upsertPromises = Object.entries(targets).map(async ([type, value]) => {
        const config = SDR_TARGET_CONFIGS.find(c => c.type === type);
        if (!config) return;

        // Check if target exists
        const { data: existing } = await supabase
          .from('team_targets')
          .select('id')
          .eq('target_type', type)
          .eq('week_start', weekStartStr)
          .single();

        if (existing) {
          // Update
          return supabase
            .from('team_targets')
            .update({ target_value: value })
            .eq('id', existing.id);
        } else {
          // Insert
          return supabase
            .from('team_targets')
            .insert({
              target_type: type,
              target_name: config.label,
              week_start: weekStartStr,
              week_end: weekEndStr,
              target_value: value,
              current_value: 0,
            });
        }
      });

      await Promise.all(upsertPromises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sdr-team-targets'] });
      toast.success('Metas atualizadas com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao salvar metas: ' + error.message);
    },
  });
};
