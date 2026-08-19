import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import type { SdrSummaryRow, SdrUnassignedBucket } from "./useTeamMeetingsData";

export type ConsorcioFato =
  | "agendada"
  | "realizada"
  | "no_show"
  | "fechada_agenda"
  | "agendamento";

export interface ConsorcioFatoRow {
  fato: ConsorcioFato;
  deal_id: string | null;
  meeting_day: string;
  attendee_status: string | null;
  sdr_email: string | null;
  sdr_name: string | null;
  closer_id: string | null;
  closer_name: string | null;
  origin_name: string | null;
}

export interface ConsorcioAgendaAgg {
  agendamentos: number;
  r1Agendada: number;
  r1Realizada: number;
  noShows: number;
  contratos: number;
}

const emptyAgg = (): ConsorcioAgendaAgg => ({
  agendamentos: 0,
  r1Agendada: 0,
  r1Realizada: 0,
  noShows: 0,
  contratos: 0,
});

function bump(agg: ConsorcioAgendaAgg, fato: ConsorcioFato) {
  if (fato === "agendamento") agg.agendamentos++;
  else if (fato === "agendada") agg.r1Agendada++;
  else if (fato === "realizada") agg.r1Realizada++;
  else if (fato === "no_show") agg.noShows++;
  else if (fato === "fechada_agenda") agg.contratos++;
}

/**
 * Fonte única do Painel Comercial do Consórcio.
 *
 * A BU de uma reunião é definida pela reunião (closer do slot com bu='consorcio')
 * e NUNCA pelo cadastro/squad de quem agendou. A função devolve a lista já
 * deduplicada (1 unidade por deal+dia, cap de 2 por deal) e o mesmo fato pode ser
 * atribuído duas vezes: uma ao agendador (sdr_email) e uma ao closer (closer_id).
 *
 * Eixos de data:
 *  - 'agendada' | 'realizada' | 'no_show' | 'fechada_agenda' → data da REUNIÃO
 *  - 'agendamento' → data do ATO de agendar (booked_at)
 */
export function useConsorcioAgendaFatos(startDate: Date | null, endDate: Date | null) {
  return useQuery({
    queryKey: [
      "consorcio-agenda-fatos",
      startDate ? format(startDate, "yyyy-MM-dd") : null,
      endDate ? format(endDate, "yyyy-MM-dd") : null,
    ],
    queryFn: async (): Promise<ConsorcioFatoRow[]> => {
      if (!startDate || !endDate) return [];
      const { data, error } = await supabase.rpc("get_agenda_fatos_consorcio" as any, {
        start_date: format(startDate, "yyyy-MM-dd"),
        end_date: format(endDate, "yyyy-MM-dd"),
      });
      if (error) throw error;
      return (data as unknown as ConsorcioFatoRow[]) || [];
    },
    enabled: !!startDate && !!endDate,
    staleTime: 30000,
  });
}

interface DerivedParams {
  rows: ConsorcioFatoRow[];
  /** Nomes de origem permitidos (funil selecionado). null = sem filtro. */
  allowedOriginNames: Set<string> | null;
  /** Filtro de SDR (email) aplicado apenas ao lado SDR. */
  sdrEmailFilter?: string;
  /** Nomes amigáveis por email (cadastro de SDR), com fallback no profile. */
  nameByEmail?: Map<string, string>;
}

export interface ConsorcioAgendaDerived {
  bySdr: SdrSummaryRow[];
  sdrUnassigned: SdrUnassignedBucket | null;
  byCloser: Map<string, ConsorcioAgendaAgg>;
  closerNames: Map<string, string>;
  /** Totais do lado SDR (inclui "Não atribuído"). */
  sdrTotals: ConsorcioAgendaAgg;
  /** Totais do lado Closer. */
  closerTotals: ConsorcioAgendaAgg;
  /** Emails de agendadores presentes nos fatos (para o seletor de SDR). */
  bookerEmails: string[];
  /** Nome exibível por email de agendador. */
  bookerNames: Map<string, string>;
}

export function useConsorcioAgendaDerived({
  rows,
  allowedOriginNames,
  sdrEmailFilter,
  nameByEmail,
}: DerivedParams): ConsorcioAgendaDerived {
  return useMemoDerived({ rows, allowedOriginNames, sdrEmailFilter, nameByEmail });
}

interface TotaisRow {
  origin_name: string | null;
  agendamentos: number;
  r1_agendada: number;
  r1_realizada: number;
  no_shows: number;
  contratos: number;
}

/**
 * Versão AGREGADA da mesma base de fatos: o banco devolve apenas os totais por
 * funil (poucas linhas), não a lista linha a linha. Usada pela tabela "Metas da
 * Equipe" nas três janelas (Dia/Semana/Mês) para não trazer milhares de linhas
 * nem reprocessá-las a cada render.
 */
export function useConsorcioAgendaTotais(startDate: Date | null, endDate: Date | null) {
  return useQuery({
    queryKey: [
      "consorcio-agenda-totais",
      startDate ? format(startDate, "yyyy-MM-dd") : null,
      endDate ? format(endDate, "yyyy-MM-dd") : null,
    ],
    queryFn: async (): Promise<TotaisRow[]> => {
      if (!startDate || !endDate) return [];
      const { data, error } = await supabase.rpc("get_agenda_totais_consorcio" as any, {
        start_date: format(startDate, "yyyy-MM-dd"),
        end_date: format(endDate, "yyyy-MM-dd"),
      });
      if (error) throw error;
      return (data as unknown as TotaisRow[]) || [];
    },
    enabled: !!startDate && !!endDate,
    staleTime: 60000,
  });
}

/** Soma os totais respeitando o filtro de funil (origin_name). Sem custo por linha de reunião. */
export function sumConsorcioTotais(
  rows: TotaisRow[] | undefined,
  allowedOriginNames: Set<string> | null,
): ConsorcioAgendaAgg {
  const agg = emptyAgg();
  (rows || []).forEach(r => {
    if (allowedOriginNames && !allowedOriginNames.has((r.origin_name || "").toLowerCase())) return;
    agg.agendamentos += r.agendamentos || 0;
    agg.r1Agendada += r.r1_agendada || 0;
    agg.r1Realizada += r.r1_realizada || 0;
    agg.noShows += r.no_shows || 0;
    agg.contratos += r.contratos || 0;
  });
  return agg;
}

function useMemoDerived({
  rows,
  allowedOriginNames,
  sdrEmailFilter,
  nameByEmail,
}: DerivedParams): ConsorcioAgendaDerived {
  return useMemo(() => {
    const filtered = allowedOriginNames
      ? rows.filter(r => allowedOriginNames.has((r.origin_name || "").toLowerCase()))
      : rows;

    const bySdrAgg = new Map<string, ConsorcioAgendaAgg>();
    const sdrNames = new Map<string, string>();
    const unassigned: SdrUnassignedBucket = {
      agendamentos: 0, r1Agendada: 0, r1Realizada: 0, noShows: 0, contratos: 0, emails: [],
    };
    const byCloser = new Map<string, ConsorcioAgendaAgg>();
    const closerNames = new Map<string, string>();
    // Todos os agendadores presentes nos fatos, independente do filtro de SDR
    // (alimenta o seletor "Todos os SDRs").
    const allBookers = new Map<string, string>();

    filtered.forEach(row => {
      const email = (row.sdr_email || "").trim().toLowerCase();
      const sdrSelected = !sdrEmailFilter || email === sdrEmailFilter.toLowerCase();
      if (email && !allBookers.has(email)) {
        allBookers.set(email, nameByEmail?.get(email) || row.sdr_name || email.split("@")[0]);
      }

      // ---- lado SDR (respeita o filtro de SDR) ----
      if (sdrSelected) {
        if (email) {
          if (!bySdrAgg.has(email)) bySdrAgg.set(email, emptyAgg());
          bump(bySdrAgg.get(email)!, row.fato);
          if (!sdrNames.has(email)) {
            sdrNames.set(email, nameByEmail?.get(email) || row.sdr_name || email.split("@")[0]);
          }
        } else if (!sdrEmailFilter) {
          // booked_by nulo — o fato existe e não pode desaparecer.
          if (row.fato === "agendamento") unassigned.agendamentos++;
          else if (row.fato === "agendada") unassigned.r1Agendada++;
          else if (row.fato === "realizada") unassigned.r1Realizada++;
          else if (row.fato === "no_show") unassigned.noShows++;
          else if (row.fato === "fechada_agenda") unassigned.contratos++;
        }
      }

      // ---- lado Closer (não depende do filtro de SDR) ----
      if (row.closer_id) {
        if (!byCloser.has(row.closer_id)) byCloser.set(row.closer_id, emptyAgg());
        bump(byCloser.get(row.closer_id)!, row.fato);
        if (row.closer_name && !closerNames.has(row.closer_id)) {
          closerNames.set(row.closer_id, row.closer_name);
        }
      }
    });

    const bySdr: SdrSummaryRow[] = Array.from(bySdrAgg.entries())
      .map(([email, agg]) => ({
        sdrEmail: email,
        sdrName: sdrNames.get(email) || email.split("@")[0],
        agendamentos: agg.agendamentos,
        r1Agendada: agg.r1Agendada,
        r1Realizada: agg.r1Realizada,
        noShows: agg.noShows,
        contratos: agg.contratos,
        pendentes: Math.max(agg.r1Agendada - agg.r1Realizada - agg.noShows, 0),
      }))
      .sort((a, b) => {
        if (b.r1Agendada !== a.r1Agendada) return b.r1Agendada - a.r1Agendada;
        if (b.r1Realizada !== a.r1Realizada) return b.r1Realizada - a.r1Realizada;
        return a.sdrName.localeCompare(b.sdrName);
      });

    const unassignedTotal =
      unassigned.agendamentos + unassigned.r1Agendada + unassigned.r1Realizada +
      unassigned.noShows + unassigned.contratos;
    const sdrUnassigned = unassignedTotal > 0 ? unassigned : null;

    const sum = (list: ConsorcioAgendaAgg[]): ConsorcioAgendaAgg =>
      list.reduce((acc, a) => ({
        agendamentos: acc.agendamentos + a.agendamentos,
        r1Agendada: acc.r1Agendada + a.r1Agendada,
        r1Realizada: acc.r1Realizada + a.r1Realizada,
        noShows: acc.noShows + a.noShows,
        contratos: acc.contratos + a.contratos,
      }), emptyAgg());

    const sdrTotals = sum([
      ...Array.from(bySdrAgg.values()),
      ...(sdrUnassigned ? [{
        agendamentos: sdrUnassigned.agendamentos,
        r1Agendada: sdrUnassigned.r1Agendada,
        r1Realizada: sdrUnassigned.r1Realizada,
        noShows: sdrUnassigned.noShows,
        contratos: sdrUnassigned.contratos,
      }] : []),
    ]);
    const closerTotals = sum(Array.from(byCloser.values()));

    return {
      bySdr,
      sdrUnassigned,
      byCloser,
      closerNames,
      sdrTotals,
      closerTotals,
      bookerEmails: Array.from(allBookers.keys()),
      bookerNames: allBookers,
    };
  }, [rows, allowedOriginNames, sdrEmailFilter, nameByEmail]);
}