import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSdrMetricsFromAgenda } from "./useSdrMetricsFromAgenda";
import { useSdrMeetingsFromAgenda } from "./useSdrMeetingsFromAgenda";

export interface MinhasReunioesSummary {
  primeiroAgendamento: number;
  reagendamento: number;
  totalAgendamentos: number;
  r1Agendada: number;
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

  // Buscar o squad real do SDR logado (consorcio, incorporador, etc.) para
  // que a RPC aplique o filtro correto. Antes estava hardcoded como
  // 'incorporador', zerando os números dos SDRs de Consórcio.
  const { data: sdrRecord } = useQuery({
    queryKey: ['minhas-reunioes-sdr-squad', user?.id, sdrEmail],
    queryFn: async () => {
      if (!user?.id && !sdrEmail) return null;
      let result = null as { squad: string | null } | null;
      if (user?.id) {
        const { data } = await supabase
          .from('sdr')
          .select('squad')
          .eq('user_id', user.id)
          .maybeSingle();
        result = data as any;
      }
      if (!result && sdrEmail) {
        const { data } = await supabase
          .from('sdr')
          .select('squad')
          .eq('email', sdrEmail)
          .maybeSingle();
        result = data as any;
      }
      return result;
    },
    enabled: !!(user?.id || sdrEmail),
    staleTime: 5 * 60 * 1000,
  });

  // Fallback para 'incorporador' se squad ainda não carregou — preserva
  // comportamento anterior para usuários sem squad cadastrado.
  const squad = sdrRecord?.squad || 'incorporador';
  const metricsQuery = useSdrMetricsFromAgenda(startDate, endDate, sdrEmail, squad);
  const meetingsQuery = useSdrMeetingsFromAgenda({ 
    startDate, 
    endDate, 
    sdrEmailFilter: sdrEmail,
    buFilter: squad,
  });

  const myMetrics = metricsQuery.data?.metrics?.[0];

  // Calcular métricas derivadas
  const agendamentos = myMetrics?.agendamentos || 0;
  const r1Agendada = myMetrics?.r1_agendada || 0;
  const r1Realizada = myMetrics?.r1_realizada || 0;
  // No-Show vem corrigido da RPC (r1_agendada - r1_realizada)
  const noShows = myMetrics?.no_shows || 0;
  const contratos = myMetrics?.contratos || 0;

  // Taxa de conversão: realizadas / r1_agendada
  const taxaConversao = r1Agendada > 0 
    ? Math.round((r1Realizada / r1Agendada) * 100) 
    : 0;

  // Taxa de no-show: no_shows / r1_agendada
  const taxaNoShow = r1Agendada > 0 
    ? Math.round((noShows / r1Agendada) * 100) 
    : 0;

  const summary: MinhasReunioesSummary = {
    primeiroAgendamento: agendamentos,
    reagendamento: 0, // Agenda ainda não separa reagendamentos em métrica
    totalAgendamentos: agendamentos,
    r1Agendada,
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
