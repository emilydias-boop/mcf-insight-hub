import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { startOfMonth, format } from 'date-fns';
import {
  SDR_TARGET_CONFIGS,
  CONSORCIO_SDR_TARGET_CONFIGS,
} from '@/hooks/useSdrTeamTargets';

// target_type -> day_of_week (0=domingo ... 6=sábado) -> valor
export type WeekdayTargetMap = Record<string, Record<number, number>>;

// Ordem de exibição: Seg → Dom (day_of_week no padrão JS Date.getDay())
export const WEEKDAY_ORDER: number[] = [1, 2, 3, 4, 5, 6, 0];
export const WEEKDAY_LABELS: Record<number, string> = {
  0: 'Dom',
  1: 'Seg',
  2: 'Ter',
  3: 'Qua',
  4: 'Qui',
  5: 'Sex',
  6: 'Sáb',
};

/**
 * Busca os overrides de meta do dia por dia da semana para um mês/BU.
 * Retorna um mapa target_type → day_of_week → valor.
 */
export const useSdrWeekdayTargets = (month: Date, buPrefix: string = 'sdr_') => {
  const monthStartStr = format(startOfMonth(month), 'yyyy-MM-dd');

  return useQuery({
    queryKey: ['sdr-weekday-targets', monthStartStr, buPrefix],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('team_target_weekday_overrides')
        .select('target_type, day_of_week, target_value')
        .like('target_type', `${buPrefix}%`)
        .eq('month_start', monthStartStr);

      if (error) throw error;

      const map: WeekdayTargetMap = {};
      (data || []).forEach(row => {
        if (!map[row.target_type]) map[row.target_type] = {};
        map[row.target_type][row.day_of_week] = Number(row.target_value) || 0;
      });
      return map;
    },
  });
};

/**
 * Resolve a meta do dia: usa override do dia da semana quando existir,
 * senão cai no valor único de team_targets (comportamento atual).
 */
export function resolveWeekdayTarget(
  overrides: WeekdayTargetMap | undefined,
  targetType: string,
  dayOfWeek: number,
  fallback: number
): number {
  const value = overrides?.[targetType]?.[dayOfWeek];
  return value === undefined || value === null ? fallback : value;
}

export const useUpsertSdrWeekdayTargets = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      targetMonth,
      overrides,
    }: {
      targetMonth: Date;
      overrides: WeekdayTargetMap;
    }) => {
      const monthStartStr = format(startOfMonth(targetMonth), 'yyyy-MM-dd');

      const rows: { target_type: string; target_name: string; day_of_week: number; target_value: number }[] = [];
      Object.entries(overrides).forEach(([targetType, byDay]) => {
        const config =
          SDR_TARGET_CONFIGS.find(c => c.type === targetType) ||
          CONSORCIO_SDR_TARGET_CONFIGS.find(c => c.type === targetType);
        if (!config) return;
        Object.entries(byDay).forEach(([dow, value]) => {
          rows.push({
            target_type: targetType,
            target_name: config.label,
            day_of_week: Number(dow),
            target_value: Math.max(0, Number(value) || 0),
          });
        });
      });

      const results = await Promise.all(
        rows.map(async row => {
          const { data: existing, error: selectError } = await supabase
            .from('team_target_weekday_overrides')
            .select('id')
            .eq('target_type', row.target_type)
            .eq('month_start', monthStartStr)
            .eq('day_of_week', row.day_of_week)
            .maybeSingle();

          if (selectError) {
            console.error('Error checking weekday override:', selectError);
            return { success: false };
          }

          if (existing) {
            const { error } = await supabase
              .from('team_target_weekday_overrides')
              .update({ target_value: row.target_value, target_name: row.target_name })
              .eq('id', existing.id);
            if (error) {
              console.error('Error updating weekday override:', error);
              return { success: false };
            }
          } else {
            const { error } = await supabase
              .from('team_target_weekday_overrides')
              .insert({
                target_type: row.target_type,
                target_name: row.target_name,
                month_start: monthStartStr,
                day_of_week: row.day_of_week,
                target_value: row.target_value,
              });
            if (error) {
              console.error('Error inserting weekday override:', error);
              return { success: false };
            }
          }

          return { success: true };
        })
      );

      const failed = results.filter(r => !r.success);
      if (failed.length > 0) {
        throw new Error(`Falha ao salvar ${failed.length} metas por dia da semana`);
      }
    },
    onSuccess: (_, variables) => {
      const monthStartStr = format(startOfMonth(variables.targetMonth), 'yyyy-MM-dd');
      queryClient.invalidateQueries({ queryKey: ['sdr-weekday-targets'] });
      queryClient.invalidateQueries({ queryKey: ['sdr-weekday-targets', monthStartStr] });
    },
    onError: (error: Error) => {
      toast.error('Erro ao salvar metas por dia da semana: ' + error.message);
    },
  });
};
