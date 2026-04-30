import { startOfDay } from "date-fns";
import type { MeetingV2 } from "@/hooks/useSdrMetricsV2";

export type PendenteSubBucket = "futuras" | "vencidas" | "canceladas";

export interface PendentesBreakdown {
  futuras: number;
  vencidas: number;
  canceladas: number;
  total: number;
}

function inRange(iso: string | null | undefined, start: Date | null, end: Date | null): boolean {
  if (!iso || !start || !end) return false;
  const t = new Date(iso).getTime();
  return t >= start.getTime() && t <= end.getTime();
}

export function isRealizadaStatus(s?: string | null): boolean {
  const v = (s || "").toLowerCase();
  return (
    v === "completed" ||
    v === "realizada" ||
    v === "show" ||
    v === "attended" ||
    v === "contract_paid" ||
    v === "refunded"
  );
}

export function isNoShowStatus(s?: string | null): boolean {
  const v = (s || "").toLowerCase();
  return v === "no_show" || v === "noshow" || v === "no-show";
}

export function isRemanejadoStatus(s?: string | null): boolean {
  const v = (s || "").toLowerCase();
  return (
    v === "rescheduled" ||
    v === "cancelled" ||
    v === "canceled" ||
    v === "cancelada" ||
    v === "sem_sucesso"
  );
}

/** Devolve o "dia" do agendamento em America/Sao_Paulo (YYYY-MM-DD). */
function spDayKey(iso?: string | null): string | null {
  if (!iso) return null;
  try {
    const parts = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date(iso));
    const d = parts.find((p) => p.type === "day")?.value;
    const mo = parts.find((p) => p.type === "month")?.value;
    const y = parts.find((p) => p.type === "year")?.value;
    if (!d || !mo || !y) return null;
    return `${y}-${mo}-${d}`;
  } catch {
    return null;
  }
}

/**
 * Classifica uma reunião pendente em: futuras (ainda vão acontecer),
 * vencidas (já passou da hora e ninguém marcou Realizada/No-Show)
 * ou canceladas (remarcadas/canceladas/sem_sucesso).
 */
export function classifyPendente(m: MeetingV2): PendenteSubBucket {
  const iso = m.scheduled_at || m.data_agendamento;
  const todayStart = startOfDay(new Date()).getTime();
  const t = iso ? new Date(iso).getTime() : 0;
  if (isRemanejadoStatus(m.attendee_status)) return "canceladas";
  if (t >= todayStart) return "futuras";
  return "vencidas";
}

/**
 * Dedup por (sdr_email, deal_id) com cap 2 — espelha exatamente a regra do
 * RPC `get_sdr_metrics_from_agenda` para R1 Agendada
 * (`LEAST(COUNT(DISTINCT meeting_day), 2)`).
 *
 * Para cada (sdr, deal) escolhe até 2 ocorrências em DIAS DIFERENTES,
 * priorizando: Realizada > No-Show > Pendente (futura/vencida/cancelada).
 * Assim Realizada + No-Show + Pendente == R1 Agendada do KPI.
 */
function dedupSdrDealCap2(meetings: MeetingV2[]): MeetingV2[] {
  const rank = (m: MeetingV2): number => {
    if (isRealizadaStatus(m.attendee_status)) return 3;
    if (isNoShowStatus(m.attendee_status)) return 2;
    return 1; // pendente / cancelada / sem status
  };
  // Agrupa por (sdr, deal)
  const groups = new Map<string, MeetingV2[]>();
  meetings.forEach((m) => {
    const sdr = (m.current_owner || m.intermediador || "").toLowerCase();
    const deal = m.deal_id || `noid-${m.attendee_id || ""}`;
    const key = `${sdr}::${deal}`;
    const arr = groups.get(key);
    if (arr) arr.push(m);
    else groups.set(key, [m]);
  });

  const out: MeetingV2[] = [];
  groups.forEach((arr) => {
    // Ordena por rank desc; em empate, escolhe o mais antigo (estável)
    const sorted = [...arr].sort((a, b) => rank(b) - rank(a));
    const usedDays = new Set<string>();
    for (const m of sorted) {
      const day = spDayKey(m.scheduled_at || m.data_agendamento) || "";
      if (usedDays.has(day)) continue;
      usedDays.add(day);
      out.push(m);
      if (out.length && usedDays.size >= 2) {
        // Limite: 2 dias distintos por (sdr, deal)
      }
      if (usedDays.size >= 2) break;
    }
  });
  return out;
}

export function getPendentesMeetings(
  meetings: MeetingV2[] | undefined | null,
  start: Date | null,
  end: Date | null,
): MeetingV2[] {
  if (!meetings || meetings.length === 0) return [];

  const inWindow = meetings.filter((m) =>
    inRange(m.scheduled_at || m.data_agendamento, start, end),
  );

  // Dedup por (sdr, deal) cap 2 — alinhado ao RPC R1 Agendada — e remove
  // as ocorrências que já viraram Realizada / No-Show. O que sobra são as
  // pendentes "verdadeiras" que somam exatamente:
  //   R1 Agendada − Realizada − No-Show = Pendentes
  const deduped = dedupSdrDealCap2(inWindow);
  return deduped.filter(
    (m) => !isRealizadaStatus(m.attendee_status) && !isNoShowStatus(m.attendee_status),
  );
}

/**
 * Calcula o breakdown REAL de Pendentes/Sem Desfecho.
 *
 * Usa as reuniões SEM dedup global (allMeetingsRaw) e aplica dedup por
 * (sdr_email + deal_id) com cap 2 dias — mesma regra do RPC
 * `get_sdr_metrics_from_agenda` para R1 Agendada
 * (`LEAST(COUNT(DISTINCT meeting_day), 2)`).
 *
 * Para cada (sdr, deal) escolhe até 2 dias priorizando Realizada > No-Show
 * > Pendente. Assim Realizada + No-Show + Pendente == R1 Agendada do KPI,
 * fechando a aritmética.
 */
export function computePendentesBreakdown(
  meetings: MeetingV2[] | undefined | null,
  start: Date | null,
  end: Date | null,
): PendentesBreakdown {
  const out: PendentesBreakdown = { futuras: 0, vencidas: 0, canceladas: 0, total: 0 };
  getPendentesMeetings(meetings, start, end).forEach((m) => {
    const cls = classifyPendente(m);
    out[cls]++;
    out.total++;
  });
  return out;
}