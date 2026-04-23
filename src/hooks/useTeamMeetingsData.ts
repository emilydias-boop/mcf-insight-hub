import { useMemo } from "react";
import { MeetingV2 } from "./useSdrMetricsV2";
import { useSdrMetricsFromAgenda, SdrAgendaMetrics } from "./useSdrMetricsFromAgenda";
import { useSdrMeetingsFromAgenda } from "./useSdrMeetingsFromAgenda";
import { useSdrsFromSquad } from "./useSdrsFromSquad";
import { useSdrsForSquadInPeriod } from "./useSdrsForSquadInPeriod";

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
  isExSquad?: boolean;       // SDR pertencia ao squad no período mas hoje está em outro
  currentSquad?: string | null;
}

interface TeamMeetingsParams {
  startDate: Date | null;
  endDate: Date | null;
  sdrEmailFilter?: string; // Filter for a specific SDR
  originIdFilter?: string; // Filter by origin (for future use)
  squad?: string; // BU squad filter (default: 'incorporador')
}

export function useTeamMeetingsData({ startDate, endDate, sdrEmailFilter, squad = 'incorporador' }: TeamMeetingsParams) {
  // Fetch SDRs that belonged to this squad at any point during the period (uses sdr_squad_history)
  const sdrsInPeriodQuery = useSdrsForSquadInPeriod(squad, startDate, endDate);
  // Also fetch current squad members to support "today" preset (allSdrsWithZeros, etc.)
  const sdrsQuery = useSdrsFromSquad(squad);

  // Fetch metrics from agenda (meeting_slot_attendees) instead of deal_activities
  const metricsQuery = useSdrMetricsFromAgenda(startDate, endDate, sdrEmailFilter, squad);
  const meetingsQuery = useSdrMeetingsFromAgenda({ startDate, endDate, sdrEmailFilter, buFilter: squad });

  // Build a metadata map keyed by lowercased email combining both sources.
  // Period-based list takes precedence (so historical SDRs are included with isExSquad flag).
  const sdrMetaMap = useMemo(() => {
    const map = new Map<string, { name: string; isExSquad: boolean; currentSquad: string | null }>();

    // Current squad members (foto atual)
    (sdrsQuery.data || []).forEach(sdr => {
      if (!sdr.email) return;
      map.set(sdr.email.toLowerCase(), {
        name: sdr.name,
        isExSquad: false,
        currentSquad: squad,
      });
    });

    // Historical members for the period (overwrites with richer info)
    (sdrsInPeriodQuery.data || []).forEach(sdr => {
      if (!sdr.email) return;
      map.set(sdr.email.toLowerCase(), {
        name: sdr.name,
        isExSquad: !sdr.is_currently_in_squad,
        currentSquad: sdr.current_squad ?? null,
      });
    });

    return map;
  }, [sdrsQuery.data, sdrsInPeriodQuery.data, squad]);

  const validSdrEmails = useMemo(() => new Set(sdrMetaMap.keys()), [sdrMetaMap]);

  // Build summary rows per SDR - filtered to SDRs that belong/belonged to the squad
  const bySDR = useMemo((): SdrSummaryRow[] => {
    const metrics = metricsQuery.data?.metrics || [];

    return metrics
      .filter((m: SdrAgendaMetrics) => {
        if (validSdrEmails.size > 0) {
          return validSdrEmails.has(m.sdr_email?.toLowerCase() || '');
        }
        return true;
      })
      .map((m: SdrAgendaMetrics) => {
        const meta = sdrMetaMap.get(m.sdr_email?.toLowerCase() || '');
        const sdrName = meta?.name
          || m.sdr_email?.split('@')[0]
          || 'Desconhecido';

        return {
          sdrEmail: m.sdr_email,
          sdrName,
          agendamentos: m.agendamentos,
          r1Agendada: m.r1_agendada,
          r1Realizada: m.r1_realizada,
          noShows: m.no_shows || 0,
          contratos: m.contratos,
          isExSquad: meta?.isExSquad ?? false,
          currentSquad: meta?.currentSquad ?? null,
        };
      })
      .sort((a, b) => {
        // Active SDRs first, ex-squad SDRs last
        if (a.isExSquad !== b.isExSquad) return a.isExSquad ? 1 : -1;
        return b.agendamentos - a.agendamentos;
      });
  }, [metricsQuery.data, sdrMetaMap, validSdrEmails]);

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
    return deduplicateMeetings(meetings);
  }, [meetingsQuery.data]);

  return {
    teamKPIs,
    bySDR,
    allMeetings,
    getMeetingsForSDR,
    isLoading: sdrsQuery.isLoading || sdrsInPeriodQuery.isLoading || metricsQuery.isLoading || meetingsQuery.isLoading,
    error: sdrsQuery.error || sdrsInPeriodQuery.error || metricsQuery.error || meetingsQuery.error,
    refetch: () => {
      sdrsQuery.refetch();
      sdrsInPeriodQuery.refetch();
      metricsQuery.refetch();
      meetingsQuery.refetch();
    },
  };
}
