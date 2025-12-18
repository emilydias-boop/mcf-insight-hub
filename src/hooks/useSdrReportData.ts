import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, endOfDay, format } from 'date-fns';

// Interface atualizada com nova lógica de contagem
export interface SdrReportMetrics {
  sdr_email: string;
  sdr_name: string;
  primeiro_agendamento: number;
  reagendamento: number;
  r1_agendada: number; // = primeiro_agendamento + reagendamento (para compatibilidade)
  r1_realizada: number;
  no_shows: number;
  contratos: number;
  taxa_conversao: number;
  taxa_no_show: number;
}

interface MetricsResponse {
  metrics: Array<{
    sdr_email: string;
    sdr_name: string;
    primeiro_agendamento: number;
    reagendamento: number;
    total_agendamentos: number;
    no_shows: number;
    realizadas: number;
    contratos: number;
    taxa_conversao: number;
    taxa_no_show: number;
  }>;
  summary: {
    total_primeiro_agendamento: number;
    total_reagendamento: number;
    total_agendamentos: number;
    total_no_shows: number;
    total_realizadas: number;
    total_contratos: number;
  };
}

export function useSdrReportData(startDate: Date | null, endDate: Date | null) {
  return useQuery({
    queryKey: ['sdr-report-v2', startDate?.toISOString(), endDate?.toISOString()],
    queryFn: async (): Promise<SdrReportMetrics[]> => {
      if (!startDate || !endDate) return [];

      const start = format(startOfDay(startDate), 'yyyy-MM-dd');
      const end = format(endOfDay(endDate), 'yyyy-MM-dd');

      // Usar nova RPC com lógica de contagem correta
      const { data, error } = await supabase.rpc('get_sdr_metrics_v2', {
        start_date: start,
        end_date: end,
        sdr_email_filter: null
      });

      if (error) {
        console.error('[useSdrReportData] RPC error:', error);
        throw error;
      }

      const result = data as unknown as MetricsResponse;
      
      // Converter para formato esperado pelo componente
      const metrics: SdrReportMetrics[] = (result?.metrics || []).map(m => ({
        sdr_email: m.sdr_email,
        sdr_name: m.sdr_name,
        primeiro_agendamento: m.primeiro_agendamento,
        reagendamento: m.reagendamento,
        r1_agendada: m.total_agendamentos, // Total = 1º + Reagendamento
        r1_realizada: m.realizadas,
        no_shows: m.no_shows,
        contratos: m.contratos,
        taxa_conversao: m.taxa_conversao,
        taxa_no_show: m.taxa_no_show
      }));

      // Ordenar por realizadas descending
      metrics.sort((a, b) => b.r1_realizada - a.r1_realizada);

      return metrics;
    },
    enabled: !!startDate && !!endDate,
    staleTime: 30000
  });
}
