import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Target, Settings2 } from "lucide-react";
import { GoalsMatrixTable } from "./GoalsMatrixTable";
import { TeamGoalsEditModal } from "./TeamGoalsEditModal";
import { useSdrTeamTargets, SdrTargetType } from "@/hooks/useSdrTeamTargets";
import { useSdrWeekdayTargets, resolveWeekdayTarget } from "@/hooks/useSdrWeekdayTargets";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";

interface MetricValues {
  agendamento: number;
  r1Agendada: number;
  r1Realizada: number;
  noShow: number;
  contrato: number;
  r2Agendada: number;
  r2Realizada: number;
  vendaRealizada: number;
}

interface TeamGoalsPanelProps {
  dayValues: MetricValues;
  weekValues: MetricValues;
  monthValues: MetricValues;
  buPrefix?: string; // e.g. 'consorcio_sdr_' for consórcio, default 'sdr_'
  segmentAValues?: { day: MetricValues; week: MetricValues; month: MetricValues };
  segmentBValues?: { day: MetricValues; week: MetricValues; month: MetricValues };
}

export function TeamGoalsPanel({ dayValues, weekValues, monthValues, buPrefix = 'sdr_', segmentAValues, segmentBValues }: TeamGoalsPanelProps) {
  const [editModalOpen, setEditModalOpen] = useState(false);
  const { role } = useAuth();
  const { data: targets, isLoading } = useSdrTeamTargets(buPrefix);
  const { data: weekdayOverrides } = useSdrWeekdayTargets(new Date(), buPrefix);
  const todayDow = new Date().getDay();

  // Roles allowed to edit
  const canEdit = role && ['admin', 'manager', 'coordenador'].includes(role);

  // Map target types to their values - uses buPrefix to find correct targets
  const getTargetValue = (suffix: string): number => {
    const targetType = `${buPrefix}${suffix}`;
    const target = targets?.find(t => t.target_type === targetType);
    return target?.target_value ?? 0;
  };

  // Meta do dia: usa override do dia da semana de hoje, com fallback no valor único
  const getDayTargetValue = (suffix: string): number => {
    const targetType = `${buPrefix}${suffix}`;
    return resolveWeekdayTarget(weekdayOverrides, targetType, todayDow, getTargetValue(suffix));
  };

  // Day targets
  const dayTargets = useMemo(() => ({
    agendamento: getDayTargetValue('agendamento_dia'),
    r1Agendada: getDayTargetValue('r1_agendada_dia'),
    r1Realizada: getDayTargetValue('r1_realizada_dia'),
    noShow: getDayTargetValue('noshow_dia'),
    contrato: getDayTargetValue('contrato_dia'),
    r2Agendada: getDayTargetValue('r2_agendada_dia'),
    r2Realizada: getDayTargetValue('r2_realizada_dia'),
    vendaRealizada: getDayTargetValue('venda_realizada_dia'),
  }), [targets, weekdayOverrides, todayDow, buPrefix]);

  // Week targets
  const weekTargets = useMemo(() => ({
    agendamento: getTargetValue('agendamento_semana'),
    r1Agendada: getTargetValue('r1_agendada_semana'),
    r1Realizada: getTargetValue('r1_realizada_semana'),
    noShow: getTargetValue('noshow_semana'),
    contrato: getTargetValue('contrato_semana'),
    r2Agendada: getTargetValue('r2_agendada_semana'),
    r2Realizada: getTargetValue('r2_realizada_semana'),
    vendaRealizada: getTargetValue('venda_realizada_semana'),
  }), [targets, buPrefix]);

  // Month targets
  const monthTargets = useMemo(() => ({
    agendamento: getTargetValue('agendamento_mes'),
    r1Agendada: getTargetValue('r1_agendada_mes'),
    r1Realizada: getTargetValue('r1_realizada_mes'),
    noShow: getTargetValue('noshow_mes'),
    contrato: getTargetValue('contrato_mes'),
    r2Agendada: getTargetValue('r2_agendada_mes'),
    r2Realizada: getTargetValue('r2_realizada_mes'),
    vendaRealizada: getTargetValue('venda_realizada_mes'),
  }), [targets, buPrefix]);

  if (isLoading) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="p-3 sm:p-6">
          <Skeleton className="h-[300px] w-full rounded-lg" />
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
            {canEdit && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditModalOpen(true)}
                className="h-7 sm:h-8 px-2 text-xs sm:text-sm"
              >
                <Settings2 className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                <span className="hidden sm:inline">Editar</span>
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0 px-3 sm:px-6 pb-3 sm:pb-6">
          <GoalsMatrixTable
            dayValues={dayValues}
            weekValues={weekValues}
            monthValues={monthValues}
            dayTargets={dayTargets}
            weekTargets={weekTargets}
            monthTargets={monthTargets}
            segmentAValues={segmentAValues}
            segmentBValues={segmentBValues}
          />
        </CardContent>
      </Card>

      <TeamGoalsEditModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        existingTargets={targets || []}
        buPrefix={buPrefix}
      />
    </>
  );
}
