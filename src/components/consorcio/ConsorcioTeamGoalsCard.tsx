import { useMemo, useState } from "react";
import {
  startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
} from "date-fns";
import { Target, Settings2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ConsorcioGoalsMatrixTable, ConsorcioMetricRow } from "@/components/sdr/ConsorcioGoalsMatrixTable";
import { TeamGoalsEditModal } from "@/components/sdr/TeamGoalsEditModal";
import { useConsorcioAgendaTotais, sumConsorcioTotais } from "@/hooks/useConsorcioAgendaFatos";
import { useConsorcioPipelineMetrics } from "@/hooks/useConsorcioPipelineMetrics";
import { useConsorcioProdutosFechadosMetrics } from "@/hooks/useConsorcioProdutosFechadosMetrics";
import { useConsorcioCotasContratadas } from "@/hooks/useConsorcioCotasContratadas";
import { useSdrTeamTargets } from "@/hooks/useSdrTeamTargets";
import { useSdrWeekdayTargets, resolveWeekdayTarget } from "@/hooks/useSdrWeekdayTargets";
import { CONSORCIO_WEEK_STARTS_ON } from "@/lib/businessDays";
import { CONSORCIO_LABELS } from "@/lib/consorcioLabels";
import { useAuth } from "@/contexts/AuthContext";

const BU_SQUAD = "consorcio";
const BU_PREFIX = "consorcio_sdr_";

/**
 * Bloco "Metas da Equipe" do Consórcio (MÉTRICA × DIA / SEMANA / MÊS).
 *
 * Movido do Painel Comercial para o BI Consórcio. As janelas são fixas
 * (hoje / semana corrente / mês corrente), exatamente como já eram — o card
 * nunca usou o seletor de período da tela. Sem filtro de funil (mesmo
 * comportamento do Painel com nenhum funil selecionado).
 */
export function ConsorcioTeamGoalsCard() {
  const { role } = useAuth();
  const canEditGoals = !!role && ["admin", "manager", "coordenador"].includes(role);
  const [goalsEditModalOpen, setGoalsEditModalOpen] = useState(false);

  const today = new Date();
  const dayStart = startOfDay(today);
  const dayEnd = endOfDay(today);
  const weekStartDate = startOfWeek(dayStart, { weekStartsOn: CONSORCIO_WEEK_STARTS_ON });
  const weekEndDate = endOfWeek(dayStart, { weekStartsOn: CONSORCIO_WEEK_STARTS_ON });
  const monthStartDate = startOfMonth(today);
  const monthEndDate = endOfMonth(today);

  const { data: totaisDayRows } = useConsorcioAgendaTotais(dayStart, dayEnd);
  const { data: totaisWeekRows } = useConsorcioAgendaTotais(weekStartDate, weekEndDate);
  const { data: totaisMonthRows } = useConsorcioAgendaTotais(monthStartDate, monthEndDate);

  const fatosDayTotals = useMemo(() => sumConsorcioTotais(totaisDayRows, null), [totaisDayRows]);
  const fatosWeekTotals = useMemo(() => sumConsorcioTotais(totaisWeekRows, null), [totaisWeekRows]);
  const fatosMonthTotals = useMemo(() => sumConsorcioTotais(totaisMonthRows, null), [totaisMonthRows]);

  const pipelineMetrics = useConsorcioPipelineMetrics();
  const produtosFechados = useConsorcioProdutosFechadosMetrics();

  const { data: cotasDay } = useConsorcioCotasContratadas(dayStart, dayEnd, null, BU_SQUAD);
  const { data: cotasWeek } = useConsorcioCotasContratadas(weekStartDate, weekEndDate, null, BU_SQUAD);
  const { data: cotasMonth } = useConsorcioCotasContratadas(monthStartDate, monthEndDate, null, BU_SQUAD);

  const { data: consorcioTargets, isLoading: targetsLoading } = useSdrTeamTargets(BU_PREFIX);
  const { data: consorcioWeekdayOverrides } = useSdrWeekdayTargets(new Date(), BU_PREFIX);
  const todayDow = new Date().getDay();

  const getTargetValue = (suffix: string): number => {
    const targetType = `${BU_PREFIX}${suffix}`;
    const target = consorcioTargets?.find((t) => t.target_type === targetType);
    return target?.target_value ?? 0;
  };

  const getDayTargetValue = (suffix: string): number => {
    const targetType = `${BU_PREFIX}${suffix}`;
    return resolveWeekdayTarget(consorcioWeekdayOverrides, targetType, todayDow, getTargetValue(suffix));
  };

  const consorcioGoalsRows = useMemo((): ConsorcioMetricRow[] => {
    const pm = pipelineMetrics;
    return [
      {
        label: 'Agendamento',
        day: { value: fatosDayTotals.agendamentos, target: getDayTargetValue('agendamento_dia') },
        week: { value: fatosWeekTotals.agendamentos, target: getTargetValue('agendamento_semana') },
        month: { value: fatosMonthTotals.agendamentos, target: getTargetValue('agendamento_mes') },
      },
      {
        label: CONSORCIO_LABELS.reunioesAgendadas,
        day: { value: fatosDayTotals.r1Agendada, target: getDayTargetValue('r1_agendada_dia') },
        week: { value: fatosWeekTotals.r1Agendada, target: getTargetValue('r1_agendada_semana') },
        month: { value: fatosMonthTotals.r1Agendada, target: getTargetValue('r1_agendada_mes') },
      },
      {
        label: CONSORCIO_LABELS.reunioesRealizadas,
        day: { value: fatosDayTotals.r1Realizada, target: getDayTargetValue('r1_realizada_dia') },
        week: { value: fatosWeekTotals.r1Realizada, target: getTargetValue('r1_realizada_semana') },
        month: { value: fatosMonthTotals.r1Realizada, target: getTargetValue('r1_realizada_mes') },
      },
      {
        label: 'No-Show',
        day: { value: fatosDayTotals.noShows, target: getDayTargetValue('noshow_dia') },
        week: { value: fatosWeekTotals.noShows, target: getTargetValue('noshow_semana') },
        month: { value: fatosMonthTotals.noShows, target: getTargetValue('noshow_mes') },
      },
      {
        label: 'Proposta Enviada',
        day: { value: pm.day.propostaEnviada, target: getDayTargetValue('proposta_enviada_dia') },
        week: { value: pm.week.propostaEnviada, target: getTargetValue('proposta_enviada_semana') },
        month: { value: pm.month.propostaEnviada, target: getTargetValue('proposta_enviada_mes') },
      },
      {
        label: 'Cotas Contratadas',
        day: { value: cotasDay?.total || 0, target: getDayTargetValue('cota_contratada_dia') },
        week: { value: cotasWeek?.total || 0, target: getTargetValue('cota_contratada_semana') },
        month: { value: cotasMonth?.total || 0, target: getTargetValue('cota_contratada_mes') },
      },
      ...produtosFechados.products.map((prod) => ({
        label: prod.label,
        pipelineGroup: 'Produtos Fechados',
        day: { value: prod.day, target: 0 },
        week: { value: prod.week, target: 0 },
        month: { value: prod.month, target: 0 },
      })),
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    fatosDayTotals, fatosWeekTotals, fatosMonthTotals, pipelineMetrics,
    consorcioTargets, consorcioWeekdayOverrides, todayDow, produtosFechados,
    cotasDay, cotasWeek, cotasMonth,
  ]);

  if (targetsLoading) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="p-3 sm:p-6">
          <Skeleton className="h-[400px] w-full rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="bg-card border-border">
        <CardHeader className="pb-2 sm:pb-3 px-3 sm:px-6">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <Target className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              Metas da Equipe
            </CardTitle>
            {canEditGoals && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setGoalsEditModalOpen(true)}
                className="h-7 sm:h-8 px-2 text-xs sm:text-sm"
              >
                <Settings2 className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                <span className="hidden sm:inline">Editar</span>
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0 px-3 sm:px-6 pb-3 sm:pb-6">
          <ConsorcioGoalsMatrixTable rows={consorcioGoalsRows} />
        </CardContent>
      </Card>

      <TeamGoalsEditModal
        open={goalsEditModalOpen}
        onOpenChange={setGoalsEditModalOpen}
        existingTargets={consorcioTargets || []}
        buPrefix={BU_PREFIX}
      />
    </>
  );
}
