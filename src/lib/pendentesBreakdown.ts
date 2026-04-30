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
 * Calcula o breakdown REAL de Pendentes/Sem Desfecho a partir das reuniões
 * deduplicadas (mesma fonte usada pelo drilldown), em vez do cálculo
 * aritmético R1 − Realizada − No-Show (que infla por bookings fantasmas).
 */
export function computePendentesBreakdown(
  meetings: MeetingV2[] | undefined | null,
  start: Date | null,
  end: Date | null,
): PendentesBreakdown {
  const out: PendentesBreakdown = { futuras: 0, vencidas: 0, canceladas: 0, total: 0 };
  if (!meetings || meetings.length === 0) return out;
  meetings.forEach((m) => {
    const iso = m.scheduled_at || m.data_agendamento;
    if (!inRange(iso, start, end)) return;
    if (isRealizadaStatus(m.attendee_status)) return;
    if (isNoShowStatus(m.attendee_status)) return;
    const cls = classifyPendente(m);
    out[cls]++;
    out.total++;
  });
  return out;
}