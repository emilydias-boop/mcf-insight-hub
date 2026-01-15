import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

export interface R2VendasKPIs {
  vendasRealizadas: number;
}

export const useR2VendasKPIs = (startDate: Date, endDate: Date) => {
  return useQuery({
    queryKey: ['r2-vendas-kpis', format(startDate, 'yyyy-MM-dd'), format(endDate, 'yyyy-MM-dd')],
    queryFn: async (): Promise<R2VendasKPIs> => {
      const startStr = format(startDate, 'yyyy-MM-dd');
      const endStr = format(endDate, 'yyyy-MM-dd');

      // Fetch deal_activities for Vendas stage only
      // R2 Agendadas/Realizadas now come from meeting_slots (useR2MeetingSlotsKPIs)
      const { data, error } = await supabase
        .from('deal_activities')
        .select('to_stage, created_at')
        .eq('to_stage', 'Venda realizada')
        .gte('created_at', `${startStr}T00:00:00`)
        .lte('created_at', `${endStr}T23:59:59`);

      if (error) {
        console.error('Error fetching Vendas KPIs:', error);
        throw error;
      }

      const vendasRealizadas = (data || []).length;

      return {
        vendasRealizadas,
      };
    },
    staleTime: 30 * 1000,
  });
};
