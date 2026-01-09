import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

export interface R2VendasKPIs {
  r2Agendadas: number;
  r2Realizadas: number;
  vendasRealizadas: number;
}

export const useR2VendasKPIs = (startDate: Date, endDate: Date) => {
  return useQuery({
    queryKey: ['r2-vendas-kpis', format(startDate, 'yyyy-MM-dd'), format(endDate, 'yyyy-MM-dd')],
    queryFn: async (): Promise<R2VendasKPIs> => {
      const startStr = format(startDate, 'yyyy-MM-dd');
      const endStr = format(endDate, 'yyyy-MM-dd');

      // Fetch deal_activities for R2 and Vendas stages
      const { data, error } = await supabase
        .from('deal_activities')
        .select('to_stage, created_at')
        .in('to_stage', ['Reunião 02 Agendada', 'Reunião 02 Realizada', 'Venda realizada'])
        .gte('created_at', `${startStr}T00:00:00`)
        .lte('created_at', `${endStr}T23:59:59`);

      if (error) {
        console.error('Error fetching R2/Vendas KPIs:', error);
        throw error;
      }

      // Count by stage
      let r2Agendadas = 0;
      let r2Realizadas = 0;
      let vendasRealizadas = 0;

      (data || []).forEach(activity => {
        switch (activity.to_stage) {
          case 'Reunião 02 Agendada':
            r2Agendadas++;
            break;
          case 'Reunião 02 Realizada':
            r2Realizadas++;
            break;
          case 'Venda realizada':
            vendasRealizadas++;
            break;
        }
      });

      return {
        r2Agendadas,
        r2Realizadas,
        vendasRealizadas,
      };
    },
    staleTime: 30 * 1000,
  });
};
