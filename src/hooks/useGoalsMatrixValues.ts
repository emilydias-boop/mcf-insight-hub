import { useMemo } from "react";
import { useTeamMeetingsData } from "./useTeamMeetingsData";
import { useR2MeetingSlotsKPIs } from "./useR2MeetingSlotsKPIs";
import { useR2VendasKPIs } from "./useR2VendasKPIs";
import { useR1CloserMetrics } from "./useR1CloserMetrics";
import { IcpSegmentFilterValue } from "./useDealsIcpSegments";

export interface GoalsMatrixMetricValues {
  agendamento: number;
  r1Agendada: number;
  r1Realizada: number;
  noShow: number;
  contrato: number;
  r2Agendada: number;
  r2Realizada: number;
  vendaRealizada: number;
}

interface Params {
  segment: IcpSegmentFilterValue;
  dayStart: Date;
  dayEnd: Date;
  weekStart: Date;
  weekEnd: Date;
  monthStart: Date;
  monthEnd: Date;
  /** Janela do período selecionado na tela — fonte do Contrato Pago da coluna Mês. */
  periodStart: Date;
  periodEnd: Date;
}

/**
 * Valores realizados (Dia/Semana/Mês) da tabela MÉTRICA da página Reuniões Equipe,
 * calculados para um segmento ICP específico ('all' = comportamento total de sempre).
 */
export function useGoalsMatrixValues({
  segment,
  dayStart,
  dayEnd,
  weekStart,
  weekEnd,
  monthStart,
  monthEnd,
  periodStart,
  periodEnd,
}: Params) {
  const { teamKPIs: dayKPIs } = useTeamMeetingsData({ startDate: dayStart, endDate: dayEnd, segment });
  const { teamKPIs: weekKPIs } = useTeamMeetingsData({ startDate: weekStart, endDate: weekEnd, segment });
  const { teamKPIs: monthKPIs } = useTeamMeetingsData({ startDate: monthStart, endDate: monthEnd, segment });

  const { data: dayR2AgendaKPIs } = useR2MeetingSlotsKPIs(dayStart, dayEnd, segment);
  const { data: weekR2AgendaKPIs } = useR2MeetingSlotsKPIs(weekStart, weekEnd, segment);
  const { data: monthR2AgendaKPIs } = useR2MeetingSlotsKPIs(monthStart, monthEnd, segment);

  const { data: dayR2VendasKPIs } = useR2VendasKPIs(dayStart, dayEnd, segment);
  const { data: weekR2VendasKPIs } = useR2VendasKPIs(weekStart, weekEnd, segment);
  const { data: monthR2VendasKPIs } = useR2VendasKPIs(monthStart, monthEnd, segment);

  const { data: dayCloserMetrics } = useR1CloserMetrics(dayStart, dayEnd, "incorporador", segment);
  const { data: weekCloserMetrics } = useR1CloserMetrics(weekStart, weekEnd, "incorporador", segment);
  const { data: periodCloserMetrics } = useR1CloserMetrics(periodStart, periodEnd, "incorporador", segment);

  const sumContratos = (rows?: { contrato_pago: number; outside: number }[]) =>
    rows?.reduce((sum, c) => sum + c.contrato_pago + c.outside, 0) ?? 0;

  const dayValues = useMemo<GoalsMatrixMetricValues>(() => ({
    agendamento: dayKPIs?.totalAgendamentos || 0,
    r1Agendada: dayKPIs?.totalR1Agendada || 0,
    r1Realizada: dayKPIs?.totalRealizadas || 0,
    noShow: dayKPIs?.totalNoShows || 0,
    contrato: sumContratos(dayCloserMetrics),
    r2Agendada: dayR2AgendaKPIs?.r2Agendadas || 0,
    r2Realizada: dayR2AgendaKPIs?.r2Realizadas || 0,
    vendaRealizada: dayR2VendasKPIs?.vendasRealizadas || 0,
  }), [dayKPIs, dayR2AgendaKPIs, dayR2VendasKPIs, dayCloserMetrics]);

  const weekValues = useMemo<GoalsMatrixMetricValues>(() => ({
    agendamento: weekKPIs?.totalAgendamentos || 0,
    r1Agendada: weekKPIs?.totalR1Agendada || 0,
    r1Realizada: weekKPIs?.totalRealizadas || 0,
    noShow: weekKPIs?.totalNoShows || 0,
    contrato: sumContratos(weekCloserMetrics),
    r2Agendada: weekR2AgendaKPIs?.r2Agendadas || 0,
    r2Realizada: weekR2AgendaKPIs?.r2Realizadas || 0,
    vendaRealizada: weekR2VendasKPIs?.vendasRealizadas || 0,
  }), [weekKPIs, weekR2AgendaKPIs, weekR2VendasKPIs, weekCloserMetrics]);

  const monthValues = useMemo<GoalsMatrixMetricValues>(() => ({
    agendamento: monthKPIs?.totalAgendamentos || 0,
    r1Agendada: monthKPIs?.totalR1Agendada || 0,
    r1Realizada: monthKPIs?.totalRealizadas || 0,
    noShow: monthKPIs?.totalNoShows || 0,
    contrato: sumContratos(periodCloserMetrics),
    r2Agendada: monthR2AgendaKPIs?.r2Agendadas || 0,
    r2Realizada: monthR2AgendaKPIs?.r2Realizadas || 0,
    vendaRealizada: monthR2VendasKPIs?.vendasRealizadas || 0,
  }), [monthKPIs, monthR2AgendaKPIs, monthR2VendasKPIs, periodCloserMetrics]);

  return { dayValues, weekValues, monthValues };
}
