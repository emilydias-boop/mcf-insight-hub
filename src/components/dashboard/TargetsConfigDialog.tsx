import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Target, Copy, Save, Users, UserCheck } from "lucide-react";
import { useTeamTargets, useCreateTeamTarget, useUpdateTeamTarget, useCopyTargetsFromPreviousWeek } from "@/hooks/useTeamTargets";
import { useCRMStages } from "@/hooks/useCRMData";
import { useClosers } from "@/hooks/useCloserScheduling";
import { useSdrsAll } from "@/hooks/useSdrFechamento";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { getCustomWeekStart, getCustomWeekEnd, formatDateForDB, addCustomWeeks } from "@/lib/dateHelpers";

const PIPELINE_INSIDE_SALES_ID = "e3c04f21-ba2c-4c66-84f8-b4341c826b1c";

type TargetKey = string;

export function TargetsConfigDialog() {
  const [open, setOpen] = useState(false);
  const [selectedWeekStart, setSelectedWeekStart] = useState(
    getCustomWeekStart(new Date())
  );
  const [copyFromWeek, setCopyFromWeek] = useState<string>("");
  
  const weekEnd = getCustomWeekEnd(selectedWeekStart);
  
  const { data: stages } = useCRMStages(PIPELINE_INSIDE_SALES_ID);
  const { data: targets, isLoading } = useTeamTargets(selectedWeekStart, weekEnd);
  const { data: closers } = useClosers();
  const { data: sdrs } = useSdrsAll();
  const createTarget = useCreateTeamTarget();
  const updateTarget = useUpdateTeamTarget();
  const copyTargets = useCopyTargetsFromPreviousWeek();

  // State para metas semanais (usuário edita)
  const [weeklyTargets, setWeeklyTargets] = useState<Record<TargetKey, number>>({});

  // Filtrar SDRs ativos
  const activeSdrs = useMemo(() => sdrs?.filter(s => s.active) || [], [sdrs]);

  // Gerar últimas 8 semanas disponíveis para copiar
  const availableWeeks = useMemo(() => {
    return Array.from({ length: 8 }, (_, i) => {
      const weekStart = addCustomWeeks(selectedWeekStart, -(i + 1));
      const weekEndDate = getCustomWeekEnd(weekStart);
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

  // NOVA LÓGICA: Entrada semanal, cálculo diário e mensal
  const calculateDaily = (weekly: number) => Math.round(weekly / 7);
  const calculateMonthly = (weekly: number) => Math.round(weekly * 4.33);

  // Obter meta semanal (do state ou dos targets existentes)
  const getWeeklyTarget = (type: string, name: string, referenceId: string | null): number => {
    const key = `${type}-${referenceId || name}`;
    
    if (weeklyTargets[key] !== undefined) {
      return weeklyTargets[key];
    }
    
    const existing = targets?.find(
      t => t.target_type === type && t.reference_id === referenceId && t.target_name === name
    );
    
    return existing?.target_value || 0;
  };

  const setWeeklyTarget = (type: string, name: string, referenceId: string | null, value: number) => {
    const key = `${type}-${referenceId || name}`;
    setWeeklyTargets(prev => ({ ...prev, [key]: value }));
  };

  // Salvar todas as metas de uma vez
  const handleSaveAll = async () => {
    const promises: Promise<any>[] = [];

    // Salvar metas do funil (agora entrada semanal direta)
    stages?.forEach(stage => {
      const weeklyValue = getWeeklyTarget('funnel_stage', stage.stage_name, stage.id);
      if (weeklyValue > 0) {
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
              week_start: formatDateForDB(selectedWeekStart),
              week_end: formatDateForDB(weekEnd),
              target_value: weeklyValue,
              current_value: 0,
              origin_id: PIPELINE_INSIDE_SALES_ID,
            })
          );
        }
      }
    });

    // Salvar metas de vendas (entrada semanal direta)
    const salesTargets = [
      { type: 'team_revenue', name: 'Faturamento Semanal' },
      { type: 'team_sales', name: 'Vendas Semanais' },
      { type: 'ultrameta', name: 'Ultrameta Semanal' },
    ];

    salesTargets.forEach(({ type, name }) => {
      const weeklyValue = getWeeklyTarget(type, name, null);
      if (weeklyValue > 0) {
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
              week_start: formatDateForDB(selectedWeekStart),
              week_end: formatDateForDB(weekEnd),
              target_value: weeklyValue,
              current_value: 0,
              origin_id: null,
            })
          );
        }
      }
    });

    // Salvar metas Clint (valores semanais diretos)
    const clintTargets = [
      { type: 'ultrameta_clint', name: 'Ultrameta Clint' },
      { type: 'faturamento_clint', name: 'Faturamento Clint (Bruto)' },
      { type: 'ultrameta_liquido', name: 'Ultrameta Líquido' },
      { type: 'faturamento_liquido', name: 'Faturamento Líquido' },
    ];

    clintTargets.forEach(({ type, name }) => {
      const key = `${type}-${name}`;
      const weeklyValue = weeklyTargets[key];
      
      if (weeklyValue !== undefined && weeklyValue > 0) {
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
              week_start: formatDateForDB(selectedWeekStart),
              week_end: formatDateForDB(weekEnd),
              target_value: weeklyValue,
              current_value: 0,
              origin_id: null,
            })
          );
        }
      }
    });

    // Salvar metas individuais de SDRs
    activeSdrs.forEach(sdr => {
      const weeklyValue = getWeeklyTarget('sdr', `Meta R1 - ${sdr.name}`, sdr.id);
      if (weeklyValue > 0) {
        const existingTarget = targets?.find(
          t => t.target_type === 'sdr' && t.reference_id === sdr.id
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
              target_type: 'sdr',
              target_name: `Meta R1 - ${sdr.name}`,
              reference_id: sdr.id,
              week_start: formatDateForDB(selectedWeekStart),
              week_end: formatDateForDB(weekEnd),
              target_value: weeklyValue,
              current_value: 0,
              origin_id: null,
            })
          );
        }
      }
    });

    // Salvar metas individuais de Closers
    closers?.forEach(closer => {
      // Meta de R1 Realizadas
      const r1Value = getWeeklyTarget('closer', `R1 Realizadas - ${closer.name}`, closer.id);
      if (r1Value > 0) {
        const existingTarget = targets?.find(
          t => t.target_type === 'closer' && t.reference_id === closer.id && t.target_name.includes('R1 Realizadas')
        );

        if (existingTarget) {
          promises.push(
            updateTarget.mutateAsync({
              id: existingTarget.id,
              updates: { target_value: r1Value },
            })
          );
        } else {
          promises.push(
            createTarget.mutateAsync({
              target_type: 'closer',
              target_name: `R1 Realizadas - ${closer.name}`,
              reference_id: closer.id,
              week_start: formatDateForDB(selectedWeekStart),
              week_end: formatDateForDB(weekEnd),
              target_value: r1Value,
              current_value: 0,
              origin_id: null,
            })
          );
        }
      }

      // Meta de Contratos
      const contractsKey = `closer_contracts-${closer.id}`;
      const contractsValue = weeklyTargets[contractsKey];
      if (contractsValue !== undefined && contractsValue > 0) {
        const existingTarget = targets?.find(
          t => t.target_type === 'closer' && t.reference_id === closer.id && t.target_name.includes('Contratos')
        );

        if (existingTarget) {
          promises.push(
            updateTarget.mutateAsync({
              id: existingTarget.id,
              updates: { target_value: contractsValue },
            })
          );
        } else {
          promises.push(
            createTarget.mutateAsync({
              target_type: 'closer',
              target_name: `Contratos - ${closer.name}`,
              reference_id: closer.id,
              week_start: formatDateForDB(selectedWeekStart),
              week_end: formatDateForDB(weekEnd),
              target_value: contractsValue,
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
      setWeeklyTargets({});
    } catch (error) {
      toast.error('Erro ao salvar algumas metas');
    }
  };

  // Helpers para metas de closers (contratos separado)
  const getCloserContractsTarget = (closerId: string, closerName: string): number => {
    const key = `closer_contracts-${closerId}`;
    if (weeklyTargets[key] !== undefined) {
      return weeklyTargets[key];
    }
    const existing = targets?.find(
      t => t.target_type === 'closer' && t.reference_id === closerId && t.target_name.includes('Contratos')
    );
    return existing?.target_value || 0;
  };

  const setCloserContractsTarget = (closerId: string, value: number) => {
    const key = `closer_contracts-${closerId}`;
    setWeeklyTargets(prev => ({ ...prev, [key]: value }));
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
            {/* ABA FUNIL */}
            <TabsContent value="funnel" className="space-y-4 mt-0">
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Metas por Etapa do Funil</h3>
                <p className="text-xs text-muted-foreground">
                  Define a meta semanal e veja o cálculo automático diário e mensal
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                {stages?.map(stage => {
                  const weekly = getWeeklyTarget('funnel_stage', stage.stage_name, stage.id);
                  const existingTarget = targets?.find(
                    t => t.target_type === 'funnel_stage' && t.reference_id === stage.id
                  );
                  const currentValue = existingTarget?.current_value || 0;
                  const targetValue = existingTarget?.target_value || weekly;
                  const progress = targetValue > 0 ? Math.min((currentValue / targetValue) * 100, 100) : 0;
                  
                  return (
                    <div key={stage.id} className="p-4 border rounded-lg space-y-3 bg-card">
                      <Label className="text-sm font-medium">{stage.stage_name}</Label>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Label className="text-xs text-muted-foreground w-20">Meta/Sem:</Label>
                          <Input
                            type="number"
                            className="h-8 text-sm"
                            placeholder="0"
                            value={weekly || ''}
                            onChange={(e) => setWeeklyTarget('funnel_stage', stage.stage_name, stage.id, Number(e.target.value))}
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <Label className="text-xs text-muted-foreground w-20">Por Dia:</Label>
                          <div className="flex-1 h-8 px-3 flex items-center text-sm bg-muted/50 rounded-md">
                            {calculateDaily(weekly)}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Label className="text-xs text-muted-foreground w-20">Mês:</Label>
                          <div className="flex-1 h-8 px-3 flex items-center text-sm bg-muted/50 rounded-md">
                            {calculateMonthly(weekly)}
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

            {/* ABA VENDAS */}
            <TabsContent value="vendas" className="space-y-4 mt-0">
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Metas de Faturamento e Vendas</h3>
                <p className="text-xs text-muted-foreground">
                  Configure metas semanais de faturamento, vendas e ultrameta
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Faturamento */}
                <div className="p-4 border rounded-lg space-y-3 bg-card">
                  <Label className="text-sm font-medium">Faturamento</Label>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground w-20">Meta/Sem:</Label>
                      <Input
                        type="number"
                        className="h-8 text-sm"
                        placeholder="0"
                        value={getWeeklyTarget('team_revenue', 'Faturamento Semanal', null) || ''}
                        onChange={(e) => setWeeklyTarget('team_revenue', 'Faturamento Semanal', null, Number(e.target.value))}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground w-20">Por Dia:</Label>
                      <div className="flex-1 h-8 px-3 flex items-center text-sm bg-muted/50 rounded-md">
                        R$ {calculateDaily(getWeeklyTarget('team_revenue', 'Faturamento Semanal', null)).toLocaleString('pt-BR')}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground w-20">Mês:</Label>
                      <div className="flex-1 h-8 px-3 flex items-center text-sm bg-muted/50 rounded-md">
                        R$ {calculateMonthly(getWeeklyTarget('team_revenue', 'Faturamento Semanal', null)).toLocaleString('pt-BR')}
                      </div>
                    </div>
                  </div>
                  
                  {(() => {
                    const target = targets?.find(t => t.target_type === 'team_revenue');
                    const currentValue = target?.current_value || 0;
                    const targetValue = target?.target_value || getWeeklyTarget('team_revenue', 'Faturamento Semanal', null);
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
                      <Label className="text-xs text-muted-foreground w-20">Meta/Sem:</Label>
                      <Input
                        type="number"
                        className="h-8 text-sm"
                        placeholder="0"
                        value={getWeeklyTarget('team_sales', 'Vendas Semanais', null) || ''}
                        onChange={(e) => setWeeklyTarget('team_sales', 'Vendas Semanais', null, Number(e.target.value))}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground w-20">Por Dia:</Label>
                      <div className="flex-1 h-8 px-3 flex items-center text-sm bg-muted/50 rounded-md">
                        {calculateDaily(getWeeklyTarget('team_sales', 'Vendas Semanais', null))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground w-20">Mês:</Label>
                      <div className="flex-1 h-8 px-3 flex items-center text-sm bg-muted/50 rounded-md">
                        {calculateMonthly(getWeeklyTarget('team_sales', 'Vendas Semanais', null))}
                      </div>
                    </div>
                  </div>
                  
                  {(() => {
                    const target = targets?.find(t => t.target_type === 'team_sales');
                    const currentValue = target?.current_value || 0;
                    const targetValue = target?.target_value || getWeeklyTarget('team_sales', 'Vendas Semanais', null);
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
                        <Label className="text-xs text-muted-foreground w-20">Meta/Sem:</Label>
                        <Input
                          type="number"
                          className="h-8 text-sm"
                          placeholder="0"
                          value={getWeeklyTarget('ultrameta', 'Ultrameta Semanal', null) || ''}
                          onChange={(e) => setWeeklyTarget('ultrameta', 'Ultrameta Semanal', null, Number(e.target.value))}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Label className="text-xs text-muted-foreground w-20">Por Dia:</Label>
                        <div className="flex-1 h-8 px-3 flex items-center text-sm bg-muted/50 rounded-md">
                          R$ {calculateDaily(getWeeklyTarget('ultrameta', 'Ultrameta Semanal', null)).toLocaleString('pt-BR')}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {(() => {
                    const target = targets?.find(t => t.target_type === 'ultrameta');
                    const currentValue = target?.current_value || 0;
                    const targetValue = target?.target_value || getWeeklyTarget('ultrameta', 'Ultrameta Semanal', null);
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

                {/* Metas Clint - Valores semanais diretos */}
                <div className="col-span-2 border-t pt-4 mt-2">
                  <h4 className="text-sm font-medium mb-3">Metas do MetasProgress (valores semanais)</h4>
                  <p className="text-xs text-muted-foreground mb-4">
                    Configure os valores absolutos das metas semanais exibidas no painel de metas
                  </p>
                </div>

                {/* Ultrameta Clint */}
                <div className="p-4 border rounded-lg space-y-3 bg-card">
                  <Label className="text-sm font-medium">Ultrameta Clint</Label>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground w-20">Meta:</Label>
                      <Input
                        type="number"
                        className="h-8 text-sm"
                        placeholder="337680"
                        value={weeklyTargets['ultrameta_clint-Ultrameta Clint'] ?? (targets?.find(t => t.target_type === 'ultrameta_clint')?.target_value || '')}
                        onChange={(e) => setWeeklyTargets(prev => ({ ...prev, 'ultrameta_clint-Ultrameta Clint': Number(e.target.value) }))}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">Fórmula: (A010 × R$1.680) + (SDR IA × R$700)</p>
                  </div>
                </div>

                {/* Faturamento Clint (Bruto) */}
                <div className="p-4 border rounded-lg space-y-3 bg-card">
                  <Label className="text-sm font-medium">Faturamento Clint (Bruto)</Label>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground w-20">Meta:</Label>
                      <Input
                        type="number"
                        className="h-8 text-sm"
                        placeholder="198377"
                        value={weeklyTargets['faturamento_clint-Faturamento Clint (Bruto)'] ?? (targets?.find(t => t.target_type === 'faturamento_clint')?.target_value || '')}
                        onChange={(e) => setWeeklyTargets(prev => ({ ...prev, 'faturamento_clint-Faturamento Clint (Bruto)': Number(e.target.value) }))}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">Valor bruto das vendas Clint na semana</p>
                  </div>
                </div>

                {/* Ultrameta Líquido */}
                <div className="p-4 border rounded-lg space-y-3 bg-card">
                  <Label className="text-sm font-medium">Ultrameta Líquido</Label>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground w-20">Meta:</Label>
                      <Input
                        type="number"
                        className="h-8 text-sm"
                        placeholder="281400"
                        value={weeklyTargets['ultrameta_liquido-Ultrameta Líquido'] ?? (targets?.find(t => t.target_type === 'ultrameta_liquido')?.target_value || '')}
                        onChange={(e) => setWeeklyTargets(prev => ({ ...prev, 'ultrameta_liquido-Ultrameta Líquido': Number(e.target.value) }))}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">Fórmula: A010 × R$1.400</p>
                  </div>
                </div>

                {/* Faturamento Líquido */}
                <div className="p-4 border rounded-lg space-y-3 bg-card">
                  <Label className="text-sm font-medium">Faturamento Líquido</Label>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground w-20">Meta:</Label>
                      <Input
                        type="number"
                        className="h-8 text-sm"
                        placeholder="159276"
                        value={weeklyTargets['faturamento_liquido-Faturamento Líquido'] ?? (targets?.find(t => t.target_type === 'faturamento_liquido')?.target_value || '')}
                        onChange={(e) => setWeeklyTargets(prev => ({ ...prev, 'faturamento_liquido-Faturamento Líquido': Number(e.target.value) }))}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">Valor líquido recebido na semana</p>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* ABA TIME - SDRs e Closers */}
            <TabsContent value="time" className="space-y-6 mt-0">
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Metas Individuais do Time</h3>
                <p className="text-xs text-muted-foreground">
                  Configure metas semanais para cada SDR e Closer. Os valores são calculados automaticamente para dia e mês.
                </p>
              </div>

              {/* SDRs Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  <h4 className="text-sm font-medium">SDRs ({activeSdrs.length} ativos)</h4>
                </div>

                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left p-3 font-medium">Nome</th>
                        <th className="text-center p-3 font-medium w-32">Meta/Sem (R1)</th>
                        <th className="text-center p-3 font-medium w-24">Por Dia</th>
                        <th className="text-center p-3 font-medium w-24">Mês</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeSdrs.map(sdr => {
                        const weekly = getWeeklyTarget('sdr', `Meta R1 - ${sdr.name}`, sdr.id);
                        return (
                          <tr key={sdr.id} className="border-t">
                            <td className="p-3">{sdr.name}</td>
                            <td className="p-3">
                              <Input
                                type="number"
                                className="h-8 text-sm text-center"
                                placeholder="0"
                                value={weekly || ''}
                                onChange={(e) => setWeeklyTarget('sdr', `Meta R1 - ${sdr.name}`, sdr.id, Number(e.target.value))}
                              />
                            </td>
                            <td className="p-3 text-center text-muted-foreground">
                              {calculateDaily(weekly)}
                            </td>
                            <td className="p-3 text-center text-muted-foreground">
                              {calculateMonthly(weekly)}
                            </td>
                          </tr>
                        );
                      })}
                      {activeSdrs.length === 0 && (
                        <tr>
                          <td colSpan={4} className="p-4 text-center text-muted-foreground">
                            Nenhum SDR ativo encontrado
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Closers Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-primary" />
                  <h4 className="text-sm font-medium">Closers ({closers?.length || 0} ativos)</h4>
                </div>

                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left p-3 font-medium">Nome</th>
                        <th className="text-center p-3 font-medium w-28">R1 Realiz./Sem</th>
                        <th className="text-center p-3 font-medium w-28">Contratos/Sem</th>
                        <th className="text-center p-3 font-medium w-20">R1/Dia</th>
                        <th className="text-center p-3 font-medium w-24">R1/Mês</th>
                      </tr>
                    </thead>
                    <tbody>
                      {closers?.map(closer => {
                        const r1Weekly = getWeeklyTarget('closer', `R1 Realizadas - ${closer.name}`, closer.id);
                        const contractsWeekly = getCloserContractsTarget(closer.id, closer.name);
                        return (
                          <tr key={closer.id} className="border-t">
                            <td className="p-3">{closer.name}</td>
                            <td className="p-3">
                              <Input
                                type="number"
                                className="h-8 text-sm text-center"
                                placeholder="0"
                                value={r1Weekly || ''}
                                onChange={(e) => setWeeklyTarget('closer', `R1 Realizadas - ${closer.name}`, closer.id, Number(e.target.value))}
                              />
                            </td>
                            <td className="p-3">
                              <Input
                                type="number"
                                className="h-8 text-sm text-center"
                                placeholder="0"
                                value={contractsWeekly || ''}
                                onChange={(e) => setCloserContractsTarget(closer.id, Number(e.target.value))}
                              />
                            </td>
                            <td className="p-3 text-center text-muted-foreground">
                              {calculateDaily(r1Weekly)}
                            </td>
                            <td className="p-3 text-center text-muted-foreground">
                              {calculateMonthly(r1Weekly)}
                            </td>
                          </tr>
                        );
                      })}
                      {(!closers || closers.length === 0) && (
                        <tr>
                          <td colSpan={5} className="p-4 text-center text-muted-foreground">
                            Nenhum Closer ativo encontrado
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
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
