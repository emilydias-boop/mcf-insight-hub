import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Target, Settings2 } from "lucide-react";
import { GaugeSemicircle } from "./GaugeSemicircle";
import { TeamGoalsEditModal } from "./TeamGoalsEditModal";
import { useSdrTeamTargets, SDR_TARGET_CONFIGS, SdrTargetType } from "@/hooks/useSdrTeamTargets";
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
}

export function TeamGoalsPanel({ dayValues, weekValues, monthValues }: TeamGoalsPanelProps) {
  const [editModalOpen, setEditModalOpen] = useState(false);
  const { role } = useAuth();
  const { data: targets, isLoading } = useSdrTeamTargets();

  // Roles allowed to edit
  const canEdit = role && ['admin', 'manager', 'coordenador'].includes(role);

  // Map target types to their values
  const getTargetValue = (type: SdrTargetType): number => {
    const target = targets?.find(t => t.target_type === type);
    return target?.target_value ?? 0;
  };

  // Day gauges configuration
  const dayGauges = useMemo(() => [
    { titulo: 'Agendamento', valor: dayValues.agendamento, meta: getTargetValue('sdr_agendamento_dia') },
    { titulo: 'R1 Agendada', valor: dayValues.r1Agendada, meta: getTargetValue('sdr_r1_agendada_dia') },
    { titulo: 'R1 Realizada', valor: dayValues.r1Realizada, meta: getTargetValue('sdr_r1_realizada_dia') },
    { titulo: 'No-Show', valor: dayValues.noShow, meta: getTargetValue('sdr_noshow_dia') },
    { titulo: 'Contrato Pago', valor: dayValues.contrato, meta: getTargetValue('sdr_contrato_dia') },
    { titulo: 'R2 Agendada', valor: dayValues.r2Agendada, meta: getTargetValue('sdr_r2_agendada_dia') },
    { titulo: 'R2 Realizada', valor: dayValues.r2Realizada, meta: getTargetValue('sdr_r2_realizada_dia') },
    { titulo: 'Vendas Realizadas', valor: dayValues.vendaRealizada, meta: getTargetValue('sdr_venda_realizada_dia') },
  ], [dayValues, targets]);

  // Week gauges configuration
  const weekGauges = useMemo(() => [
    { titulo: 'Agendamento', valor: weekValues.agendamento, meta: getTargetValue('sdr_agendamento_semana') },
    { titulo: 'R1 Agendada', valor: weekValues.r1Agendada, meta: getTargetValue('sdr_r1_agendada_semana') },
    { titulo: 'R1 Realizada', valor: weekValues.r1Realizada, meta: getTargetValue('sdr_r1_realizada_semana') },
    { titulo: 'No-Show', valor: weekValues.noShow, meta: getTargetValue('sdr_noshow_semana') },
    { titulo: 'Contrato Pago', valor: weekValues.contrato, meta: getTargetValue('sdr_contrato_semana') },
    { titulo: 'R2 Agendada', valor: weekValues.r2Agendada, meta: getTargetValue('sdr_r2_agendada_semana') },
    { titulo: 'R2 Realizada', valor: weekValues.r2Realizada, meta: getTargetValue('sdr_r2_realizada_semana') },
    { titulo: 'Vendas Realizadas', valor: weekValues.vendaRealizada, meta: getTargetValue('sdr_venda_realizada_semana') },
  ], [weekValues, targets]);

  // Month gauges configuration
  const monthGauges = useMemo(() => [
    { titulo: 'Agendamento', valor: monthValues.agendamento, meta: getTargetValue('sdr_agendamento_mes') },
    { titulo: 'R1 Agendada', valor: monthValues.r1Agendada, meta: getTargetValue('sdr_r1_agendada_mes') },
    { titulo: 'R1 Realizada', valor: monthValues.r1Realizada, meta: getTargetValue('sdr_r1_realizada_mes') },
    { titulo: 'No-Show', valor: monthValues.noShow, meta: getTargetValue('sdr_noshow_mes') },
    { titulo: 'Contrato Pago', valor: monthValues.contrato, meta: getTargetValue('sdr_contrato_mes') },
    { titulo: 'R2 Agendada', valor: monthValues.r2Agendada, meta: getTargetValue('sdr_r2_agendada_mes') },
    { titulo: 'R2 Realizada', valor: monthValues.r2Realizada, meta: getTargetValue('sdr_r2_realizada_mes') },
    { titulo: 'Vendas Realizadas', valor: monthValues.vendaRealizada, meta: getTargetValue('sdr_venda_realizada_mes') },
  ], [monthValues, targets]);

  if (isLoading) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="p-3 sm:p-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
            {[...Array(8)].map((_, i) => (
              <Skeleton key={i} className="h-24 sm:h-32 w-full" />
            ))}
          </div>
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
        <CardContent className="pt-0 space-y-3 sm:space-y-4 px-3 sm:px-6 pb-3 sm:pb-6">
          {/* Day section */}
          <div>
            <h3 className="text-xs sm:text-sm font-medium text-muted-foreground mb-1.5 sm:mb-2">Dia</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-1.5 sm:gap-2">
              {dayGauges.map((gauge, index) => (
                <GaugeSemicircle
                  key={`day-${index}`}
                  titulo={gauge.titulo}
                  valor={gauge.valor}
                  meta={gauge.meta}
                />
              ))}
            </div>
          </div>

          {/* Week section */}
          <div>
            <h3 className="text-xs sm:text-sm font-medium text-muted-foreground mb-1.5 sm:mb-2">Semana</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-1.5 sm:gap-2">
              {weekGauges.map((gauge, index) => (
                <GaugeSemicircle
                  key={`week-${index}`}
                  titulo={gauge.titulo}
                  valor={gauge.valor}
                  meta={gauge.meta}
                />
              ))}
            </div>
          </div>

          {/* Month section */}
          <div>
            <h3 className="text-xs sm:text-sm font-medium text-muted-foreground mb-1.5 sm:mb-2">Mês</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-1.5 sm:gap-2">
              {monthGauges.map((gauge, index) => (
                <GaugeSemicircle
                  key={`month-${index}`}
                  titulo={gauge.titulo}
                  valor={gauge.valor}
                  meta={gauge.meta}
                />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <TeamGoalsEditModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        existingTargets={targets || []}
      />
    </>
  );
}
