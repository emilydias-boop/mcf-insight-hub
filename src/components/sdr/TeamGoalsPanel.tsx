import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Target, Settings2 } from "lucide-react";
import { GaugeSemicircle } from "@/components/tv/GaugeSemicircle";
import { TeamGoalsEditModal } from "./TeamGoalsEditModal";
import { useSdrTeamTargets, SDR_TARGET_CONFIGS, SdrTargetType } from "@/hooks/useSdrTeamTargets";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";

interface TeamGoalsPanelProps {
  // Current values from TeamKPIs
  dayValues: {
    agendamento: number;
    r1Agendada: number;
    r1Realizada: number;
    noShow: number;
    contrato: number;
  };
  weekValues: {
    agendamento: number;
    r1Agendada: number;
    r1Realizada: number;
    noShow: number;
    contrato: number;
  };
}

export function TeamGoalsPanel({ dayValues, weekValues }: TeamGoalsPanelProps) {
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
  ], [dayValues, targets]);

  // Week gauges configuration
  const weekGauges = useMemo(() => [
    { titulo: 'Agendamento', valor: weekValues.agendamento, meta: getTargetValue('sdr_agendamento_semana') },
    { titulo: 'R1 Agendada', valor: weekValues.r1Agendada, meta: getTargetValue('sdr_r1_agendada_semana') },
    { titulo: 'R1 Realizada', valor: weekValues.r1Realizada, meta: getTargetValue('sdr_r1_realizada_semana') },
    { titulo: 'No-Show', valor: weekValues.noShow, meta: getTargetValue('sdr_noshow_semana') },
    { titulo: 'Contrato Pago', valor: weekValues.contrato, meta: getTargetValue('sdr_contrato_semana') },
  ], [weekValues, targets]);

  if (isLoading) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="p-6">
          <div className="grid grid-cols-5 gap-4">
            {[...Array(10)].map((_, i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Metas da Equipe
            </CardTitle>
            {canEdit && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditModalOpen(true)}
                className="h-8 px-2"
              >
                <Settings2 className="h-4 w-4 mr-1" />
                Editar
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0 space-y-4">
          {/* Day section */}
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Dia</h3>
            <div className="grid grid-cols-5 gap-2">
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
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Semana</h3>
            <div className="grid grid-cols-5 gap-2">
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
