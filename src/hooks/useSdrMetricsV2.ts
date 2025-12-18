import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format, startOfDay, endOfDay } from "date-fns";

// Interfaces para métricas V2 com nova lógica de contagem
export interface SdrMetricsV2 {
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
}

export interface MeetingV2 {
  deal_id: string;
  deal_name: string;
  contact_name: string;
  contact_email: string | null;
  contact_phone: string | null;
  tipo: '1º Agendamento' | 'Reagendamento Válido' | 'Reagendamento Inválido';
  data_agendamento: string;
  status_atual: 'Agendada' | 'Realizada' | 'No-Show' | 'Contrato' | string;
  intermediador: string;
  current_owner: string | null;
  closer: string | null;
  origin_name: string | null;
  probability: number | null;
  conta: boolean; // Indica se este agendamento conta para as métricas
  from_stage?: string;
}

export interface MetricsSummary {
  total_primeiro_agendamento: number;
  total_reagendamento: number;
  total_agendamentos: number;
  total_no_shows: number;
  total_realizadas: number;
  total_contratos: number;
}

interface MetricsResponse {
  metrics: SdrMetricsV2[];
  summary: MetricsSummary;
}

// Hook para buscar métricas agregadas por SDR
export const useSdrMetricsV2 = (startDate: Date | null, endDate: Date | null, sdrEmailFilter?: string) => {
  return useQuery({
    queryKey: ['sdr-metrics-v2', startDate?.toISOString(), endDate?.toISOString(), sdrEmailFilter],
    queryFn: async (): Promise<MetricsResponse> => {
      if (!startDate || !endDate) {
        return { 
          metrics: [], 
          summary: { 
            total_primeiro_agendamento: 0, 
            total_reagendamento: 0, 
            total_agendamentos: 0, 
            total_no_shows: 0, 
            total_realizadas: 0, 
            total_contratos: 0 
          } 
        };
      }

      const start = format(startOfDay(startDate), 'yyyy-MM-dd');
      const end = format(endOfDay(endDate), 'yyyy-MM-dd');

      const { data, error } = await supabase.rpc('get_sdr_metrics_v2', {
        start_date: start,
        end_date: end,
        sdr_email_filter: sdrEmailFilter || null
      });

      if (error) {
        console.error('[useSdrMetricsV2] RPC error:', error);
        throw error;
      }

      const result = data as unknown as MetricsResponse;
      
      return {
        metrics: result?.metrics || [],
        summary: result?.summary || {
          total_primeiro_agendamento: 0,
          total_reagendamento: 0,
          total_agendamentos: 0,
          total_no_shows: 0,
          total_realizadas: 0,
          total_contratos: 0
        }
      };
    },
    enabled: !!startDate && !!endDate,
    staleTime: 30000,
    refetchInterval: 60000
  });
};

// Hook para buscar lista de reuniões com detalhes (TODOS os movimentos)
export const useSdrMeetingsV2 = (startDate: Date | null, endDate: Date | null, sdrEmailFilter?: string) => {
  return useQuery({
    queryKey: ['sdr-meetings-v2', startDate?.toISOString(), endDate?.toISOString(), sdrEmailFilter],
    queryFn: async (): Promise<MeetingV2[]> => {
      if (!startDate || !endDate) return [];

      const start = format(startOfDay(startDate), 'yyyy-MM-dd');
      const end = format(endOfDay(endDate), 'yyyy-MM-dd');

      // Usar nova RPC que retorna TODOS os movimentos com indicação se conta ou não
      const { data, error } = await supabase.rpc('get_sdr_all_movements_v2', {
        start_date: start,
        end_date: end,
        sdr_email_filter: sdrEmailFilter || null
      });

      if (error) {
        console.error('[useSdrMeetingsV2] RPC error:', error);
        throw error;
      }

      return (data as unknown as MeetingV2[]) || [];
    },
    enabled: !!startDate && !!endDate,
    staleTime: 30000,
    refetchInterval: 60000
  });
};

// Hook combinado para página "Minhas Reuniões"
export const useMinhasReunioesV2 = (startDate: Date | null, endDate: Date | null) => {
  const { user } = useAuth();
  const sdrEmail = user?.email || null;

  const metricsQuery = useSdrMetricsV2(startDate, endDate, sdrEmail || undefined);
  const meetingsQuery = useSdrMeetingsV2(startDate, endDate, sdrEmail || undefined);

  const myMetrics = metricsQuery.data?.metrics?.[0];

  return {
    meetings: meetingsQuery.data || [],
    summary: {
      primeiroAgendamento: myMetrics?.primeiro_agendamento || 0,
      reagendamento: myMetrics?.reagendamento || 0,
      totalAgendamentos: myMetrics?.total_agendamentos || 0,
      noShows: myMetrics?.no_shows || 0,
      realizadas: myMetrics?.realizadas || 0,
      contratos: myMetrics?.contratos || 0,
      taxaConversao: myMetrics?.taxa_conversao || 0,
      taxaNoShow: myMetrics?.taxa_no_show || 0
    },
    isLoading: metricsQuery.isLoading || meetingsQuery.isLoading,
    error: metricsQuery.error || meetingsQuery.error,
    refetch: () => {
      metricsQuery.refetch();
      meetingsQuery.refetch();
    }
  };
};
