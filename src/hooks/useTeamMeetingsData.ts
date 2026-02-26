import { useMemo } from "react";
import { MeetingV2 } from "./useSdrMetricsV2";
import { useSdrMetricsFromAgenda, SdrAgendaMetrics } from "./useSdrMetricsFromAgenda";
import { useSdrMeetingsFromAgenda } from "./useSdrMeetingsFromAgenda";
import { useSdrsFromSquad } from "./useSdrsFromSquad";

export interface TeamKPIs {
  sdrCount: number;
  totalAgendamentos: number;
  totalRealizadas: number;
  totalNoShows: number;
  totalContratos: number;
  totalOutside: number;
  totalR1Agendada: number;
  taxaConversao: number;
  taxaNoShow: number;
}

export interface SdrSummaryRow {
  sdrEmail: string;
  sdrName: string;
  agendamentos: number;      // Criados no período (created_at)
  r1Agendada: number;        // Reuniões PARA o período (scheduled_at)
  r1Realizada: number;       // Realizadas no período
  noShows: number;           // No-shows no período
  contratos: number;         // Contratos pagos no período
}

interface TeamMeetingsParams {
  startDate: Date | null;
  endDate: Date | null;
  sdrEmailFilter?: string; // Filter for a specific SDR
  originIdFilter?: string; // Filter by origin (for future use)
  squad?: string; // BU squad filter (default: 'incorporador')
}

export function useTeamMeetingsData({ startDate, endDate, sdrEmailFilter, squad = 'incorporador' }: TeamMeetingsParams) {
  // Fetch active SDRs from the specified squad dynamically
  const sdrsQuery = useSdrsFromSquad(squad);
  
  // Fetch metrics from agenda (meeting_slot_attendees) instead of deal_activities
  const metricsQuery = useSdrMetricsFromAgenda(startDate, endDate, sdrEmailFilter);
  // Use meetings from agenda (same source as metrics) for consistency
  const meetingsQuery = useSdrMeetingsFromAgenda({ startDate, endDate, sdrEmailFilter });

  // Create Set of valid SDR emails from database (dynamic)
  const validSdrEmails = useMemo(() => {
    const sdrs = sdrsQuery.data || [];
    return new Set(sdrs.filter(sdr => sdr.email).map(sdr => sdr.email!.toLowerCase()));
  }, [sdrsQuery.data]);

  // Create lookup for SDR names from database
  const sdrNameMap = useMemo(() => {
    const map = new Map<string, string>();
    const sdrs = sdrsQuery.data || [];
    sdrs.filter(sdr => sdr.email).forEach(sdr => {
      map.set(sdr.email!.toLowerCase(), sdr.name);
    });
    return map;
  }, [sdrsQuery.data]);

  // Build summary rows per SDR - FILTERED to only include the 13 SDRs from SDR_LIST
  const bySDR = useMemo((): SdrSummaryRow[] => {
    const metrics = metricsQuery.data?.metrics || [];

    return metrics
      .filter((m: SdrAgendaMetrics) => 
        validSdrEmails.has(m.sdr_email?.toLowerCase() || '')
      )
      .map((m: SdrAgendaMetrics) => {
        const sdrName = sdrNameMap.get(m.sdr_email?.toLowerCase() || '') 
          || m.sdr_email?.split('@')[0] 
          || 'Desconhecido';
        
        return {
          sdrEmail: m.sdr_email,
          sdrName,
          agendamentos: m.agendamentos,
          r1Agendada: m.r1_agendada,
          r1Realizada: m.r1_realizada,
          // No-Show vem corrigido da RPC (r1_agendada - r1_realizada)
          noShows: m.no_shows || 0,
          contratos: m.contratos,
        };
      })
      .sort((a, b) => b.agendamentos - a.agendamentos);
  }, [metricsQuery.data, validSdrEmails, sdrNameMap]);

  // Calculate team KPIs from FILTERED SDRs only
  const teamKPIs = useMemo((): TeamKPIs => {
    // Sum up from filtered bySDR data
    const totalAgendamentos = bySDR.reduce((sum, s) => sum + s.agendamentos, 0);
    const totalRealizadas = bySDR.reduce((sum, s) => sum + s.r1Realizada, 0);
    const totalNoShows = bySDR.reduce((sum, s) => sum + s.noShows, 0);
    const totalContratos = bySDR.reduce((sum, s) => sum + s.contratos, 0);

    const taxaConversao = totalRealizadas > 0
      ? (totalContratos / totalRealizadas) * 100
      : 0;
    // Taxa de No-Show usa R1 Agendada como base (reuniões que deveriam ocorrer)
    const totalR1Agendada = bySDR.reduce((sum, s) => sum + s.r1Agendada, 0);
    const taxaNoShow = totalR1Agendada > 0
      ? (totalNoShows / totalR1Agendada) * 100
      : 0;

    return {
      sdrCount: bySDR.length,
      totalAgendamentos,
      totalRealizadas,
      totalNoShows,
      totalContratos,
      totalOutside: 0, // Will be enriched by useSdrOutsideMetrics in the page
      totalR1Agendada,
      taxaConversao,
      taxaNoShow,
    };
  }, [bySDR]);

  // Helper to deduplicate meetings by deal_id (keep first occurrence)
  const deduplicateMeetings = (meetings: MeetingV2[]): MeetingV2[] => {
    const seen = new Set<string>();
    return meetings.filter(m => {
      if (seen.has(m.deal_id)) return false;
      seen.add(m.deal_id);
      return true;
    });
  };

  // Get meetings for a specific SDR (only if they're in the valid SDR list)
  const getMeetingsForSDR = (sdrEmail: string): MeetingV2[] => {
    if (!validSdrEmails.has(sdrEmail.toLowerCase())) {
      return [];
    }
    const meetings = meetingsQuery.data || [];
    const sdrLower = sdrEmail.toLowerCase();
    const filtered = meetings.filter(
      m => (m.current_owner?.toLowerCase() === sdrLower) || (m.intermediador?.toLowerCase() === sdrLower)
    );
    return deduplicateMeetings(filtered);
  };

  // All meetings filtered to only the 13 SDRs
  const allMeetings = useMemo(() => {
    const meetings = meetingsQuery.data || [];
    const filtered = meetings.filter(
      m => validSdrEmails.has(m.current_owner?.toLowerCase() || '')
    );
    return deduplicateMeetings(filtered);
  }, [meetingsQuery.data, validSdrEmails]);

  return {
    teamKPIs,
    bySDR,
    allMeetings,
    getMeetingsForSDR,
    isLoading: sdrsQuery.isLoading || metricsQuery.isLoading || meetingsQuery.isLoading,
    error: sdrsQuery.error || metricsQuery.error || meetingsQuery.error,
    refetch: () => {
      sdrsQuery.refetch();
      metricsQuery.refetch();
      meetingsQuery.refetch();
    },
  };
}
