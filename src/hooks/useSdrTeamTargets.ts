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
  | 'sdr_r2_agendada_dia'
  | 'sdr_r2_realizada_dia'
  | 'sdr_venda_realizada_dia'
  | 'sdr_agendamento_semana'
  | 'sdr_r1_agendada_semana'
  | 'sdr_r1_realizada_semana'
  | 'sdr_noshow_semana'
  | 'sdr_contrato_semana'
  | 'sdr_r2_agendada_semana'
  | 'sdr_r2_realizada_semana'
  | 'sdr_venda_realizada_semana'
  | 'sdr_agendamento_mes'
  | 'sdr_r1_agendada_mes'
  | 'sdr_r1_realizada_mes'
  | 'sdr_noshow_mes'
  | 'sdr_contrato_mes'
  | 'sdr_r2_agendada_mes'
  | 'sdr_r2_realizada_mes'
  | 'sdr_venda_realizada_mes';

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
  period: 'day' | 'week' | 'month';
}

export const SDR_TARGET_CONFIGS: SdrTargetConfig[] = [
  { type: 'sdr_agendamento_dia', label: 'Agendamento', period: 'day' },
  { type: 'sdr_r1_agendada_dia', label: 'R1 Agendada', period: 'day' },
  { type: 'sdr_r1_realizada_dia', label: 'R1 Realizada', period: 'day' },
  { type: 'sdr_noshow_dia', label: 'No-Show', period: 'day' },
  { type: 'sdr_contrato_dia', label: 'Contrato Pago', period: 'day' },
  { type: 'sdr_r2_agendada_dia', label: 'R2 Agendada', period: 'day' },
  { type: 'sdr_r2_realizada_dia', label: 'R2 Realizada', period: 'day' },
  { type: 'sdr_venda_realizada_dia', label: 'Vendas Realizadas', period: 'day' },
  { type: 'sdr_agendamento_semana', label: 'Agendamento', period: 'week' },
  { type: 'sdr_r1_agendada_semana', label: 'R1 Agendada', period: 'week' },
  { type: 'sdr_r1_realizada_semana', label: 'R1 Realizada', period: 'week' },
  { type: 'sdr_noshow_semana', label: 'No-Show', period: 'week' },
  { type: 'sdr_contrato_semana', label: 'Contrato Pago', period: 'week' },
  { type: 'sdr_r2_agendada_semana', label: 'R2 Agendada', period: 'week' },
  { type: 'sdr_r2_realizada_semana', label: 'R2 Realizada', period: 'week' },
  { type: 'sdr_venda_realizada_semana', label: 'Vendas Realizadas', period: 'week' },
  { type: 'sdr_agendamento_mes', label: 'Agendamento', period: 'month' },
  { type: 'sdr_r1_agendada_mes', label: 'R1 Agendada', period: 'month' },
  { type: 'sdr_r1_realizada_mes', label: 'R1 Realizada', period: 'month' },
  { type: 'sdr_noshow_mes', label: 'No-Show', period: 'month' },
  { type: 'sdr_contrato_mes', label: 'Contrato Pago', period: 'month' },
  { type: 'sdr_r2_agendada_mes', label: 'R2 Agendada', period: 'month' },
  { type: 'sdr_r2_realizada_mes', label: 'R2 Realizada', period: 'month' },
  { type: 'sdr_venda_realizada_mes', label: 'Vendas Realizadas', period: 'month' },
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
        if (!config) return { success: true };

        // Check if target exists using maybeSingle() to avoid 406 error
        const { data: existing, error: selectError } = await supabase
          .from('team_targets')
          .select('id')
          .eq('target_type', type)
          .eq('week_start', weekStartStr)
          .maybeSingle();

        if (selectError) {
          console.error('Error checking existing target:', selectError);
          return { success: false, error: selectError };
        }

        if (existing) {
          // Update
          const { error: updateError } = await supabase
            .from('team_targets')
            .update({ target_value: value })
            .eq('id', existing.id);
          
          if (updateError) {
            console.error('Error updating target:', updateError);
            return { success: false, error: updateError };
          }
        } else {
          // Insert
          const { error: insertError } = await supabase
            .from('team_targets')
            .insert({
              target_type: type,
              target_name: config.label,
              week_start: weekStartStr,
              week_end: weekEndStr,
              target_value: value,
              current_value: 0,
            });
          
          if (insertError) {
            console.error('Error inserting target:', insertError);
            return { success: false, error: insertError };
          }
        }

        return { success: true };
      });

      const results = await Promise.all(upsertPromises);
      const failed = results.filter(r => r && !r.success);
      if (failed.length > 0) {
        throw new Error(`Falha ao salvar ${failed.length} metas`);
      }
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
