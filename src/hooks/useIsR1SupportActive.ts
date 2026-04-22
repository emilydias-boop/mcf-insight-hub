import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useMyCloser } from '@/hooks/useMyCloser';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';

export interface R1SupportDay {
  id: string;
  closer_id: string;
  support_date: string; // YYYY-MM-DD
  start_time: string | null;
  end_time: string | null;
  notes: string | null;
}

/**
 * Retorna se o usuário (closer R2) tem ao menos uma liberação de "Apoio R1"
 * com data >= hoje. Quando ativo, o sistema deve tratá-lo como SDR temporário
 * no contexto da Agenda R1 (busca de leads, agendamento, navegação).
 *
 * - isActive: existe ao menos 1 entrada futura/atual em closer_r1_support_days.
 * - supportDates: lista das datas liberadas (ordem crescente).
 * - isActiveOnDate(date): helper para checar se uma data específica está liberada.
 */
export function useIsR1SupportActive() {
  const { user } = useAuth();
  const { data: myCloser } = useMyCloser();

  const closerId = myCloser?.id;

  const query = useQuery({
    queryKey: ['r1-support-active', closerId],
    queryFn: async (): Promise<R1SupportDay[]> => {
      if (!closerId) return [];
      const today = format(new Date(), 'yyyy-MM-dd');
      const { data, error } = await supabase
        .from('closer_r1_support_days')
        .select('id, closer_id, support_date, start_time, end_time, notes')
        .eq('closer_id', closerId)
        .gte('support_date', today)
        .order('support_date', { ascending: true });

      if (error) throw error;
      return (data || []) as R1SupportDay[];
    },
    enabled: !!user?.id && !!closerId,
    staleTime: 60_000,
  });

  const supportDays = query.data || [];
  const supportDates = supportDays.map((d) => d.support_date);

  const isActiveOnDate = (date: Date | string) => {
    const key = typeof date === 'string' ? date : format(date, 'yyyy-MM-dd');
    return supportDates.includes(key);
  };

  return {
    isActive: supportDays.length > 0,
    supportDays,
    supportDates,
    isActiveOnDate,
    isLoading: query.isLoading,
  };
}
