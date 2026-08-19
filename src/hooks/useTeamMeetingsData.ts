import { useMemo } from "react";
import { MeetingV2 } from "./useSdrMetricsV2";
import { useSdrMetricsFromAgenda, SdrAgendaMetrics } from "./useSdrMetricsFromAgenda";
import { useSdrMeetingsFromAgenda } from "./useSdrMeetingsFromAgenda";
import { useSdrsFromSquad } from "./useSdrsFromSquad";
import { useSdrsForSquadInPeriod } from "./useSdrsForSquadInPeriod";
import { useClosersFromBu } from "./useClosersFromBu";

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

/** Linhas que a RPC devolveu e o front descartou por não reconhecer o agendador.
 *  Só cobre o que é visível nesta camada (o que a RPC nunca devolveu é invisível aqui). */
export interface SdrUnassignedBucket {
  agendamentos: number;
  r1Agendada: number;
  r1Realizada: number;
  noShows: number;
  contratos: number;
  emails: string[];
}

interface TeamMeetingsParams {
  startDate: Date | null;
  endDate: Date | null;
  sdrEmailFilter?: string; // Filter for a specific SDR
  originIdFilter?: string; // Filter by origin (for future use)
  squad?: string; // BU squad filter (default: 'incorporador')
  segment?: string; // Segmento ICP opcional ('A' | 'B'); 'all'/undefined = sem filtro
}

export function useTeamMeetingsData({ startDate, endDate, sdrEmailFilter, squad = 'incorporador', segment }: TeamMeetingsParams) {
  // Fetch SDRs that belonged to this squad at any point during the period (uses sdr_squad_history)
  const sdrsInPeriodQuery = useSdrsForSquadInPeriod(squad, startDate, endDate);
  // Also fetch current squad members to support "today" preset (allSdrsWithZeros, etc.)
  const sdrsQuery = useSdrsFromSquad(squad);
  // Consórcio: closer que agenda R1 também é agendador válido (decisão do dono do
  // processo — o agendamento é creditado a quem agendou, não pode sumir).
  const isConsorcio = squad === 'consorcio';
  const closersQuery = useClosersFromBu(squad, isConsorcio);

  // Fetch metrics from agenda (meeting_slot_attendees) instead of deal_activities
  const metricsQuery = useSdrMetricsFromAgenda(startDate, endDate, sdrEmailFilter, squad, segment);
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

  // União: SDRs do squad (atuais + históricos) ∪ closers ativos da BU (só Consórcio).
  const validBookerEmails = useMemo(() => {
    const set = new Set(validSdrEmails);
    if (isConsorcio) {
      (closersQuery.data || []).forEach(c => {
        const email = c.email?.trim().toLowerCase();
        if (email) set.add(email);
      });
    }
    return set;
  }, [validSdrEmails, closersQuery.data, isConsorcio]);

  const closerNameByEmail = useMemo(() => {
    const map = new Map<string, string>();
    (closersQuery.data || []).forEach(c => {
      const email = c.email?.trim().toLowerCase();
      if (email) map.set(email, c.name);
    });
    return map;
  }, [closersQuery.data]);

  // Métricas devolvidas pela RPC cujo agendador o front não reconhece.
  const sdrUnassigned = useMemo((): SdrUnassignedBucket | null => {
    const metrics = metricsQuery.data?.metrics || [];
    if (validBookerEmails.size === 0) return null; // sem metadados: nada é descartado
    const bucket: SdrUnassignedBucket = {
      agendamentos: 0, r1Agendada: 0, r1Realizada: 0, noShows: 0, contratos: 0, emails: [],
    };
    metrics.forEach((m: SdrAgendaMetrics) => {
      const e = m.sdr_email?.toLowerCase();
      if (e && validBookerEmails.has(e)) return;
      bucket.agendamentos += m.agendamentos ?? 0;
      bucket.r1Agendada += m.r1_agendada ?? 0;
      bucket.r1Realizada += m.r1_realizada ?? 0;
      bucket.noShows += m.no_shows ?? 0;
      bucket.contratos += m.contratos ?? 0;
      if (e) bucket.emails.push(e);
    });
    const total = bucket.agendamentos + bucket.r1Agendada + bucket.r1Realizada + bucket.noShows + bucket.contratos;
    return total > 0 ? bucket : null;
  }, [metricsQuery.data, validBookerEmails]);

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
    if (validSdrEmails.size > 0 || validBookerEmails.size > 0) {
      validSdrEmails.forEach(e => allEmails.add(e));
      // Also include metrics emails that are part of the valid set (filter by squad membership)
      metrics.forEach((m: SdrAgendaMetrics) => {
        const e = m.sdr_email?.toLowerCase();
        // União SDR ∪ closer: quem agendou aparece como linha própria.
        if (e && validBookerEmails.has(e)) allEmails.add(e);
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
          || closerNameByEmail.get(emailLower)
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
  }, [metricsQuery.data, sdrMetaMap, validSdrEmails, validBookerEmails, closerNameByEmail]);

  // Calculate team KPIs from FILTERED SDRs only
  const teamKPIs = useMemo((): TeamKPIs => {
    // Sum up from filtered bySDR data
    const totalAgendamentos = bySDR.reduce((sum, s) => sum + s.agendamentos, 0);
    const totalRealizadas = bySDR.reduce((sum, s) => sum + s.r1Realizada, 0);
    const totalNoShows = bySDR.reduce((sum, s) => sum + s.noShows, 0);
    const totalContratos = bySDR.reduce((sum, s) => sum + s.contratos, 0);
    const totalSemStatus = bySDR.reduce((sum, s) => sum + (s.semStatus || 0), 0);
    // Consórcio: o card tem que fechar com a tabela, que agora exibe a linha
    // "Não atribuído". Incorporador segue idêntico (nenhum número alterado).
    const u = isConsorcio ? sdrUnassigned : null;

    const agendamentos = totalAgendamentos + (u?.agendamentos || 0);
    const realizadas = totalRealizadas + (u?.r1Realizada || 0);
    const noShows = totalNoShows + (u?.noShows || 0);
    const contratos = totalContratos + (u?.contratos || 0);
    const totalR1Agendada = bySDR.reduce((sum, s) => sum + s.r1Agendada, 0) + (u?.r1Agendada || 0);

    const taxaConversao = realizadas > 0 ? (contratos / realizadas) * 100 : 0;
    // Taxa de No-Show usa R1 Agendada como base (reuniões que deveriam ocorrer)
    const taxaNoShow = totalR1Agendada > 0 ? (noShows / totalR1Agendada) * 100 : 0;

    return {
      sdrCount: bySDR.length,
      totalAgendamentos: agendamentos,
      totalRealizadas: realizadas,
      totalNoShows: noShows,
      totalContratos: contratos,
      totalOutside: 0, // Will be enriched by useSdrOutsideMetrics in the page
      totalR1Agendada,
      totalSemStatus,
      taxaConversao,
      taxaNoShow,
    };
  }, [bySDR, sdrUnassigned, isConsorcio]);

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
    sdrUnassigned: isConsorcio ? sdrUnassigned : null,
    allMeetings,
    allMeetingsRaw,
    getMeetingsForSDR,
    isLoading: sdrsQuery.isLoading || sdrsInPeriodQuery.isLoading || metricsQuery.isLoading || meetingsQuery.isLoading || (isConsorcio && closersQuery.isLoading),
    error: sdrsQuery.error || sdrsInPeriodQuery.error || metricsQuery.error || meetingsQuery.error,
    refetch: () => {
      sdrsQuery.refetch();
      sdrsInPeriodQuery.refetch();
      metricsQuery.refetch();
      meetingsQuery.refetch();
    },
  };
}
