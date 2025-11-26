import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Target, TrendingUp, Users, UserCheck, DollarSign, Copy } from "lucide-react";
import { useTeamTargets, useCreateTeamTarget, useUpdateTeamTarget, useCopyTargetsFromPreviousWeek } from "@/hooks/useTeamTargets";
import { useCRMStages, useCRMOrigins } from "@/hooks/useCRMData";
import { addDays, startOfWeek, endOfWeek, format, subWeeks } from "date-fns";
import { ptBR } from "date-fns/locale";

const PIPELINE_INSIDE_SALES_ID = "e3c04f21-ba2c-4c66-84f8-b4341c826b1c";

export function TargetsConfigDialog() {
  const [open, setOpen] = useState(false);
  const [selectedWeekStart, setSelectedWeekStart] = useState(
    startOfWeek(new Date(), { weekStartsOn: 6 }) // Sábado
  );
  
  const weekEnd = endOfWeek(selectedWeekStart, { weekStartsOn: 6 }); // Sexta
  
  const { data: stages } = useCRMStages(PIPELINE_INSIDE_SALES_ID);
  const { data: targets, isLoading } = useTeamTargets(selectedWeekStart, weekEnd);
  const createTarget = useCreateTeamTarget();
  const updateTarget = useUpdateTeamTarget();
  const copyTargets = useCopyTargetsFromPreviousWeek();

  const [targetValues, setTargetValues] = useState<Record<string, number>>({});

  const handleCopyFromPreviousWeek = () => {
    const previousWeekStart = subWeeks(selectedWeekStart, 1);
    copyTargets.mutate({
      fromWeekStart: previousWeekStart,
      toWeekStart: selectedWeekStart,
      toWeekEnd: weekEnd,
    });
  };

  const handleSaveTarget = (type: string, name: string, referenceId: string | null, originId: string | null) => {
    const key = `${type}-${referenceId || name}`;
    const value = targetValues[key];
    
    if (value === undefined || value === null) return;

    const existingTarget = targets?.find(
      t => t.target_type === type && t.reference_id === referenceId && t.target_name === name
    );

    if (existingTarget) {
      updateTarget.mutate({
        id: existingTarget.id,
        updates: { target_value: value },
      });
    } else {
      createTarget.mutate({
        target_type: type as any,
        target_name: name,
        reference_id: referenceId,
        week_start: selectedWeekStart.toISOString().split('T')[0],
        week_end: weekEnd.toISOString().split('T')[0],
        target_value: value,
        current_value: 0,
        origin_id: originId,
      });
    }
  };

  const getTargetValue = (type: string, name: string, referenceId: string | null) => {
    const key = `${type}-${referenceId || name}`;
    if (targetValues[key] !== undefined) return targetValues[key];
    
    const existing = targets?.find(
      t => t.target_type === type && t.reference_id === referenceId && t.target_name === name
    );
    return existing?.target_value || 0;
  };

  const setTargetValue = (type: string, name: string, referenceId: string | null, value: number) => {
    const key = `${type}-${referenceId || name}`;
    setTargetValues(prev => ({ ...prev, [key]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Target className="mr-2 h-4 w-4" />
          Configurar Metas
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Configurar Metas da Semana</DialogTitle>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>
              {format(selectedWeekStart, "dd/MM/yyyy", { locale: ptBR })} até {format(weekEnd, "dd/MM/yyyy", { locale: ptBR })}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopyFromPreviousWeek}
              disabled={copyTargets.isPending}
            >
              <Copy className="h-4 w-4 mr-1" />
              Copiar Semana Anterior
            </Button>
          </div>
        </DialogHeader>

        <Tabs defaultValue="funnel" className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="funnel">Funil</TabsTrigger>
            <TabsTrigger value="ultras">Ultras</TabsTrigger>
            <TabsTrigger value="closers">Closers</TabsTrigger>
            <TabsTrigger value="sdrs">SDRs</TabsTrigger>
            <TabsTrigger value="team">Equipe</TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 mt-4">
            <TabsContent value="funnel" className="space-y-4">
              <h3 className="text-sm font-semibold">Metas por Etapa do Funil</h3>
              {stages?.map(stage => (
                <div key={stage.id} className="flex items-center gap-3 p-3 border rounded-lg">
                  <Label className="flex-1">{stage.stage_name}</Label>
                  <Input
                    type="number"
                    className="w-32"
                    placeholder="Meta"
                    value={getTargetValue('funnel_stage', stage.stage_name, stage.id)}
                    onChange={(e) => setTargetValue('funnel_stage', stage.stage_name, stage.id, Number(e.target.value))}
                  />
                  <Button
                    size="sm"
                    onClick={() => handleSaveTarget('funnel_stage', stage.stage_name, stage.id, PIPELINE_INSIDE_SALES_ID)}
                  >
                    Salvar
                  </Button>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="ultras" className="space-y-4">
              <h3 className="text-sm font-semibold">Meta de Ultrapassagem</h3>
              <div className="flex items-center gap-3 p-3 border rounded-lg">
                <Label className="flex-1">Ultrameta Semanal</Label>
                <Input
                  type="number"
                  className="w-32"
                  placeholder="Meta"
                  value={getTargetValue('ultrameta', 'Ultrameta Semanal', null)}
                  onChange={(e) => setTargetValue('ultrameta', 'Ultrameta Semanal', null, Number(e.target.value))}
                />
                <Button
                  size="sm"
                  onClick={() => handleSaveTarget('ultrameta', 'Ultrameta Semanal', null, null)}
                >
                  Salvar
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="closers" className="space-y-4">
              <h3 className="text-sm font-semibold">Metas de Closers</h3>
              <p className="text-sm text-muted-foreground">Configure metas individuais para cada closer</p>
            </TabsContent>

            <TabsContent value="sdrs" className="space-y-4">
              <h3 className="text-sm font-semibold">Metas de SDRs</h3>
              <p className="text-sm text-muted-foreground">Configure metas individuais para cada SDR</p>
            </TabsContent>

            <TabsContent value="team" className="space-y-4">
              <h3 className="text-sm font-semibold">Metas da Equipe</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 border rounded-lg">
                  <Label className="flex-1">Faturamento Semanal</Label>
                  <Input
                    type="number"
                    className="w-32"
                    placeholder="Meta"
                    value={getTargetValue('team_revenue', 'Faturamento Semanal', null)}
                    onChange={(e) => setTargetValue('team_revenue', 'Faturamento Semanal', null, Number(e.target.value))}
                  />
                  <Button
                    size="sm"
                    onClick={() => handleSaveTarget('team_revenue', 'Faturamento Semanal', null, null)}
                  >
                    Salvar
                  </Button>
                </div>
                <div className="flex items-center gap-3 p-3 border rounded-lg">
                  <Label className="flex-1">Vendas Semanais</Label>
                  <Input
                    type="number"
                    className="w-32"
                    placeholder="Meta"
                    value={getTargetValue('team_sales', 'Vendas Semanais', null)}
                    onChange={(e) => setTargetValue('team_sales', 'Vendas Semanais', null, Number(e.target.value))}
                  />
                  <Button
                    size="sm"
                    onClick={() => handleSaveTarget('team_sales', 'Vendas Semanais', null, null)}
                  >
                    Salvar
                  </Button>
                </div>
              </div>
            </TabsContent>
          </ScrollArea>
        </Tabs>

        <div className="flex justify-end pt-4 border-t">
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
