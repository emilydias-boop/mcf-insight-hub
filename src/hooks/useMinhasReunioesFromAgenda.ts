import { useAuth } from "@/contexts/AuthContext";
import { useSdrMetricsFromAgenda } from "./useSdrMetricsFromAgenda";
import { useSdrMeetingsFromAgenda } from "./useSdrMeetingsFromAgenda";

export interface MinhasReunioesSummary {
  primeiroAgendamento: number;
  reagendamento: number;
  totalAgendamentos: number;
  noShows: number;
  realizadas: number;
  contratos: number;
  taxaConversao: number;
  taxaNoShow: number;
}

/**
 * Hook combinado para página "Minhas Reuniões" usando dados da AGENDA
 * (fonte de verdade) ao invés do Clint.
 */
export const useMinhasReunioesFromAgenda = (startDate: Date | null, endDate: Date | null) => {
  const { user } = useAuth();
  const sdrEmail = user?.email || undefined;

  const metricsQuery = useSdrMetricsFromAgenda(startDate, endDate, sdrEmail);
  const meetingsQuery = useSdrMeetingsFromAgenda({ 
    startDate, 
    endDate, 
    sdrEmailFilter: sdrEmail 
  });

  const myMetrics = metricsQuery.data?.metrics?.[0];

  // Calcular métricas derivadas
  const agendamentos = myMetrics?.agendamentos || 0;
  const r1Realizada = myMetrics?.r1_realizada || 0;
  const noShows = myMetrics?.no_shows || 0;
  const contratos = myMetrics?.contratos || 0;

  // Taxa de conversão: realizadas / (realizadas + no_shows)
  const taxaConversao = (r1Realizada + noShows) > 0 
    ? Math.round((r1Realizada / (r1Realizada + noShows)) * 100) 
    : 0;

  // Taxa de no-show: no_shows / (realizadas + no_shows)
  const taxaNoShow = (r1Realizada + noShows) > 0 
    ? Math.round((noShows / (r1Realizada + noShows)) * 100) 
    : 0;

  const summary: MinhasReunioesSummary = {
    primeiroAgendamento: agendamentos,
    reagendamento: 0, // Agenda ainda não separa reagendamentos em métrica
    totalAgendamentos: agendamentos,
    noShows,
    realizadas: r1Realizada,
    contratos,
    taxaConversao,
    taxaNoShow
  };

  return {
    meetings: meetingsQuery.data || [],
    summary,
    isLoading: metricsQuery.isLoading || meetingsQuery.isLoading,
    error: metricsQuery.error || meetingsQuery.error,
    refetch: () => {
      metricsQuery.refetch();
      meetingsQuery.refetch();
    }
  };
};
