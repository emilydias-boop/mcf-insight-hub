import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, RefreshCcw, Info, ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { toast } from "sonner";
import { format, addMonths, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  SdrTargetType, 
  SDR_TARGET_CONFIGS, 
  SdrTarget, 
  useUpsertSdrTargets,
  useSdrTeamTargetsByMonth,
  useSdrTeamTargetsForYear 
} from "@/hooks/useSdrTeamTargets";
import { getDiasUteisMes, getDiasUteisSemana } from "@/lib/businessDays";

interface TeamGoalsEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingTargets: SdrTarget[];
}

// Mapeamento de tipo dia → semana
const dayToWeekMapping: Record<string, SdrTargetType> = {
  'sdr_agendamento_dia': 'sdr_agendamento_semana',
  'sdr_r1_agendada_dia': 'sdr_r1_agendada_semana',
  'sdr_r1_realizada_dia': 'sdr_r1_realizada_semana',
  'sdr_noshow_dia': 'sdr_noshow_semana',
  'sdr_contrato_dia': 'sdr_contrato_semana',
  'sdr_r2_agendada_dia': 'sdr_r2_agendada_semana',
  'sdr_r2_realizada_dia': 'sdr_r2_realizada_semana',
  'sdr_venda_realizada_dia': 'sdr_venda_realizada_semana',
};

// Mapeamento de tipo dia → mês
const dayToMonthMapping: Record<string, SdrTargetType> = {
  'sdr_agendamento_dia': 'sdr_agendamento_mes',
  'sdr_r1_agendada_dia': 'sdr_r1_agendada_mes',
  'sdr_r1_realizada_dia': 'sdr_r1_realizada_mes',
  'sdr_noshow_dia': 'sdr_noshow_mes',
  'sdr_contrato_dia': 'sdr_contrato_mes',
  'sdr_r2_agendada_dia': 'sdr_r2_agendada_mes',
  'sdr_r2_realizada_dia': 'sdr_r2_realizada_mes',
  'sdr_venda_realizada_dia': 'sdr_venda_realizada_mes',
};

// Proporções para cálculo em cascata das metas do dia
const DAY_TARGET_PROPORTIONS = {
  r1_agendada: 1.00,      // 100% do Agendamento
  r1_realizada: 0.70,     // 70% da R1 Agendada
  noshow: 0.30,           // 30% da R1 Agendada
  contrato: 0.35,         // 35% da R1 Realizada
  r2_agendada: 1.00,      // 100% do Contrato Pago
  r2_realizada: 0.75,     // 75% da R2 Agendada
  venda_realizada: 0.60,  // 60% da R2 Realizada
};

// Calcula todas as metas do dia em cascata a partir do Agendamento
const calculateDayCascade = (agendamento: number): Record<string, number> => {
  const r1Agendada = Math.round(agendamento * DAY_TARGET_PROPORTIONS.r1_agendada);
  const r1Realizada = Math.round(r1Agendada * DAY_TARGET_PROPORTIONS.r1_realizada);
  const noShow = Math.round(r1Agendada * DAY_TARGET_PROPORTIONS.noshow);
  const contratoPago = Math.round(r1Realizada * DAY_TARGET_PROPORTIONS.contrato);
  const r2Agendada = Math.round(contratoPago * DAY_TARGET_PROPORTIONS.r2_agendada);
  const r2Realizada = Math.round(r2Agendada * DAY_TARGET_PROPORTIONS.r2_realizada);
  const vendaRealizada = Math.round(r2Realizada * DAY_TARGET_PROPORTIONS.venda_realizada);

  return {
    'sdr_agendamento_dia': agendamento,
    'sdr_r1_agendada_dia': r1Agendada,
    'sdr_r1_realizada_dia': r1Realizada,
    'sdr_noshow_dia': noShow,
    'sdr_contrato_dia': contratoPago,
    'sdr_r2_agendada_dia': r2Agendada,
    'sdr_r2_realizada_dia': r2Realizada,
    'sdr_venda_realizada_dia': vendaRealizada,
  };
};

export function TeamGoalsEditModal({ open, onOpenChange, existingTargets }: TeamGoalsEditModalProps) {
  const [values, setValues] = useState<Record<SdrTargetType, number>>({} as Record<SdrTargetType, number>);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const upsertMutation = useUpsertSdrTargets();
  
  const selectedYear = selectedMonth.getFullYear();

  // Fetch targets for selected month
  const { data: monthTargets, isLoading: isLoadingMonth } = useSdrTeamTargetsByMonth(selectedMonth);
  
  // Fetch all targets for the year (for annual sum)
  const { data: yearTargets } = useSdrTeamTargetsForYear(selectedYear);

  // Calculate business days for selected month
  const diasUteisSemana = getDiasUteisSemana(selectedMonth);
  const diasUteisMes = getDiasUteisMes(selectedMonth);

  // Calculate annual sum of agendamento_mes targets
  const annualAgendamentoTotal = useMemo(() => {
    if (!yearTargets) return 0;
    return yearTargets
      .filter(t => t.target_type === 'sdr_agendamento_mes')
      .reduce((sum, t) => sum + (t.target_value || 0), 0);
  }, [yearTargets]);

  // Calculate annual sum for each metric
  const annualTotals = useMemo(() => {
    if (!yearTargets) return {} as Record<string, number>;
    
    const totals: Record<string, number> = {};
    const monthTypes = SDR_TARGET_CONFIGS.filter(c => c.period === 'month');
    
    monthTypes.forEach(config => {
      totals[config.type] = yearTargets
        .filter(t => t.target_type === config.type)
        .reduce((sum, t) => sum + (t.target_value || 0), 0);
    });
    
    return totals;
  }, [yearTargets]);

  // Month navigation
  const goToPreviousMonth = () => setSelectedMonth(prev => subMonths(prev, 1));
  const goToNextMonth = () => setSelectedMonth(prev => addMonths(prev, 1));

  // Initialize values from month targets
  useEffect(() => {
    if (!open) return;
    
    const targetsToUse = monthTargets || existingTargets;
    const initial: Record<string, number> = {};
    
    SDR_TARGET_CONFIGS.forEach(config => {
      const existing = targetsToUse.find(t => t.target_type === config.type);
      initial[config.type] = existing?.target_value ?? 0;
    });
    
    // Se tem valor de agendamento do dia mas outros estão zerados, aplica cascata
    const agendamentoDia = initial['sdr_agendamento_dia'] || 0;
    if (agendamentoDia > 0) {
      const dayValues = calculateDayCascade(agendamentoDia);
      
      // Aplica valores em cascata para campos zerados do dia
      Object.entries(dayValues).forEach(([key, val]) => {
        if (!initial[key] || initial[key] === 0) {
          initial[key] = val;
        }
      });
      
      // Auto-recalcular semana e mês se estiverem zerados
      Object.keys(dayValues).forEach(dayType => {
        const dayValue = initial[dayType] || 0;
        const weekType = dayToWeekMapping[dayType];
        const monthType = dayToMonthMapping[dayType];
        
        if (weekType && (!initial[weekType] || initial[weekType] === 0)) {
          initial[weekType] = dayValue * diasUteisSemana;
        }
        if (monthType && (!initial[monthType] || initial[monthType] === 0)) {
          initial[monthType] = dayValue * diasUteisMes;
        }
      });
    }
    
    setValues(initial as Record<SdrTargetType, number>);
  }, [monthTargets, existingTargets, open, diasUteisSemana, diasUteisMes]);

  // Handler para campos de semana e mês (edição manual)
  const handleChange = (type: SdrTargetType, value: string) => {
    const numValue = parseInt(value) || 0;
    setValues(prev => ({ ...prev, [type]: Math.max(0, numValue) }));
  };

  // Handler para campos de dia (auto-calcula semana e mês, e cascata se for agendamento)
  const handleDayChange = (type: SdrTargetType, value: string) => {
    const numValue = parseInt(value) || 0;
    let newValues = { ...values };
    
    // Se é o Agendamento, calcula todos os outros em cascata
    if (type === 'sdr_agendamento_dia') {
      const dayValues = calculateDayCascade(numValue);
      
      // Atualiza todos os valores do dia
      Object.entries(dayValues).forEach(([key, val]) => {
        newValues[key as SdrTargetType] = val;
      });
      
      // Calcula semana e mês para TODOS os tipos do dia
      Object.keys(dayValues).forEach(dayType => {
        const dayVal = dayValues[dayType];
        const weekType = dayToWeekMapping[dayType];
        const monthType = dayToMonthMapping[dayType];
        
        if (weekType) {
          newValues[weekType] = dayVal * diasUteisSemana;
        }
        if (monthType) {
          newValues[monthType] = dayVal * diasUteisMes;
        }
      });
    } else {
      // Para outros campos do dia, permite edição manual
      newValues[type] = Math.max(0, numValue);
      
      // Recalcula apenas semana e mês desse campo específico
      const weekType = dayToWeekMapping[type];
      const monthType = dayToMonthMapping[type];
      
      if (weekType) {
        newValues[weekType] = numValue * diasUteisSemana;
      }
      if (monthType) {
        newValues[monthType] = numValue * diasUteisMes;
      }
    }
    
    setValues(newValues);
  };

  // Função para recalcular todas as metas baseado no agendamento
  const handleRecalculate = () => {
    const agendamento = values['sdr_agendamento_dia'] || 0;
    const dayValues = calculateDayCascade(agendamento);
    
    const newValues = { ...values };
    
    // Aplica valores do dia em cascata
    Object.entries(dayValues).forEach(([key, val]) => {
      newValues[key as SdrTargetType] = val;
    });
    
    // Recalcula semana e mês para todos
    Object.keys(dayValues).forEach(dayType => {
      const dayVal = dayValues[dayType];
      const weekType = dayToWeekMapping[dayType];
      const monthType = dayToMonthMapping[dayType];
      
      if (weekType) {
        newValues[weekType] = dayVal * diasUteisSemana;
      }
      if (monthType) {
        newValues[monthType] = dayVal * diasUteisMes;
      }
    });
    
    setValues(newValues);
    toast.success(`Metas recalculadas com base no agendamento: ${agendamento}`);
  };

  const handleSave = async () => {
    await upsertMutation.mutateAsync({ 
      targets: values,
      targetMonth: selectedMonth
    });
    onOpenChange(false);
  };

  const dayConfigs = SDR_TARGET_CONFIGS.filter(c => c.period === 'day');
  const weekConfigs = SDR_TARGET_CONFIGS.filter(c => c.period === 'week');
  const monthConfigs = SDR_TARGET_CONFIGS.filter(c => c.period === 'month');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Editar Metas da Equipe</DialogTitle>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRecalculate}
              className="mr-6"
            >
              <RefreshCcw className="h-4 w-4 mr-2" />
              Recalcular
            </Button>
          </div>
        </DialogHeader>

        {/* Navegador de mês */}
        <div className="flex items-center justify-center gap-4 py-3 bg-muted/30 rounded-lg">
          <Button variant="ghost" size="icon" onClick={goToPreviousMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-lg font-medium min-w-[180px] text-center capitalize">
            {format(selectedMonth, "MMMM yyyy", { locale: ptBR })}
          </span>
          <Button variant="ghost" size="icon" onClick={goToNextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Info de dias úteis */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 px-3 py-2 rounded-md">
          <Info className="h-4 w-4" />
          <span>Semana: <strong>{diasUteisSemana}</strong> dias úteis | Mês: <strong>{diasUteisMes}</strong> dias úteis</span>
        </div>

        {isLoadingMonth ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-6 py-4">
            {/* Day targets */}
            <div className="space-y-4">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                Metas do Dia
              </h3>
              <p className="text-xs text-muted-foreground -mt-2">Entrada manual</p>
              {dayConfigs.map(config => (
                <div key={config.type} className="space-y-1">
                  <Label htmlFor={config.type} className="text-sm">
                    {config.label}
                  </Label>
                  <Input
                    id={config.type}
                    type="number"
                    min={0}
                    value={values[config.type] ?? 0}
                    onChange={(e) => handleDayChange(config.type, e.target.value)}
                    className="h-9"
                  />
                </div>
              ))}
            </div>

            {/* Week targets */}
            <div className="space-y-4">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                Metas da Semana
              </h3>
              <p className="text-xs text-muted-foreground -mt-2">Dia × {diasUteisSemana} dias</p>
              {weekConfigs.map(config => (
                <div key={config.type} className="space-y-1">
                  <Label htmlFor={config.type} className="text-sm">
                    {config.label}
                  </Label>
                  <Input
                    id={config.type}
                    type="number"
                    min={0}
                    value={values[config.type] ?? 0}
                    onChange={(e) => handleChange(config.type, e.target.value)}
                    className="h-9"
                  />
                </div>
              ))}
            </div>

            {/* Month targets */}
            <div className="space-y-4">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                Metas do Mês
              </h3>
              <p className="text-xs text-muted-foreground -mt-2">Dia × {diasUteisMes} dias</p>
              {monthConfigs.map(config => (
                <div key={config.type} className="space-y-1">
                  <Label htmlFor={config.type} className="text-sm">
                    {config.label}
                  </Label>
                  <Input
                    id={config.type}
                    type="number"
                    min={0}
                    value={values[config.type] ?? 0}
                    onChange={(e) => handleChange(config.type, e.target.value)}
                    className="h-9"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Card da Meta Anual */}
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                <span className="font-medium">Meta Anual {selectedYear}</span>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-primary">
                  {annualAgendamentoTotal.toLocaleString('pt-BR')}
                </p>
                <p className="text-xs text-muted-foreground">
                  agendamentos (soma de todos os meses)
                </p>
              </div>
            </div>
            
            {/* Detalhes anuais de outras métricas */}
            <div className="mt-3 pt-3 border-t border-primary/10 grid grid-cols-4 gap-2 text-xs">
              <div className="text-center">
                <p className="font-semibold text-foreground">{(annualTotals['sdr_r1_realizada_mes'] || 0).toLocaleString('pt-BR')}</p>
                <p className="text-muted-foreground">R1 Realizadas</p>
              </div>
              <div className="text-center">
                <p className="font-semibold text-foreground">{(annualTotals['sdr_contrato_mes'] || 0).toLocaleString('pt-BR')}</p>
                <p className="text-muted-foreground">Contratos</p>
              </div>
              <div className="text-center">
                <p className="font-semibold text-foreground">{(annualTotals['sdr_r2_realizada_mes'] || 0).toLocaleString('pt-BR')}</p>
                <p className="text-muted-foreground">R2 Realizadas</p>
              </div>
              <div className="text-center">
                <p className="font-semibold text-foreground">{(annualTotals['sdr_venda_realizada_mes'] || 0).toLocaleString('pt-BR')}</p>
                <p className="text-muted-foreground">Vendas</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={upsertMutation.isPending}>
            {upsertMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar Metas
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}