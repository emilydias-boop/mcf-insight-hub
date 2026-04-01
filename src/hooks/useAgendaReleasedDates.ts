import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useActiveBU } from '@/hooks/useActiveBU';
import { toast } from 'sonner';

function getSettingsKey(bu: string | null): string {
  return `agenda_released_dates_${bu || 'incorporador'}`;
}

export function useAgendaReleasedDates() {
  const activeBU = useActiveBU();
  const key = getSettingsKey(activeBU);

  return useQuery({
    queryKey: ['agenda-released-dates', key],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('automation_settings')
        .select('value')
        .eq('key', key)
        .maybeSingle();

      if (error) throw error;
      if (!data?.value) return [] as string[];
      
      // value is stored as JSON array of date strings
      const dates = data.value as unknown;
      if (Array.isArray(dates)) return dates as string[];
      return [] as string[];
    },
  });
}

export function useToggleReleasedDate() {
  const activeBU = useActiveBU();
  const key = getSettingsKey(activeBU);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ dateStr, currentDates }: { dateStr: string; currentDates: string[] }) => {
      const isReleased = currentDates.includes(dateStr);
      const newDates = isReleased
        ? currentDates.filter(d => d !== dateStr)
        : [...currentDates, dateStr].sort();

      const { error } = await supabase
        .from('automation_settings')
        .upsert({
          key,
          value: newDates as unknown as Record<string, unknown>,
          description: `Datas liberadas para agendamento na agenda da BU ${activeBU || 'incorporador'}`,
        }, { onConflict: 'key' });

      if (error) throw error;
      return { newDates, added: !isReleased, dateStr };
    },
    onSuccess: ({ added, dateStr }) => {
      queryClient.invalidateQueries({ queryKey: ['agenda-released-dates'] });
      toast.success(added ? `${dateStr} liberado para agendamento` : `${dateStr} removido dos dias liberados`);
    },
    onError: () => {
      toast.error('Erro ao atualizar dias liberados');
    },
  });
}
