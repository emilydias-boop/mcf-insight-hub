import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
} from "date-fns";
import { contarDiasUteis, getWeekStartsOn, isDiaUtil } from "@/lib/businessDays";
import type { GoalProgress, GoalStatus } from "./useSdrGamificationProgress";

export interface CloserGamificationData {
  closerName: string;
  closerEmail: string;
  closerId: string;
  metaReunioesDia: number;
  metaContratosDia: number;
  reunioes: { today: GoalProgress; week: GoalProgress; month: GoalProgress };
  contratos: { today: GoalProgress; week: GoalProgress; month: GoalProgress };
}

function classify(realized: number, target: number, expectedSoFar: number, metaDiaria: number, paceNeeded: number): GoalStatus {
  if (target <= 0) return "ontrack";
  if (realized >= target) return "ahead";
  if (realized >= expectedSoFar) return "ontrack";
  if (paceNeeded > metaDiaria * 1.5) return "critical";
  return "behind";
}

function buildGoal(label: string, metaDiaria: number, realized: number, wStart: Date, wEnd: Date, now: Date): GoalProgress {
  const businessDaysTotal = contarDiasUteis(wStart, wEnd);
  const elapsedEnd = now < wEnd ? now : wEnd;
  const businessDaysElapsed = contarDiasUteis(wStart, elapsedEnd);
  const businessDaysLeft = Math.max(
    businessDaysTotal - businessDaysElapsed + (isDiaUtil(now) && now <= wEnd ? 1 : 0), 0,
  );
  const target = metaDiaria * businessDaysTotal;
  const expectedSoFar = metaDiaria * businessDaysElapsed;
  const remaining = Math.max(target - realized, 0);
  const paceNeeded = businessDaysLeft > 0 ? Math.ceil(remaining / businessDaysLeft) : remaining;
  const status = classify(realized, target, expectedSoFar, metaDiaria, paceNeeded);
  const msg = target <= 0
    ? "Meta não configurada."
    : realized >= target
      ? `Meta de ${label} batida!`
      : `Faltam ${remaining} em ${label} — ritmo ${paceNeeded}/dia (${businessDaysLeft} dias úteis).`;
  return {
    label, realized, target, expectedSoFar,
    balance: realized - expectedSoFar,
    remaining, businessDaysTotal, businessDaysElapsed, businessDaysLeft,
    paceNeededPerDay: paceNeeded, status, message: msg,
  };
}

export function useCloserGamificationRuntime(
  closerId: string | null,
  closerName: string,
  closerEmail: string,
  enabled: boolean,
  metaReunioesDia: number,
  metaContratosDia: number,
) {
  return useQuery({
    queryKey: ["closer-gamification-runtime", closerId, metaReunioesDia, metaContratosDia],
    enabled: enabled && !!closerId,
    staleTime: 60_000,
    queryFn: async (): Promise<CloserGamificationData | null> => {
      if (!closerId) return null;
      const now = new Date();
      const weekStartsOn = getWeekStartsOn(null); // incorporador default (Sat)
      const windows = {
        today: [startOfDay(now), endOfDay(now)] as const,
        week: [startOfWeek(now, { weekStartsOn }), endOfWeek(now, { weekStartsOn })] as const,
        month: [startOfMonth(now), endOfMonth(now)] as const,
      };

      const bounds = [windows.today, windows.week, windows.month];
      const globalStart = bounds.reduce((min, [s]) => (s < min ? s : min), bounds[0][0]);
      const globalEnd = bounds.reduce((max, [, e]) => (e > max ? e : max), bounds[0][1]);

      // Reuniões realizadas (por scheduled_at)
      const { data: meetings } = await supabase
        .from("meeting_slot_attendees")
        .select("id, status, contract_paid_at, meeting_slot:meeting_slots!inner(closer_id, scheduled_at)")
        .eq("meeting_slot.closer_id", closerId)
        .eq("is_partner", false)
        .in("status", ["completed", "contract_paid", "refunded"])
        .gte("meeting_slot.scheduled_at", globalStart.toISOString())
        .lte("meeting_slot.scheduled_at", globalEnd.toISOString());

      // Contratos pagos (por contract_paid_at)
      const { data: contracts } = await supabase
        .from("meeting_slot_attendees")
        .select("id, contract_paid_at, meeting_slot:meeting_slots!inner(closer_id)")
        .eq("meeting_slot.closer_id", closerId)
        .eq("is_partner", false)
        .in("status", ["contract_paid", "refunded"])
        .not("contract_paid_at", "is", null)
        .gte("contract_paid_at", globalStart.toISOString())
        .lte("contract_paid_at", globalEnd.toISOString());

      const countMeetings = (from: Date, to: Date) =>
        (meetings || []).filter((m: any) => {
          const t = new Date(m.meeting_slot?.scheduled_at).getTime();
          return t >= from.getTime() && t <= to.getTime();
        }).length;

      const countContracts = (from: Date, to: Date) =>
        (contracts || []).filter((c: any) => {
          const t = new Date(c.contract_paid_at).getTime();
          return t >= from.getTime() && t <= to.getTime();
        }).length;

      const mkPair = (metaDiaria: number, counter: (a: Date, b: Date) => number) => ({
        today: buildGoal("hoje", metaDiaria, counter(...windows.today), windows.today[0], windows.today[1], now),
        week: buildGoal("a semana", metaDiaria, counter(...windows.week), windows.week[0], windows.week[1], now),
        month: buildGoal("o mês", metaDiaria, counter(...windows.month), windows.month[0], windows.month[1], now),
      });

      return {
        closerId, closerName, closerEmail,
        metaReunioesDia, metaContratosDia,
        reunioes: mkPair(metaReunioesDia, countMeetings),
        contratos: mkPair(metaContratosDia, countContracts),
      };
    },
  });
}