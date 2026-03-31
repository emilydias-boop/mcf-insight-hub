import { useMemo } from "react";
import { eachDayOfInterval, format, min, startOfDay } from "date-fns";
import { useCloserDetailData, CloserTeamAverages, CloserRanking, CloserLead } from "./useCloserDetailData";
import { R1CloserMetric } from "./useR1CloserMetrics";
import { useTeamMeetingsData } from "./useTeamMeetingsData";
import { contarDiasUteis, isDiaUtil } from "@/lib/businessDays";
import {
  MetricWithMeta,
  ProjectionData,
  DailyRow,
  ComparisonMode,
  MetaMode,
  computeCompDates,
} from "./useSdrPerformanceData";
import { useR1CloserMetrics } from "./useR1CloserMetrics";

export interface CloserDailyRow extends DailyRow {
  agendados: number;
  realizados: number;
  noShows: number;
  contratos: number;
}

export interface CloserPerformanceData {
  metrics: MetricWithMeta[];
  projection: ProjectionData;
  dailyRows: CloserDailyRow[];
  funnel: { label: string; value: number; conversionRate: number | null }[];
  teamComparison: {
    label: string;
    sdrValue: number;
    teamAvg: number;
    diffPercent: number;
    rank: number;
    totalSdrs: number;
    format?: "number" | "percent";
  }[];
  summaryText: string;
  closerInfo: ReturnType<typeof useCloserDetailData>["closerInfo"];
  leads: CloserLead[];
  noShowLeads: CloserLead[];
  r2Leads: CloserLead[];
  allLeads: CloserLead[];
  meetings: CloserLead[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

interface UseCloserPerformanceParams {
  closerId: string;
  startDate: Date;
  endDate: Date;
  compStartDate: Date | null;
  compEndDate: Date | null;
  metaMode: MetaMode;
  customMeta?: number;
}

const CLOSER_META_DIARIA_CONTRATOS = 4; // daily target: 4 contracts per business day

export function useCloserPerformanceData({
  closerId,
  startDate,
  endDate,
  compStartDate,
  compEndDate,
  metaMode,
  customMeta,
}: UseCloserPerformanceParams): CloserPerformanceData {
  const detail = useCloserDetailData({ closerId, startDate, endDate });

  // Comparison period metrics
  const compCloserMetrics = useR1CloserMetrics(
    compStartDate || startDate,
    compEndDate || endDate
  );
  const compMetricForCloser = useMemo(() => {
    if (!compStartDate || !compEndDate) return null;
    return compCloserMetrics.data?.find(c => c.closer_id === closerId) || null;
  }, [compCloserMetrics.data, closerId, compStartDate, compEndDate]);

  // Business days
  const businessDaysTotal = useMemo(() => contarDiasUteis(startDate, endDate), [startDate, endDate]);
  const today = startOfDay(new Date());
  const effectiveToday = useMemo(() => min([today, endDate]), [today, endDate]);
  const businessDaysPassed = useMemo(() => contarDiasUteis(startDate, effectiveToday), [startDate, effectiveToday]);
  const businessDaysRemaining = useMemo(() => Math.max(0, businessDaysTotal - businessDaysPassed), [businessDaysTotal, businessDaysPassed]);

  // Meta for contracts
  const metaContratos = useMemo(() => {
    if (metaMode === "custom" && customMeta !== undefined) return customMeta;
    if (metaMode === "per_business_day") return CLOSER_META_DIARIA_CONTRATOS;
    if (metaMode === "weekly") return CLOSER_META_DIARIA_CONTRATOS * 5;
    return CLOSER_META_DIARIA_CONTRATOS * businessDaysTotal;
  }, [metaMode, customMeta, businessDaysTotal]);

  // Meta for R1 agendada (keeps previous logic for KPI cards)
  const metaR1Agendada = useMemo(() => {
    // R1 agendada doesn't have a fixed daily target — use actual value as reference
    return 0; // no fixed target for agendada
  }, []);

  const cm = detail.closerMetrics;

  // Derived metas
  const metas = useMemo(() => {
    const r1AgendadaReal = cm?.r1_agendada || 0;
    const r1RealizadaReal = cm?.r1_realizada || 0;
    return {
      r1Agendada: r1AgendadaReal, // no fixed target, show actual
      r1Realizada: Math.round(r1AgendadaReal * 0.7),
      noShow: Math.round(r1AgendadaReal * 0.3),
      contratoPago: metaContratos,
      r2Agendada: cm?.contrato_pago || 0, // 100% of contracts
    };
  }, [metaContratos, cm]);

  // Metrics
  const metrics = useMemo((): MetricWithMeta[] => {
    if (!cm) return [];
    const r1ag = cm.r1_agendada;
    const r1re = cm.r1_realizada;
    const contr = cm.contrato_pago;
    const noshows = cm.noshow;
    const outside = cm.outside;
    const r2ag = cm.r2_agendada;
    const taxaConv = r1re > 0 ? (contr / r1re) * 100 : 0;
    const taxaNoShow = r1ag > 0 ? (noshows / r1ag) * 100 : 0;

    const makeMetric = (
      label: string,
      key: string,
      realized: number,
      meta: number,
      compKey?: keyof R1CloserMetric,
      fmt?: "number" | "percent",
      invertGap?: boolean,
    ): MetricWithMeta => {
      const attainment = invertGap
        ? (meta > 0 ? Math.max(0, ((meta - realized) / meta) * 100) : 100)
        : (meta > 0 ? (realized / meta) * 100 : 0);
      const gap = realized - meta;
      let compValue: number | null = null;
      let compVariation: number | null = null;
      if (compMetricForCloser && compKey) {
        compValue = compMetricForCloser[compKey] as number;
        compVariation = compValue > 0 ? ((realized - compValue) / compValue) * 100 : null;
      }
      return { label, key, realized, meta, attainment, gap, compValue, compVariation, format: fmt, invertGap };
    };

    return [
      makeMetric("R1 Agendada", "r1Agendada", r1ag, metas.r1Agendada, "r1_agendada"),
      makeMetric("R1 Realizada", "r1Realizada", r1re, metas.r1Realizada, "r1_realizada"),
      makeMetric("Contratos Pagos", "contratoPago", contr, metas.contratoPago, "contrato_pago"),
      {
        label: "Taxa Conversão",
        key: "taxaConversao",
        realized: taxaConv,
        meta: 30,
        attainment: 30 > 0 ? (taxaConv / 30) * 100 : 0,
        gap: taxaConv - 30,
        compValue: compMetricForCloser
          ? (compMetricForCloser.r1_realizada > 0 ? (compMetricForCloser.contrato_pago / compMetricForCloser.r1_realizada) * 100 : 0)
          : null,
        compVariation: null,
        format: "percent" as const,
      },
      {
        label: "Taxa No-Show",
        key: "taxaNoShow",
        realized: taxaNoShow,
        meta: 30,
        attainment: r1ag > 0 ? Math.max(0, ((30 - taxaNoShow) / 30) * 100) : 100,
        gap: taxaNoShow - 30,
        compValue: compMetricForCloser
          ? (compMetricForCloser.r1_agendada > 0 ? (compMetricForCloser.noshow / compMetricForCloser.r1_agendada) * 100 : 0)
          : null,
        compVariation: null,
        format: "percent" as const,
        invertGap: true,
      },
      makeMetric("Outside", "outside", outside, 0, "outside"),
      makeMetric("R2 Agendada", "r2Agendada", r2ag, metas.r2Agendada, "r2_agendada"),
    ];
  }, [cm, metas, compMetricForCloser]);

  // Projection based on CONTRACTS
  const projection = useMemo((): ProjectionData => {
    const realized = cm?.contrato_pago || 0;
    const metaFinal = metas.contratoPago;
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
  }, [cm, metas, businessDaysTotal, businessDaysPassed, businessDaysRemaining]);

  // Daily rows — contract-focused with extra columns
  const dailyRows = useMemo((): CloserDailyRow[] => {
    const days = eachDayOfInterval({ start: startDate, end: endDate });
    const allLeads = detail.allLeads;
    let accContratos = 0;
    let metaAcc = 0;

    return days.map((date) => {
      const dateStr = format(date, "yyyy-MM-dd");
      const isBusinessDay = isDiaUtil(date);

      // Agendados: leads scheduled on this day
      const agendados = allLeads.filter(
        (l) => l.scheduled_at?.substring(0, 10) === dateStr
      ).length;

      // Realizados: completed or contract_paid meetings on this day
      const realizados = allLeads.filter(
        (l) =>
          l.scheduled_at?.substring(0, 10) === dateStr &&
          (l.status === "completed" || l.status === "contract_paid")
      ).length;

      // No-shows on this day
      const noShows = allLeads.filter(
        (l) =>
          l.scheduled_at?.substring(0, 10) === dateStr &&
          l.status === "no_show"
      ).length;

      // Contracts paid on this day (by contract_paid_at date)
      const contratos = allLeads.filter(
        (l) => l.contract_paid_at?.substring(0, 10) === dateStr
      ).length;

      accContratos += contratos;
      if (isBusinessDay) metaAcc += CLOSER_META_DIARIA_CONTRATOS;

      const gapAcc = accContratos - metaAcc;
      const percentDay =
        isBusinessDay && CLOSER_META_DIARIA_CONTRATOS > 0
          ? (contratos / CLOSER_META_DIARIA_CONTRATOS) * 100
          : 0;
      const ratio = metaAcc > 0 ? accContratos / metaAcc : 1;
      const status: DailyRow["status"] =
        ratio >= 1 ? "above" : ratio >= 0.9 ? "on_track" : "below";

      return {
        date,
        dateStr,
        realized: contratos, // for the cumulative chart
        metaDiaria: isBusinessDay ? CLOSER_META_DIARIA_CONTRATOS : 0,
        percentDay,
        accumulated: accContratos,
        metaAccumulated: metaAcc,
        gapAccumulated: gapAcc,
        status,
        isWeekend: !isBusinessDay,
        isBusinessDay,
        // Extra closer columns
        agendados,
        realizados,
        noShows,
        contratos,
      };
    });
  }, [detail.allLeads, startDate, endDate]);

  // Funnel
  const funnel = useMemo(() => {
    const steps = [
      { label: "R1 Agendada", value: cm?.r1_agendada || 0 },
      { label: "R1 Realizada", value: cm?.r1_realizada || 0 },
      { label: "Contratos Pagos", value: cm?.contrato_pago || 0 },
    ];
    return steps.map((step, i) => ({
      ...step,
      conversionRate:
        i > 0 && steps[i - 1].value > 0
          ? (step.value / steps[i - 1].value) * 100
          : null,
    }));
  }, [cm]);

  // Team comparison
  const teamComparison = useMemo(() => {
    if (!cm) return [];
    const ta = detail.teamAverages;
    const r = detail.ranking;
    const taxaConvCloser = cm.r1_realizada > 0 ? (cm.contrato_pago / cm.r1_realizada) * 100 : 0;
    const taxaNoShowCloser = cm.r1_agendada > 0 ? (cm.noshow / cm.r1_agendada) * 100 : 0;

    const makeDiff = (val: number, avg: number) => avg > 0 ? ((val - avg) / avg) * 100 : 0;

    return [
      { label: "R1 Realizada", sdrValue: cm.r1_realizada, teamAvg: ta.avgR1Realizada, diffPercent: makeDiff(cm.r1_realizada, ta.avgR1Realizada), rank: r.r1Realizada, totalSdrs: r.total },
      { label: "Contratos Pagos", sdrValue: cm.contrato_pago, teamAvg: ta.avgContratoPago, diffPercent: makeDiff(cm.contrato_pago, ta.avgContratoPago), rank: r.contratoPago, totalSdrs: r.total },
      { label: "Taxa Conversão", sdrValue: taxaConvCloser, teamAvg: ta.avgTaxaConversao, diffPercent: makeDiff(taxaConvCloser, ta.avgTaxaConversao), rank: r.taxaConversao, totalSdrs: r.total, format: "percent" as const },
      { label: "Taxa No-Show", sdrValue: taxaNoShowCloser, teamAvg: ta.avgTaxaNoShow, diffPercent: makeDiff(taxaNoShowCloser, ta.avgTaxaNoShow), rank: r.taxaNoShow, totalSdrs: r.total, format: "percent" as const },
    ];
  }, [cm, detail.teamAverages, detail.ranking]);

  // Auto summary — focused on contracts
  const summaryText = useMemo(() => {
    if (!cm) return "";
    const name = detail.closerInfo?.name || "Closer";
    const contr = cm.contrato_pago;
    const meta = metas.contratoPago;
    const att = meta > 0 ? ((contr / meta) * 100).toFixed(0) : "0";
    const taxaConv = cm.r1_realizada > 0 ? ((contr / cm.r1_realizada) * 100).toFixed(1) : "0";

    let text = `Neste período, ${name} fechou ${contr} contratos de ${meta} previstos, atingindo ${att}% da meta.`;
    text += ` Teve ${cm.r1_agendada} reuniões agendadas, realizou ${cm.r1_realizada} (taxa de conversão: ${taxaConv}%).`;

    if (projection.gap > 0 && businessDaysRemaining > 0) {
      text += ` Para bater a meta, precisa de ${projection.requiredPerDay.toFixed(1)} contratos/dia útil restante.`;
    } else if (projection.gap <= 0) {
      text += ` Já atingiu a meta de contratos do período! 🎉`;
    }

    return text;
  }, [cm, detail.closerInfo, metas, projection, businessDaysRemaining]);

  return {
    metrics,
    projection,
    dailyRows,
    funnel,
    teamComparison,
    summaryText,
    closerInfo: detail.closerInfo,
    leads: detail.leads,
    noShowLeads: detail.noShowLeads,
    r2Leads: detail.r2Leads,
    allLeads: detail.allLeads,
    meetings: detail.allLeads,
    isLoading: detail.isLoading || compCloserMetrics.isLoading,
    error: detail.error || compCloserMetrics.error || null,
    refetch: () => {
      detail.refetch();
      compCloserMetrics.refetch();
    },
  };
}
