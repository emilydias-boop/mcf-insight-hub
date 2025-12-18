import { useMemo } from "react";
import { useSdrMetricsV2, useSdrMeetingsV2, SdrMetricsV2, MeetingV2 } from "./useSdrMetricsV2";
import { SDR_LIST } from "@/constants/team";

export interface TeamKPIs {
  sdrCount: number;
  totalAgendamentos: number;
  totalRealizadas: number;
  totalNoShows: number;
  totalContratos: number;
  taxaConversao: number;
  taxaNoShow: number;
}

export interface SdrSummaryRow {
  sdrEmail: string;
  sdrName: string;
  primeiroAgendamento: number;
  reagendamento: number;
  totalAgendamentos: number;
  realizadas: number;
  noShows: number;
  contratos: number;
  taxaConversao: number;
  taxaNoShow: number;
}

interface TeamMeetingsParams {
  startDate: Date | null;
  endDate: Date | null;
  sdrEmailFilter?: string; // Filter for a specific SDR
  originIdFilter?: string; // Filter by origin (for future use)
}

export function useTeamMeetingsData({ startDate, endDate, sdrEmailFilter }: TeamMeetingsParams) {
  // Fetch metrics for all SDRs (no email filter) or specific SDR
  const metricsQuery = useSdrMetricsV2(startDate, endDate, sdrEmailFilter);
  const meetingsQuery = useSdrMeetingsV2(startDate, endDate, sdrEmailFilter);

  // Calculate team KPIs from aggregated metrics
  const teamKPIs = useMemo((): TeamKPIs => {
    const metrics = metricsQuery.data?.metrics || [];
    const summary = metricsQuery.data?.summary;

    if (summary) {
      const taxaConversao = summary.total_agendamentos > 0
        ? (summary.total_realizadas / summary.total_agendamentos) * 100
        : 0;
      const taxaNoShow = summary.total_agendamentos > 0
        ? (summary.total_no_shows / summary.total_agendamentos) * 100
        : 0;

      return {
        sdrCount: metrics.length,
        totalAgendamentos: summary.total_agendamentos,
        totalRealizadas: summary.total_realizadas,
        totalNoShows: summary.total_no_shows,
        totalContratos: summary.total_contratos,
        taxaConversao,
        taxaNoShow,
      };
    }

    return {
      sdrCount: 0,
      totalAgendamentos: 0,
      totalRealizadas: 0,
      totalNoShows: 0,
      totalContratos: 0,
      taxaConversao: 0,
      taxaNoShow: 0,
    };
  }, [metricsQuery.data]);

  // Build summary rows per SDR
  const bySDR = useMemo((): SdrSummaryRow[] => {
    const metrics = metricsQuery.data?.metrics || [];
    
    // Create lookup for SDR names
    const sdrNameMap = new Map<string, string>();
    SDR_LIST.forEach(sdr => {
      sdrNameMap.set(sdr.email.toLowerCase(), sdr.nome);
    });

    return metrics.map((m: SdrMetricsV2) => {
      const sdrName = sdrNameMap.get(m.sdr_email?.toLowerCase() || '') || m.sdr_name || m.sdr_email?.split('@')[0] || 'Desconhecido';
      
      return {
        sdrEmail: m.sdr_email,
        sdrName,
        primeiroAgendamento: m.primeiro_agendamento,
        reagendamento: m.reagendamento,
        totalAgendamentos: m.total_agendamentos,
        realizadas: m.realizadas,
        noShows: m.no_shows,
        contratos: m.contratos,
        taxaConversao: m.taxa_conversao,
        taxaNoShow: m.taxa_no_show,
      };
    }).sort((a, b) => b.totalAgendamentos - a.totalAgendamentos);
  }, [metricsQuery.data]);

  // Get meetings for a specific SDR
  const getMeetingsForSDR = (sdrEmail: string): MeetingV2[] => {
    const allMeetings = meetingsQuery.data || [];
    return allMeetings.filter(
      m => m.intermediador?.toLowerCase() === sdrEmail.toLowerCase()
    );
  };

  // All meetings (useful for listing when filtering by specific SDR)
  const allMeetings = meetingsQuery.data || [];

  return {
    teamKPIs,
    bySDR,
    allMeetings,
    getMeetingsForSDR,
    isLoading: metricsQuery.isLoading || meetingsQuery.isLoading,
    error: metricsQuery.error || meetingsQuery.error,
    refetch: () => {
      metricsQuery.refetch();
      meetingsQuery.refetch();
    },
  };
}
