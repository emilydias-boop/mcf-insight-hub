import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Target, Copy, Save } from "lucide-react";
import { useTeamTargets, useCreateTeamTarget, useUpdateTeamTarget, useCopyTargetsFromPreviousWeek } from "@/hooks/useTeamTargets";
import { useCRMStages } from "@/hooks/useCRMData";
import { startOfWeek, endOfWeek, format, subWeeks } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

const PIPELINE_INSIDE_SALES_ID = "e3c04f21-ba2c-4c66-84f8-b4341c826b1c";

type TargetKey = string;

export function TargetsConfigDialog() {
  const [open, setOpen] = useState(false);
  const [selectedWeekStart, setSelectedWeekStart] = useState(
    startOfWeek(new Date(), { weekStartsOn: 6 }) // Sábado
  );
  const [copyFromWeek, setCopyFromWeek] = useState<string>("");
  
  const weekEnd = endOfWeek(selectedWeekStart, { weekStartsOn: 6 }); // Sexta
  
  const { data: stages } = useCRMStages(PIPELINE_INSIDE_SALES_ID);
  const { data: targets, isLoading } = useTeamTargets(selectedWeekStart, weekEnd);
  const createTarget = useCreateTeamTarget();
  const updateTarget = useUpdateTeamTarget();
  const copyTargets = useCopyTargetsFromPreviousWeek();

  // State para metas diárias (usuário edita)
  const [dailyTargets, setDailyTargets] = useState<Record<TargetKey, number>>({});

  // Gerar últimas 8 semanas disponíveis para copiar
  const availableWeeks = useMemo(() => {
    return Array.from({ length: 8 }, (_, i) => {
      const weekStart = subWeeks(selectedWeekStart, i + 1);
      const weekEndDate = endOfWeek(weekStart, { weekStartsOn: 6 });
      return {
        value: format(weekStart, 'yyyy-MM-dd'),
        label: `${format(weekStart, 'dd/MM', { locale: ptBR })} - ${format(weekEndDate, 'dd/MM/yyyy', { locale: ptBR })}`,
        start: weekStart,
        end: weekEndDate,
      };
    });
  }, [selectedWeekStart]);

  const handleCopyFromSelectedWeek = () => {
    if (!copyFromWeek) {
      toast.error('Selecione uma semana para copiar');
      return;
    }

    const selectedWeek = availableWeeks.find(w => w.value === copyFromWeek);
    if (!selectedWeek) return;
    
    copyTargets.mutate({
      fromWeekStart: selectedWeek.start,
      toWeekStart: selectedWeekStart,
      toWeekEnd: weekEnd,
    });
  };

  // Calcular metas semanais e mensais automaticamente
  const calculateWeekly = (daily: number) => daily * 7;
  const calculateMonthly = (daily: number) => daily * 30;

  // Obter meta diária (do state ou dos targets existentes convertidos)
  const getDailyTarget = (type: string, name: string, referenceId: string | null): number => {
    const key = `${type}-${referenceId || name}`;
    
    if (dailyTargets[key] !== undefined) {
      return dailyTargets[key];
    }
    
    const existing = targets?.find(
      t => t.target_type === type && t.reference_id === referenceId && t.target_name === name
    );
    
    // Se existe target semanal, converter para diário (dividir por 7)
    return existing?.target_value ? Math.round(existing.target_value / 7) : 0;
  };

  const setDailyTarget = (type: string, name: string, referenceId: string | null, value: number) => {
    const key = `${type}-${referenceId || name}`;
    setDailyTargets(prev => ({ ...prev, [key]: value }));
  };

  // Salvar todas as metas de uma vez
  const handleSaveAll = async () => {
    const promises: Promise<any>[] = [];

    // Salvar metas do funil
    stages?.forEach(stage => {
      const daily = getDailyTarget('funnel_stage', stage.stage_name, stage.id);
      if (daily > 0) {
        const weeklyValue = calculateWeekly(daily);
        const existingTarget = targets?.find(
          t => t.target_type === 'funnel_stage' && t.reference_id === stage.id
        );

        if (existingTarget) {
          promises.push(
            updateTarget.mutateAsync({
              id: existingTarget.id,
              updates: { target_value: weeklyValue },
            })
          );
        } else {
          promises.push(
            createTarget.mutateAsync({
              target_type: 'funnel_stage',
              target_name: stage.stage_name,
              reference_id: stage.id,
              week_start: selectedWeekStart.toISOString().split('T')[0],
              week_end: weekEnd.toISOString().split('T')[0],
              target_value: weeklyValue,
              current_value: 0,
              origin_id: PIPELINE_INSIDE_SALES_ID,
            })
          );
        }
      }
    });

    // Salvar metas de vendas
    const salesTargets = [
      { type: 'team_revenue', name: 'Faturamento Semanal' },
      { type: 'team_sales', name: 'Vendas Semanais' },
      { type: 'ultrameta', name: 'Ultrameta Semanal' },
    ];

    salesTargets.forEach(({ type, name }) => {
      const daily = getDailyTarget(type, name, null);
      if (daily > 0) {
        const weeklyValue = calculateWeekly(daily);
        const existingTarget = targets?.find(
          t => t.target_type === type && t.target_name === name
        );

        if (existingTarget) {
          promises.push(
            updateTarget.mutateAsync({
              id: existingTarget.id,
              updates: { target_value: weeklyValue },
            })
          );
        } else {
          promises.push(
            createTarget.mutateAsync({
              target_type: type as any,
              target_name: name,
              reference_id: null,
              week_start: selectedWeekStart.toISOString().split('T')[0],
              week_end: weekEnd.toISOString().split('T')[0],
              target_value: weeklyValue,
              current_value: 0,
              origin_id: null,
            })
          );
        }
      }
    });

    try {
      await Promise.all(promises);
      toast.success('Todas as metas foram salvas com sucesso');
      setDailyTargets({});
    } catch (error) {
      toast.error('Erro ao salvar algumas metas');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Target className="mr-2 h-4 w-4" />
          Configurar Metas
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Configurar Metas da Semana</DialogTitle>
          <div className="flex items-center gap-4 mt-2">
            <span className="text-sm text-muted-foreground">
              {format(selectedWeekStart, "dd/MM", { locale: ptBR })} até {format(weekEnd, "dd/MM/yyyy", { locale: ptBR })}
            </span>
            <div className="flex items-center gap-2 flex-1">
              <Label htmlFor="copy-week" className="text-sm whitespace-nowrap">Copiar de:</Label>
              <Select value={copyFromWeek} onValueChange={setCopyFromWeek}>
                <SelectTrigger id="copy-week" className="w-[200px]">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {availableWeeks.map((week) => (
                    <SelectItem key={week.value} value={week.value}>
                      {week.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyFromSelectedWeek}
                disabled={copyTargets.isPending || !copyFromWeek}
              >
                <Copy className="h-4 w-4 mr-2" />
                {copyTargets.isPending ? "Copiando..." : "Copiar"}
              </Button>
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="funnel" className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="funnel">Funil</TabsTrigger>
            <TabsTrigger value="vendas">Vendas</TabsTrigger>
            <TabsTrigger value="time">Time</TabsTrigger>
          </TabsList>

          <div className="flex-1 mt-4 overflow-y-auto max-h-[400px] pr-2">
            <TabsContent value="funnel" className="space-y-4 mt-0">
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Metas por Etapa do Funil</h3>
                <p className="text-xs text-muted-foreground">
                  Define a meta diária e veja o cálculo automático semanal e mensal
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                {stages?.map(stage => {
                  const daily = getDailyTarget('funnel_stage', stage.stage_name, stage.id);
                  const existingTarget = targets?.find(
                    t => t.target_type === 'funnel_stage' && t.reference_id === stage.id
                  );
                  const currentValue = existingTarget?.current_value || 0;
                  const targetValue = existingTarget?.target_value || calculateWeekly(daily);
                  const progress = targetValue > 0 ? Math.min((currentValue / targetValue) * 100, 100) : 0;
                  
                  return (
                    <div key={stage.id} className="p-4 border rounded-lg space-y-3 bg-card">
                      <Label className="text-sm font-medium">{stage.stage_name}</Label>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Label className="text-xs text-muted-foreground w-20">Meta/Dia:</Label>
                          <Input
                            type="number"
                            className="h-8 text-sm"
                            placeholder="0"
                            value={daily || ''}
                            onChange={(e) => setDailyTarget('funnel_stage', stage.stage_name, stage.id, Number(e.target.value))}
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <Label className="text-xs text-muted-foreground w-20">Semana:</Label>
                          <div className="flex-1 h-8 px-3 flex items-center text-sm bg-muted/50 rounded-md">
                            {calculateWeekly(daily)}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Label className="text-xs text-muted-foreground w-20">Mês:</Label>
                          <div className="flex-1 h-8 px-3 flex items-center text-sm bg-muted/50 rounded-md">
                            {calculateMonthly(daily)}
                          </div>
                        </div>
                      </div>
                      
                      {existingTarget && (
                        <div className="space-y-1.5 pt-2 border-t">
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-muted-foreground">
                              Atual: {currentValue} / {targetValue}
                            </span>
                            <span className="font-medium">{Math.round(progress)}%</span>
                          </div>
                          <Progress value={progress} className="h-2" />
                        </div>
                      )}
                    </div>
                  );
                })}
                </div>
              </TabsContent>

              <TabsContent value="vendas" className="space-y-4 mt-0">
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Metas de Faturamento e Vendas</h3>
                <p className="text-xs text-muted-foreground">
                  Configure metas de faturamento, vendas e ultrameta
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Faturamento */}
                <div className="p-4 border rounded-lg space-y-3 bg-card">
                  <Label className="text-sm font-medium">Faturamento</Label>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground w-20">Meta/Dia:</Label>
                      <Input
                        type="number"
                        className="h-8 text-sm"
                        placeholder="0"
                        value={getDailyTarget('team_revenue', 'Faturamento Semanal', null) || ''}
                        onChange={(e) => setDailyTarget('team_revenue', 'Faturamento Semanal', null, Number(e.target.value))}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground w-20">Semana:</Label>
                      <div className="flex-1 h-8 px-3 flex items-center text-sm bg-muted/50 rounded-md">
                        R$ {calculateWeekly(getDailyTarget('team_revenue', 'Faturamento Semanal', null)).toLocaleString('pt-BR')}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground w-20">Mês:</Label>
                      <div className="flex-1 h-8 px-3 flex items-center text-sm bg-muted/50 rounded-md">
                        R$ {calculateMonthly(getDailyTarget('team_revenue', 'Faturamento Semanal', null)).toLocaleString('pt-BR')}
                      </div>
                    </div>
                  </div>
                  
                  {(() => {
                    const target = targets?.find(t => t.target_type === 'team_revenue');
                    const currentValue = target?.current_value || 0;
                    const targetValue = target?.target_value || calculateWeekly(getDailyTarget('team_revenue', 'Faturamento Semanal', null));
                    const progress = targetValue > 0 ? Math.min((currentValue / targetValue) * 100, 100) : 0;
                    return target ? (
                      <div className="space-y-1.5 pt-2 border-t">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-muted-foreground">
                            Atual: R$ {currentValue.toLocaleString('pt-BR')} / R$ {targetValue.toLocaleString('pt-BR')}
                          </span>
                          <span className="font-medium">{Math.round(progress)}%</span>
                        </div>
                        <Progress value={progress} className="h-2" />
                      </div>
                    ) : null;
                  })()}
                </div>

                {/* Vendas */}
                <div className="p-4 border rounded-lg space-y-3 bg-card">
                  <Label className="text-sm font-medium">Vendas</Label>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground w-20">Meta/Dia:</Label>
                      <Input
                        type="number"
                        className="h-8 text-sm"
                        placeholder="0"
                        value={getDailyTarget('team_sales', 'Vendas Semanais', null) || ''}
                        onChange={(e) => setDailyTarget('team_sales', 'Vendas Semanais', null, Number(e.target.value))}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground w-20">Semana:</Label>
                      <div className="flex-1 h-8 px-3 flex items-center text-sm bg-muted/50 rounded-md">
                        {calculateWeekly(getDailyTarget('team_sales', 'Vendas Semanais', null))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground w-20">Mês:</Label>
                      <div className="flex-1 h-8 px-3 flex items-center text-sm bg-muted/50 rounded-md">
                        {calculateMonthly(getDailyTarget('team_sales', 'Vendas Semanais', null))}
                      </div>
                    </div>
                  </div>
                  
                  {(() => {
                    const target = targets?.find(t => t.target_type === 'team_sales');
                    const currentValue = target?.current_value || 0;
                    const targetValue = target?.target_value || calculateWeekly(getDailyTarget('team_sales', 'Vendas Semanais', null));
                    const progress = targetValue > 0 ? Math.min((currentValue / targetValue) * 100, 100) : 0;
                    return target ? (
                      <div className="space-y-1.5 pt-2 border-t">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-muted-foreground">
                            Atual: {currentValue} / {targetValue}
                          </span>
                          <span className="font-medium">{Math.round(progress)}%</span>
                        </div>
                        <Progress value={progress} className="h-2" />
                      </div>
                    ) : null;
                  })()}
                </div>

                {/* Ultrameta */}
                <div className="p-4 border rounded-lg space-y-3 bg-card col-span-2">
                  <Label className="text-sm font-medium">Ultrameta</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Label className="text-xs text-muted-foreground w-20">Meta/Dia:</Label>
                        <Input
                          type="number"
                          className="h-8 text-sm"
                          placeholder="0"
                          value={getDailyTarget('ultrameta', 'Ultrameta Semanal', null) || ''}
                          onChange={(e) => setDailyTarget('ultrameta', 'Ultrameta Semanal', null, Number(e.target.value))}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Label className="text-xs text-muted-foreground w-20">Semana:</Label>
                        <div className="flex-1 h-8 px-3 flex items-center text-sm bg-muted/50 rounded-md">
                          R$ {calculateWeekly(getDailyTarget('ultrameta', 'Ultrameta Semanal', null)).toLocaleString('pt-BR')}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {(() => {
                    const target = targets?.find(t => t.target_type === 'ultrameta');
                    const currentValue = target?.current_value || 0;
                    const targetValue = target?.target_value || calculateWeekly(getDailyTarget('ultrameta', 'Ultrameta Semanal', null));
                    const progress = targetValue > 0 ? Math.min((currentValue / targetValue) * 100, 100) : 0;
                    return target ? (
                      <div className="space-y-1.5 pt-2 border-t">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-muted-foreground">
                            Atual: R$ {currentValue.toLocaleString('pt-BR')} / R$ {targetValue.toLocaleString('pt-BR')}
                          </span>
                          <span className="font-medium">{Math.round(progress)}%</span>
                        </div>
                        <Progress value={progress} className="h-2" />
                      </div>
                    ) : null;
                  })()}
                </div>
                </div>
              </TabsContent>

              <TabsContent value="time" className="space-y-4 mt-0">
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Metas do Time</h3>
                <p className="text-xs text-muted-foreground">
                  Metas individuais de Closers e SDRs
                </p>
              </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium">Closers</h4>
                    <p className="text-xs text-muted-foreground">Configure metas individuais para cada closer</p>
                  </div>
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium">SDRs</h4>
                    <p className="text-xs text-muted-foreground">Configure metas individuais para cada SDR</p>
                  </div>
                </div>
              </TabsContent>
          </div>
        </Tabs>

        <div className="flex justify-between items-center pt-4 border-t">
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Fechar
          </Button>
          <Button onClick={handleSaveAll} disabled={createTarget.isPending || updateTarget.isPending}>
            <Save className="h-4 w-4 mr-2" />
            Salvar Todas as Metas
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
