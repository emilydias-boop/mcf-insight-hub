import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth } from "date-fns";

export interface SdrAgendaMetricsById {
  r1_agendada: number;
  r1_realizada: number;
  no_shows: number;
  contratos: number;
  vendas_parceria: number;
}

export const useSdrAgendaMetricsBySdrId = (sdrId: string | undefined, anoMes: string | undefined) => {
  return useQuery({
    queryKey: ['sdr-agenda-metrics-by-id', sdrId, anoMes],
    queryFn: async (): Promise<SdrAgendaMetricsById> => {
      if (!sdrId || !anoMes) {
        return { r1_agendada: 0, r1_realizada: 0, no_shows: 0, contratos: 0, vendas_parceria: 0 };
      }

      // 1. Buscar email do SDR
      const { data: sdr, error: sdrError } = await supabase
        .from('sdr')
        .select('email')
        .eq('id', sdrId)
        .single();

      if (sdrError || !sdr?.email) {
        console.error('[useSdrAgendaMetricsBySdrId] Error fetching SDR:', sdrError);
        return { r1_agendada: 0, r1_realizada: 0, no_shows: 0, contratos: 0, vendas_parceria: 0 };
      }

      // 2. Calcular período do mês
      const [year, month] = anoMes.split('-').map(Number);
      const monthDate = new Date(year, month - 1, 1);
      const startDate = format(startOfMonth(monthDate), 'yyyy-MM-dd');
      const endDate = format(endOfMonth(monthDate), 'yyyy-MM-dd');

      // 3. Chamar RPC get_sdr_metrics_from_agenda
      const { data, error } = await supabase.rpc('get_sdr_metrics_from_agenda', {
        start_date: startDate,
        end_date: endDate,
        sdr_email_filter: sdr.email
      });

      if (error) {
        console.error('[useSdrAgendaMetricsBySdrId] RPC error:', error);
        return { r1_agendada: 0, r1_realizada: 0, no_shows: 0, contratos: 0, vendas_parceria: 0 };
      }

      // Handle response - extract first metric from array
      const response = data as unknown as { metrics: Array<{
        r1_agendada: number;
        r1_realizada: number;
        no_shows: number;
        contratos: number;
        vendas_parceria?: number;
      }> };

      const metrics = response?.metrics?.[0];

      return {
        r1_agendada: metrics?.r1_agendada || 0,
        r1_realizada: metrics?.r1_realizada || 0,
        no_shows: metrics?.no_shows || 0,
        contratos: metrics?.contratos || 0,
        vendas_parceria: metrics?.vendas_parceria || 0,
      };
    },
    enabled: !!sdrId && !!anoMes,
    staleTime: 30000,
  });
};
