import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
} from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useSdrMetricsFromAgenda } from "./useSdrMetricsFromAgenda";
import {
  contarDiasUteis,
  getWeekStartsOn,
  isDiaUtil,
} from "@/lib/businessDays";

export type GoalStatus = "ahead" | "ontrack" | "behind" | "critical";

export interface GoalProgress {
  label: string;
  realized: number;
  target: number;
  expectedSoFar: number;
  balance: number;          // realized - expectedSoFar
  remaining: number;        // max(target - realized, 0)
  businessDaysTotal: number;
  businessDaysElapsed: number;
  businessDaysLeft: number; // including today if it's a business day and we haven't ended it
  paceNeededPerDay: number; // to close target in remaining business days
  status: GoalStatus;
  message: string;
}

export interface SdrGamificationData {
  sdrName: string;
  sdrEmail: string;
  squad: string;
  metaDiaria: number;
  today: GoalProgress;
  week: GoalProgress;
  month: GoalProgress;
}

function classify(
  realized: number,
  target: number,
  expectedSoFar: number,
  metaDiaria: number,
  paceNeeded: number,
): GoalStatus {
  if (target <= 0) return "ontrack";
  if (realized >= target) return "ahead";
  if (realized >= expectedSoFar) return "ontrack";
  // Behind: how bad?
  if (paceNeeded > metaDiaria * 1.5) return "critical";
  return "behind";
}

function buildMessage(
  windowLabel: string,
  realized: number,
  target: number,
  remaining: number,
  daysLeft: number,
  paceNeeded: number,
  status: GoalStatus,
): string {
  if (target <= 0) return "Meta não configurada.";
  if (status === "ahead") {
    const ahead = realized - target;
    if (ahead > 0) return `Meta de ${windowLabel} batida! +${ahead} acima.`;
    return `Meta de ${windowLabel} batida. Continue assim!`;
  }
  if (remaining <= 0) return `Meta de ${windowLabel} batida.`;
  if (daysLeft <= 0) {
    return `Faltam ${remaining} para fechar ${windowLabel} e os dias úteis já se esgotaram.`;
  }
  if (daysLeft === 1) {
    return `Faltam ${remaining} para fechar ${windowLabel} — precisa de ${paceNeeded} hoje${
      status === "critical" ? " (acima do ritmo normal)" : ""
    }.`;
  }
  return `Faltam ${remaining} em ${windowLabel} — ritmo necessário: ${paceNeeded}/dia nos próximos ${daysLeft} dias úteis${
    status === "critical" ? " (acima do ritmo normal)" : ""
  }.`;
}

function computeGoal(params: {
  label: string;
  metaDiaria: number;
  realized: number;
  windowStart: Date;
  windowEnd: Date;
  today: Date;
}): GoalProgress {
  const { label, metaDiaria, realized, windowStart, windowEnd, today } = params;

  const businessDaysTotal = contarDiasUteis(windowStart, windowEnd);
  const elapsedEnd = today < windowEnd ? today : windowEnd;
  const businessDaysElapsed = contarDiasUteis(windowStart, elapsedEnd);
  // "Days left" includes today if today is a business day inside the window.
  const businessDaysLeft = Math.max(
    businessDaysTotal - businessDaysElapsed + (isDiaUtil(today) && today <= windowEnd ? 1 : 0),
    0,
  );

  const target = metaDiaria * businessDaysTotal;
  const expectedSoFar = metaDiaria * businessDaysElapsed;
  const balance = realized - expectedSoFar;
  const remaining = Math.max(target - realized, 0);
  const paceNeeded = businessDaysLeft > 0 ? Math.ceil(remaining / businessDaysLeft) : remaining;

  const status = classify(realized, target, expectedSoFar, metaDiaria, paceNeeded);
  const message = buildMessage(label, realized, target, remaining, businessDaysLeft, paceNeeded, status);

  return {
    label,
    realized,
    target,
    expectedSoFar,
    balance,
    remaining,
    businessDaysTotal,
    businessDaysElapsed,
    businessDaysLeft,
    paceNeededPerDay: paceNeeded,
    status,
    message,
  };
}

export function useSdrGamificationProgress(enabled: boolean) {
  const { user } = useAuth();
  const sdrEmail = user?.email || undefined;

  const { data: sdrRecord } = useQuery({
    queryKey: ["gamification-sdr-record", user?.id, sdrEmail],
    queryFn: async () => {
      if (!user?.id && !sdrEmail) return null;
      let row: { name: string | null; email: string | null; squad: string | null; meta_diaria: number | null } | null = null;
      if (user?.id) {
        const { data } = await supabase
          .from("sdr")
          .select("name, email, squad, meta_diaria")
          .eq("user_id", user.id)
          .maybeSingle();
        row = data as any;
      }
      if (!row && sdrEmail) {
        const { data } = await supabase
          .from("sdr")
          .select("name, email, squad, meta_diaria")
          .eq("email", sdrEmail)
          .maybeSingle();
        row = data as any;
      }
      return row;
    },
    enabled: enabled && !!(user?.id || sdrEmail),
    staleTime: 5 * 60 * 1000,
  });

  const squad = sdrRecord?.squad || "incorporador";
  const metaDiaria = sdrRecord?.meta_diaria ?? 0;

  const today = useMemo(() => new Date(), []);
  const weekStartsOn = getWeekStartsOn(squad === "consorcio" ? "consorcio" : null);

  const dayStart = startOfDay(today);
  const dayEnd = endOfDay(today);
  const weekStart = startOfWeek(today, { weekStartsOn });
  const weekEnd = endOfWeek(today, { weekStartsOn });
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);

  const enabledMetric = enabled && !!sdrEmail && !!sdrRecord;

  const dayMetrics = useSdrMetricsFromAgenda(
    enabledMetric ? dayStart : null,
    enabledMetric ? dayEnd : null,
    sdrEmail,
    squad,
  );
  const weekMetrics = useSdrMetricsFromAgenda(
    enabledMetric ? weekStart : null,
    enabledMetric ? weekEnd : null,
    sdrEmail,
    squad,
  );
  const monthMetrics = useSdrMetricsFromAgenda(
    enabledMetric ? monthStart : null,
    enabledMetric ? monthEnd : null,
    sdrEmail,
    squad,
  );

  const isLoading = dayMetrics.isLoading || weekMetrics.isLoading || monthMetrics.isLoading;

  const data: SdrGamificationData | null = useMemo(() => {
    if (!sdrRecord || !sdrEmail) return null;

    const realizedDay = dayMetrics.data?.metrics?.[0]?.agendamentos ?? 0;
    const realizedWeek = weekMetrics.data?.metrics?.[0]?.agendamentos ?? 0;
    const realizedMonth = monthMetrics.data?.metrics?.[0]?.agendamentos ?? 0;

    return {
      sdrName: sdrRecord.name || sdrEmail,
      sdrEmail,
      squad,
      metaDiaria,
      today: computeGoal({
        label: "hoje",
        metaDiaria,
        realized: realizedDay,
        windowStart: dayStart,
        windowEnd: dayEnd,
        today,
      }),
      week: computeGoal({
        label: "a semana",
        metaDiaria,
        realized: realizedWeek,
        windowStart: weekStart,
        windowEnd: weekEnd,
        today,
      }),
      month: computeGoal({
        label: "o mês",
        metaDiaria,
        realized: realizedMonth,
        windowStart: monthStart,
        windowEnd: monthEnd,
        today,
      }),
    };
  }, [
    sdrRecord,
    sdrEmail,
    squad,
    metaDiaria,
    dayMetrics.data,
    weekMetrics.data,
    monthMetrics.data,
    dayStart,
    dayEnd,
    weekStart,
    weekEnd,
    monthStart,
    monthEnd,
    today,
  ]);

  return {
    data,
    isLoading,
    hasMeta: metaDiaria > 0,
    refetch: () => {
      dayMetrics.refetch();
      weekMetrics.refetch();
      monthMetrics.refetch();
    },
  };
}