import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfDay, endOfDay } from "date-fns";

export interface SdrAgendaMetrics {
  sdr_email: string;
  sdr_name: string;
  agendamentos: number;      // Criados no período (created_at)
  r1_agendada: number;       // Reuniões PARA o período (scheduled_at)
  r1_realizada: number;      // Realizadas no período
  no_shows: number;          // No-shows no período
  contratos: number;         // Contratos pagos no período
}

interface MetricsResponse {
  metrics: SdrAgendaMetrics[];
}

export const useSdrMetricsFromAgenda = (
  startDate: Date | null, 
  endDate: Date | null, 
  sdrEmailFilter?: string
) => {
  return useQuery({
    queryKey: ['sdr-metrics-agenda', 
      startDate ? format(startDate, 'yyyy-MM-dd') : null, 
      endDate ? format(endDate, 'yyyy-MM-dd') : null, 
      sdrEmailFilter
    ],
    queryFn: async (): Promise<MetricsResponse> => {
      if (!startDate || !endDate) {
        return { metrics: [] };
      }

      const start = format(startOfDay(startDate), 'yyyy-MM-dd');
      const end = format(endOfDay(endDate), 'yyyy-MM-dd');

      const { data, error } = await supabase.rpc('get_sdr_metrics_from_agenda', {
        start_date: start,
        end_date: end,
        sdr_email_filter: sdrEmailFilter || null
      });

      if (error) {
        console.error('[useSdrMetricsFromAgenda] RPC error:', error);
        throw error;
      }

      // Handle the response - it could be an object with metrics array or direct JSON
      const response = data as unknown as MetricsResponse;
      
      return {
        metrics: response?.metrics || []
      };
    },
    enabled: !!startDate && !!endDate,
    staleTime: 30000,
    refetchInterval: 60000,
  });
};
