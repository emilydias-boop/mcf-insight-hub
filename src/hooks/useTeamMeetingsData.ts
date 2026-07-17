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
  totalReembolsos?: number;
  totalR1Agendada: number;
  totalSemStatus?: number;
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
  semStatus?: number;        // invited/rescheduled/sem_sucesso (cap 2/lead)
  pendentes?: number;        // R1 Agendada - Realizadas - No-Shows (vindo do RPC)
  contratos: number;         // Contratos pagos no período
  reembolsos?: number;       // Reembolsos atribuídos ao SDR do R1 mais recente
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

    // Build a map of metrics keyed by lowercased email for quick lookup
    const metricsByEmail = new Map<string, SdrAgendaMetrics>();
    metrics.forEach((m: SdrAgendaMetrics) => {
      if (m.sdr_email) metricsByEmail.set(m.sdr_email.toLowerCase(), m);
    });

    // Union of all emails: SDRs that belong/belonged to the squad + SDRs that have metrics
    const allEmails = new Set<string>();
    if (validSdrEmails.size > 0) {
      validSdrEmails.forEach(e => allEmails.add(e));
      // Also include metrics emails that are part of the valid set (filter by squad membership)
      metrics.forEach((m: SdrAgendaMetrics) => {
        const e = m.sdr_email?.toLowerCase();
        if (e && validSdrEmails.has(e)) allEmails.add(e);
      });
    } else {
      // No squad metadata available — fall back to whatever metrics return
      metrics.forEach((m: SdrAgendaMetrics) => {
        const e = m.sdr_email?.toLowerCase();
        if (e) allEmails.add(e);
      });
    }

    return Array.from(allEmails)
      .map((emailLower) => {
        const m = metricsByEmail.get(emailLower);
        const meta = sdrMetaMap.get(emailLower);
        const sdrEmail = m?.sdr_email || emailLower;
        const sdrName = meta?.name
          || sdrEmail.split('@')[0]
          || 'Desconhecido';

        return {
          sdrEmail,
          sdrName,
          agendamentos: m?.agendamentos ?? 0,
          r1Agendada: m?.r1_agendada ?? 0,
          r1Realizada: m?.r1_realizada ?? 0,
          noShows: m?.no_shows ?? 0,
          semStatus: m?.sem_status ?? 0,
          pendentes: m?.pendentes ?? Math.max(
            (m?.r1_agendada ?? 0) - (m?.r1_realizada ?? 0) - (m?.no_shows ?? 0),
            0,
          ),
          contratos: m?.contratos ?? 0,
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
    const totalSemStatus = bySDR.reduce((sum, s) => sum + (s.semStatus || 0), 0);

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
      totalSemStatus,
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

  // Mesmo conjunto de reuniões SEM dedup global por deal_id.
  // Necessário para o drilldown de no-show espelhar a regra do KPI
  // (cap 1 por lead antes de 2026-04-28, cap 2 depois).
  const allMeetingsRaw = useMemo(() => {
    return meetingsQuery.data || [];
  }, [meetingsQuery.data]);

  return {
    teamKPIs,
    bySDR,
    allMeetings,
    allMeetingsRaw,
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
