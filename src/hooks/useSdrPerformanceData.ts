import { useMemo } from "react";
import { subMonths, subYears, differenceInDays, eachDayOfInterval, format, min, startOfDay } from "date-fns";
import { useSdrDetailData, TeamAverages, SdrRanking } from "./useSdrDetailData";
import { useSdrCallMetrics, SdrCallMetrics } from "./useSdrCallMetrics";
import { useTeamMeetingsData, SdrSummaryRow } from "./useTeamMeetingsData";
import { contarDiasUteis, isDiaUtil } from "@/lib/businessDays";
import { MeetingV2 } from "./useSdrMetricsV2";

export type ComparisonMode = "none" | "prev_month" | "prev_period" | "prev_year" | "custom";
export type MetaMode = "monthly_prorated" | "weekly" | "per_business_day" | "custom";

export interface MetricWithMeta {
  label: string;
  key: string;
  realized: number;
  meta: number;
  attainment: number; // percentage
  gap: number;
  compValue: number | null;
  compVariation: number | null; // percentage
  format?: "number" | "percent" | "duration";
  extra?: Record<string, number>;
  invertGap?: boolean;
}

export interface ProjectionData {
  metaFinal: number;
  realized: number;
  projection: number;
  gap: number;
  requiredPerDay: number;
  businessDaysTotal: number;
  businessDaysPassed: number;
  businessDaysRemaining: number;
  attainment: number;
}

export interface DailyRow {
  date: Date;
  dateStr: string;
  realized: number;
  metaDiaria: number;
  percentDay: number;
  accumulated: number;
  metaAccumulated: number;
  gapAccumulated: number;
  status: "above" | "on_track" | "below";
  isWeekend: boolean;
  isBusinessDay: boolean;
}

export interface SdrPerformanceData {
  // Core metrics
  metrics: MetricWithMeta[];
  projection: ProjectionData;
  dailyRows: DailyRow[];

  // Funnel
  funnel: {
    label: string;
    value: number;
    conversionRate: number | null;
  }[];

  // Team comparison
  teamComparison: {
    label: string;
    sdrValue: number;
    teamAvg: number;
    diffPercent: number;
    rank: number;
    totalSdrs: number;
    format?: "number" | "percent";
  }[];

  // Auto summary text
  summaryText: string;

  // Raw data pass-through
  sdrName: string;
  sdrInfo: { email: string; name: string; cargo: string; squad: string; status: string } | null;
  meetings: MeetingV2[];
  callMetrics: SdrCallMetrics;
  metaDiaria: number;
  ranking: SdrRanking;
  teamAverages: TeamAverages;
  allSdrs: SdrSummaryRow[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

interface UseSdrPerformanceParams {
  sdrEmail: string;
  startDate: Date;
  endDate: Date;
  compStartDate: Date | null;
  compEndDate: Date | null;
  metaMode: MetaMode;
  customMeta?: number;
}

function computeCompDates(
  startDate: Date,
  endDate: Date,
  mode: ComparisonMode
): { compStartDate: Date | null; compEndDate: Date | null } {
  if (mode === "none") return { compStartDate: null, compEndDate: null };
  if (mode === "prev_month") {
    return {
      compStartDate: subMonths(startDate, 1),
      compEndDate: subMonths(endDate, 1),
    };
  }
  if (mode === "prev_period") {
    const days = differenceInDays(endDate, startDate);
    const compEnd = new Date(startDate.getTime() - 86400000);
    const compStart = new Date(compEnd.getTime() - days * 86400000);
    return { compStartDate: compStart, compEndDate: compEnd };
  }
  if (mode === "prev_year") {
    return {
      compStartDate: subYears(startDate, 1),
      compEndDate: subYears(endDate, 1),
    };
  }
  return { compStartDate: null, compEndDate: null };
}

export { computeCompDates };

export function useSdrPerformanceData({
  sdrEmail,
  startDate,
  endDate,
  compStartDate,
  compEndDate,
  metaMode,
  customMeta,
}: UseSdrPerformanceParams): SdrPerformanceData {
  const detail = useSdrDetailData({ sdrEmail, startDate, endDate });
  const callMetricsQuery = useSdrCallMetrics(sdrEmail, startDate, endDate);

  // Comparative period data
  const compData = useTeamMeetingsData({
    startDate: compStartDate,
    endDate: compEndDate,
  });

  const callMetrics: SdrCallMetrics = callMetricsQuery.data || {
    totalCalls: 0,
    answered: 0,
    unanswered: 0,
    totalDurationSeconds: 0,
    avgDurationSeconds: 0,
  };

  // Compute meta for the period
  const metaPeriodo = useMemo(() => {
    const md = detail.metaDiaria;
    if (metaMode === "custom" && customMeta !== undefined) return customMeta;
    if (metaMode === "per_business_day") return md; // per day, total computed elsewhere
    const businessDays = contarDiasUteis(startDate, endDate);
    if (metaMode === "weekly") return md * 5; // weekly = 5 business days
    // default: monthly_prorated
    return md * businessDays;
  }, [detail.metaDiaria, metaMode, customMeta, startDate, endDate]);

  // Comparative SDR metrics
  const compSdrMetrics = useMemo(() => {
    if (!compStartDate || !compEndDate) return null;
    return compData.bySDR.find(
      (s) => s.sdrEmail.toLowerCase() === sdrEmail.toLowerCase()
    ) || null;
  }, [compData.bySDR, sdrEmail, compStartDate, compEndDate]);

  // Business days calculations
  const businessDaysTotal = useMemo(() => contarDiasUteis(startDate, endDate), [startDate, endDate]);
  const today = startOfDay(new Date());
  const effectiveToday = useMemo(() => min([today, endDate]), [today, endDate]);
  const businessDaysPassed = useMemo(
    () => contarDiasUteis(startDate, effectiveToday),
    [startDate, effectiveToday]
  );
  const businessDaysRemaining = useMemo(
    () => Math.max(0, businessDaysTotal - businessDaysPassed),
    [businessDaysTotal, businessDaysPassed]
  );

  const sm = detail.sdrMetrics;

  // Derived metas
  const metas = useMemo(() => {
    const agendMeta = metaPeriodo;
    // Metas derivadas usam Agendamentos REAIS do período como base
    const agendamentos_real = sm?.agendamentos || 0;
    const r1RealizadaMeta = Math.round(agendamentos_real * 0.7);
    const noShowMeta = Math.round(agendamentos_real * 0.3);
    // Contratos: 30% do R1 Realizada REAL (não da meta)
    const r1Realizada_real = sm?.r1Realizada || 0;
    const contratosMeta = Math.round(r1Realizada_real * 0.3);
    // Ligações: 84 por dia útil do período
    const ligacoesMeta = 84 * businessDaysTotal;
    return { agendMeta, r1RealizadaMeta, noShowMeta, contratosMeta, ligacoesMeta };
  }, [metaPeriodo, sm, businessDaysTotal]);

  // Build main metrics
  const metrics = useMemo((): MetricWithMeta[] => {
    if (!sm) return [];
    const agend = sm.agendamentos;
    const r1ag = sm.r1Agendada;
    const r1re = sm.r1Realizada;
    const contr = sm.contratos;
    const noshows = sm.noShows;
    const taxaContrato = r1re > 0 ? (contr / r1re) * 100 : 0;
    const taxaContato = callMetrics.totalCalls > 0 ? (callMetrics.answered / callMetrics.totalCalls) * 100 : 0;

    const makeMetric = (
      label: string,
      key: string,
      realized: number,
      meta: number,
      compKey?: keyof SdrSummaryRow,
      fmt?: "number" | "percent" | "duration"
    ): MetricWithMeta => {
      const attainment = meta > 0 ? (realized / meta) * 100 : 0;
      const gap = realized - meta;
      let compValue: number | null = null;
      let compVariation: number | null = null;
      if (compSdrMetrics && compKey) {
        compValue = compSdrMetrics[compKey] as number;
        compVariation = compValue > 0 ? ((realized - compValue) / compValue) * 100 : null;
      }
      return { label, key, realized, meta, attainment, gap, compValue, compVariation, format: fmt };
    };

    return [
      makeMetric("Agendamentos", "agendamentos", agend, metas.agendMeta, "agendamentos"),
      
      makeMetric("R1 Realizada", "r1Realizada", r1re, metas.r1RealizadaMeta, "r1Realizada"),
      makeMetric("Contratos Pagos", "contratos", contr, metas.contratosMeta, "contratos"),
      {
        label: "Taxa Contrato",
        key: "taxaContrato",
        realized: taxaContrato,
        meta: 30,
        attainment: 30 > 0 ? (taxaContrato / 30) * 100 : 0,
        gap: taxaContrato - 30,
        compValue: compSdrMetrics ? (compSdrMetrics.r1Realizada > 0 ? (compSdrMetrics.contratos / compSdrMetrics.r1Realizada) * 100 : 0) : null,
        compVariation: null,
        format: "percent" as const,
      },
      {
        label: "Taxa No-Show",
        key: "taxaNoShow",
        realized: agend > 0 ? (noshows / agend) * 100 : 0,
        meta: 30,
        attainment: agend > 0 ? ((noshows / agend) * 100 / 30) * 100 : 0,
        gap: agend > 0 ? (noshows / agend) * 100 - 30 : 0,
        compValue: compSdrMetrics ? (compSdrMetrics.agendamentos > 0 ? (compSdrMetrics.noShows / compSdrMetrics.agendamentos) * 100 : 0) : null,
        compVariation: null,
        format: "percent" as const,
        invertGap: true,
      },
      {
        ...makeMetric("Total Ligações", "totalCalls", callMetrics.totalCalls, metas.ligacoesMeta),
        extra: { answered: callMetrics.answered, unanswered: callMetrics.unanswered },
      },
    ];
  }, [sm, callMetrics, metas, compSdrMetrics]);

  // Projection
  const projection = useMemo((): ProjectionData => {
    const realized = sm?.agendamentos || 0;
    const metaFinal = metas.agendMeta;
    const avgPerDay = businessDaysPassed > 0 ? realized / businessDaysPassed : 0;
    const proj = Math.round(avgPerDay * businessDaysTotal);
    const gap = metaFinal - realized;
    const requiredPerDay = businessDaysRemaining > 0 ? gap / businessDaysRemaining : 0;
    const attainment = metaFinal > 0 ? (realized / metaFinal) * 100 : 0;
    return {
      metaFinal,
      realized,
      projection: proj,
      gap,
      requiredPerDay,
      businessDaysTotal,
      businessDaysPassed,
      businessDaysRemaining,
      attainment,
    };
  }, [sm, metas, businessDaysTotal, businessDaysPassed, businessDaysRemaining]);

  // Daily rows
  const dailyRows = useMemo((): DailyRow[] => {
    const days = eachDayOfInterval({ start: startDate, end: endDate });
    const meetings = detail.meetings;
    let accumulated = 0;
    let metaAcc = 0;
    const md = detail.metaDiaria;

    return days.map((date) => {
      const dateStr = format(date, "yyyy-MM-dd");
      const isBusinessDay = isDiaUtil(date);
      const realized = meetings.filter(
        (m) => m.data_agendamento?.substring(0, 10) === dateStr
      ).length;
      accumulated += realized;
      if (isBusinessDay) metaAcc += md;
      const gapAcc = accumulated - metaAcc;
      const percentDay = isBusinessDay && md > 0 ? (realized / md) * 100 : 0;
      const ratio = metaAcc > 0 ? accumulated / metaAcc : 1;
      const status: DailyRow["status"] =
        ratio >= 1 ? "above" : ratio >= 0.9 ? "on_track" : "below";

      return {
        date,
        dateStr,
        realized,
        metaDiaria: isBusinessDay ? md : 0,
        percentDay,
        accumulated,
        metaAccumulated: metaAcc,
        gapAccumulated: gapAcc,
        status,
        isWeekend: !isBusinessDay && !isDiaUtil(date),
        isBusinessDay,
      };
    });
  }, [detail.meetings, startDate, endDate, detail.metaDiaria]);

  // Funnel
  const funnel = useMemo(() => {
    const steps = [
      { label: "Ligações", value: callMetrics.totalCalls },
      { label: "Contatos", value: callMetrics.answered },
      { label: "R1 Agendada", value: sm?.r1Agendada || 0 },
      { label: "R1 Realizada", value: sm?.r1Realizada || 0 },
      { label: "Contratos", value: sm?.contratos || 0 },
    ];
    return steps.map((step, i) => ({
      ...step,
      conversionRate:
        i > 0 && steps[i - 1].value > 0
          ? (step.value / steps[i - 1].value) * 100
          : null,
    }));
  }, [sm, callMetrics]);

  // Team comparison
  const teamComparison = useMemo(() => {
    if (!sm) return [];
    const ta = detail.teamAverages;
    const r = detail.ranking;
    const taxaContratoSdr = sm.r1Realizada > 0 ? (sm.contratos / sm.r1Realizada) * 100 : 0;
    const taxaContratoAvg = ta.avgR1Realizada > 0 ? (ta.avgContratos / ta.avgR1Realizada) * 100 : 0;

    return [
      { label: "Agendamentos", sdrValue: sm.agendamentos, teamAvg: ta.avgAgendamentos, diffPercent: ta.avgAgendamentos > 0 ? ((sm.agendamentos - ta.avgAgendamentos) / ta.avgAgendamentos) * 100 : 0, rank: r.agendamentos, totalSdrs: r.totalSdrs },
      { label: "R1 Agendada", sdrValue: sm.r1Agendada, teamAvg: ta.avgR1Agendada, diffPercent: ta.avgR1Agendada > 0 ? ((sm.r1Agendada - ta.avgR1Agendada) / ta.avgR1Agendada) * 100 : 0, rank: r.r1Agendada, totalSdrs: r.totalSdrs },
      { label: "R1 Realizada", sdrValue: sm.r1Realizada, teamAvg: ta.avgR1Realizada, diffPercent: ta.avgR1Realizada > 0 ? ((sm.r1Realizada - ta.avgR1Realizada) / ta.avgR1Realizada) * 100 : 0, rank: r.r1Realizada, totalSdrs: r.totalSdrs },
      { label: "Contratos", sdrValue: sm.contratos, teamAvg: ta.avgContratos, diffPercent: ta.avgContratos > 0 ? ((sm.contratos - ta.avgContratos) / ta.avgContratos) * 100 : 0, rank: r.contratos, totalSdrs: r.totalSdrs },
      { label: "Taxa Contrato", sdrValue: taxaContratoSdr, teamAvg: taxaContratoAvg, diffPercent: taxaContratoAvg > 0 ? ((taxaContratoSdr - taxaContratoAvg) / taxaContratoAvg) * 100 : 0, rank: r.taxaContrato, totalSdrs: r.totalSdrs, format: "percent" as const },
    ];
  }, [sm, detail.teamAverages, detail.ranking]);

  // Auto summary
  const summaryText = useMemo(() => {
    if (!sm) return "";
    const name = detail.sdrInfo?.name || sdrEmail.split("@")[0];
    const agend = sm.agendamentos;
    const meta = metas.agendMeta;
    const att = meta > 0 ? ((agend / meta) * 100).toFixed(0) : "0";
    const proj = projection.projection;
    const req = projection.requiredPerDay;
    const compVar = compSdrMetrics
      ? compSdrMetrics.agendamentos > 0
        ? (((agend - compSdrMetrics.agendamentos) / compSdrMetrics.agendamentos) * 100).toFixed(0)
        : null
      : null;

    let text = `Neste período, ${name} realizou ${agend} agendamentos de ${meta} previstos, atingindo ${att}% da meta.`;

    if (compVar !== null) {
      const prefix = Number(compVar) >= 0 ? "+" : "";
      text += ` Está ${prefix}${compVar}% em relação ao período comparativo.`;
    }

    text += ` Mantendo o ritmo atual, deve fechar o período com ${proj} agendamentos.`;

    if (projection.gap > 0 && businessDaysRemaining > 0) {
      text += ` Para bater a meta, precisa fazer ${req.toFixed(1)} por dia útil restante.`;
    } else if (projection.gap <= 0) {
      text += ` Já atingiu a meta do período.`;
    }

    return text;
  }, [sm, detail.sdrInfo, metas, projection, compSdrMetrics, sdrEmail, businessDaysRemaining]);

  return {
    metrics,
    projection,
    dailyRows,
    funnel,
    teamComparison,
    summaryText,
    sdrName: detail.sdrInfo?.name || sdrEmail.split("@")[0],
    sdrInfo: detail.sdrInfo,
    meetings: detail.meetings,
    callMetrics,
    metaDiaria: detail.metaDiaria,
    ranking: detail.ranking,
    teamAverages: detail.teamAverages,
    allSdrs: detail.allSdrs,
    isLoading: detail.isLoading || callMetricsQuery.isLoading || compData.isLoading,
    error: detail.error || compData.error || null,
    refetch: () => {
      detail.refetch();
      compData.refetch();
    },
  };
}
