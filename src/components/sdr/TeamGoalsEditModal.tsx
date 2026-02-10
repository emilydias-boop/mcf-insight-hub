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
  CONSORCIO_SDR_TARGET_CONFIGS,
  getTargetConfigsForBU,
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
  buPrefix?: string; // e.g. 'consorcio_sdr_' or default 'sdr_'
}

// Mapeamento base de tipo dia → semana (para sdr_)
const BASE_DAY_SUFFIXES = [
  'agendamento', 'r1_agendada', 'r1_realizada', 'noshow',
  'contrato', 'r2_agendada', 'r2_realizada', 'venda_realizada',
  // Consórcio-specific suffixes
  'proposta_enviada', 'aguardando_doc', 'carta_fechada', 'aporte',
];

function buildDayToWeekMapping(prefix: string): Record<string, string> {
  const map: Record<string, string> = {};
  BASE_DAY_SUFFIXES.forEach(suffix => {
    map[`${prefix}${suffix}_dia`] = `${prefix}${suffix}_semana`;
  });
  return map;
}

function buildDayToMonthMapping(prefix: string): Record<string, string> {
  const map: Record<string, string> = {};
  BASE_DAY_SUFFIXES.forEach(suffix => {
    map[`${prefix}${suffix}_dia`] = `${prefix}${suffix}_mes`;
  });
  return map;
}

// Proporções para cálculo em cascata das metas do dia (Incorporador)
const DAY_TARGET_PROPORTIONS = {
  r1_agendada: 1.00,
  r1_realizada: 0.70,
  noshow: 0.30,
  contrato: 0.35,
  r2_agendada: 1.00,
  r2_realizada: 0.75,
  venda_realizada: 0.60,
};

// Proporções para cálculo em cascata (Consórcio)
const CONSORCIO_DAY_TARGET_PROPORTIONS = {
  r1_agendada: 1.00,
  r1_realizada: 0.70,
  noshow: 0.30,
  proposta_enviada: 0.50,
  contrato: 0.40,
  aguardando_doc: 0.50,
  carta_fechada: 0.40,
  aporte: 0.35,
  venda_realizada: 0.30,
};

// Calcula todas as metas do dia em cascata a partir do Agendamento
const calculateDayCascade = (agendamento: number, prefix: string = 'sdr_'): Record<string, number> => {
  if (prefix === 'consorcio_sdr_') {
    return calculateConsorcioDayCascade(agendamento, prefix);
  }
  const r1Agendada = Math.round(agendamento * DAY_TARGET_PROPORTIONS.r1_agendada);
  const r1Realizada = Math.round(r1Agendada * DAY_TARGET_PROPORTIONS.r1_realizada);
  const noShow = Math.round(r1Agendada * DAY_TARGET_PROPORTIONS.noshow);
  const contratoPago = Math.round(r1Realizada * DAY_TARGET_PROPORTIONS.contrato);
  const r2Agendada = Math.round(contratoPago * DAY_TARGET_PROPORTIONS.r2_agendada);
  const r2Realizada = Math.round(r2Agendada * DAY_TARGET_PROPORTIONS.r2_realizada);
  const vendaRealizada = Math.round(r2Realizada * DAY_TARGET_PROPORTIONS.venda_realizada);

  return {
    [`${prefix}agendamento_dia`]: agendamento,
    [`${prefix}r1_agendada_dia`]: r1Agendada,
    [`${prefix}r1_realizada_dia`]: r1Realizada,
    [`${prefix}noshow_dia`]: noShow,
    [`${prefix}contrato_dia`]: contratoPago,
    [`${prefix}r2_agendada_dia`]: r2Agendada,
    [`${prefix}r2_realizada_dia`]: r2Realizada,
    [`${prefix}venda_realizada_dia`]: vendaRealizada,
  };
};

const calculateConsorcioDayCascade = (agendamento: number, prefix: string): Record<string, number> => {
  const p = CONSORCIO_DAY_TARGET_PROPORTIONS;
  const r1Agendada = Math.round(agendamento * p.r1_agendada);
  const r1Realizada = Math.round(r1Agendada * p.r1_realizada);
  const noShow = Math.round(r1Agendada * p.noshow);
  const propostaEnviada = Math.round(r1Realizada * p.proposta_enviada);
  const contratoPago = Math.round(propostaEnviada * p.contrato);
  const aguardandoDoc = Math.round(r1Realizada * p.aguardando_doc);
  const cartaFechada = Math.round(aguardandoDoc * p.carta_fechada);
  const aporte = Math.round(cartaFechada * p.aporte);
  const vendaRealizada = Math.round(contratoPago * p.venda_realizada);

  return {
    [`${prefix}agendamento_dia`]: agendamento,
    [`${prefix}r1_agendada_dia`]: r1Agendada,
    [`${prefix}r1_realizada_dia`]: r1Realizada,
    [`${prefix}noshow_dia`]: noShow,
    [`${prefix}proposta_enviada_dia`]: propostaEnviada,
    [`${prefix}contrato_dia`]: contratoPago,
    [`${prefix}aguardando_doc_dia`]: aguardandoDoc,
    [`${prefix}carta_fechada_dia`]: cartaFechada,
    [`${prefix}aporte_dia`]: aporte,
    [`${prefix}venda_realizada_dia`]: vendaRealizada,
  };
};

export function TeamGoalsEditModal({ open, onOpenChange, existingTargets, buPrefix = 'sdr_' }: TeamGoalsEditModalProps) {
  const [values, setValues] = useState<Record<SdrTargetType, number>>({} as Record<SdrTargetType, number>);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const upsertMutation = useUpsertSdrTargets();
  
  const selectedYear = selectedMonth.getFullYear();

  // Build dynamic target configs based on buPrefix
  const dynamicConfigs = useMemo(() => {
    return getTargetConfigsForBU(buPrefix);
  }, [buPrefix]);

  // Build dynamic day-to-week and day-to-month mappings
  const dynamicDayToWeek = useMemo(() => {
    return buildDayToWeekMapping(buPrefix) as Record<string, SdrTargetType>;
  }, [buPrefix]);

  const dynamicDayToMonth = useMemo(() => {
    return buildDayToMonthMapping(buPrefix) as Record<string, SdrTargetType>;
  }, [buPrefix]);

  // Fetch targets for selected month
  const { data: monthTargets, isLoading: isLoadingMonth } = useSdrTeamTargetsByMonth(selectedMonth, buPrefix);
  
  // Fetch all targets for the year (for annual sum)
  const { data: yearTargets } = useSdrTeamTargetsForYear(selectedYear, buPrefix);

  // Calculate business days for selected month
  const diasUteisSemana = getDiasUteisSemana(selectedMonth);
  const diasUteisMes = getDiasUteisMes(selectedMonth);

  // Calculate annual sum of agendamento_mes targets
  const agendamentoMesType = `${buPrefix}agendamento_mes`;
  const annualAgendamentoTotal = useMemo(() => {
    if (!yearTargets) return 0;
    return yearTargets
      .filter(t => t.target_type === agendamentoMesType)
      .reduce((sum, t) => sum + (t.target_value || 0), 0);
  }, [yearTargets, agendamentoMesType]);

  // Calculate annual sum for each metric
  const annualTotals = useMemo(() => {
    if (!yearTargets) return {} as Record<string, number>;
    
    const totals: Record<string, number> = {};
    const monthTypes = dynamicConfigs.filter(c => c.period === 'month');
    
    monthTypes.forEach(config => {
      totals[config.type] = yearTargets
        .filter(t => t.target_type === config.type)
        .reduce((sum, t) => sum + (t.target_value || 0), 0);
    });
    
    return totals;
  }, [yearTargets, dynamicConfigs]);

  // Month navigation
  const goToPreviousMonth = () => setSelectedMonth(prev => subMonths(prev, 1));
  const goToNextMonth = () => setSelectedMonth(prev => addMonths(prev, 1));

  // Initialize values from month targets
  useEffect(() => {
    if (!open) return;
    
    const targetsToUse = monthTargets || existingTargets;
    const initial: Record<string, number> = {};
    
    dynamicConfigs.forEach(config => {
      const existing = targetsToUse.find(t => t.target_type === config.type);
      initial[config.type] = existing?.target_value ?? 0;
    });
    
    // Se tem valor de agendamento do dia mas outros estão zerados, aplica cascata
    const agendamentoDiaType = `${buPrefix}agendamento_dia`;
    const agendamentoDia = initial[agendamentoDiaType] || 0;
    if (agendamentoDia > 0) {
      const dayValues = calculateDayCascade(agendamentoDia, buPrefix);
      
      // Aplica valores em cascata para campos zerados do dia
      Object.entries(dayValues).forEach(([key, val]) => {
        if (!initial[key] || initial[key] === 0) {
          initial[key] = val;
        }
      });
      
      // Auto-recalcular semana e mês se estiverem zerados
      Object.keys(dayValues).forEach(dayType => {
        const dayValue = initial[dayType] || 0;
        const weekType = dynamicDayToWeek[dayType];
        const monthType = dynamicDayToMonth[dayType];
        
        if (weekType && (!initial[weekType] || initial[weekType] === 0)) {
          initial[weekType] = dayValue * diasUteisSemana;
        }
        if (monthType && (!initial[monthType] || initial[monthType] === 0)) {
          initial[monthType] = dayValue * diasUteisMes;
        }
      });
    }
    
    setValues(initial as Record<SdrTargetType, number>);
  }, [monthTargets, existingTargets, open, diasUteisSemana, diasUteisMes, dynamicConfigs, buPrefix, dynamicDayToWeek, dynamicDayToMonth]);

  // Handler para campos de semana e mês (edição manual)
  const handleChange = (type: SdrTargetType, value: string) => {
    const numValue = parseInt(value) || 0;
    setValues(prev => ({ ...prev, [type]: Math.max(0, numValue) }));
  };

  // Handler para campos de dia (auto-calcula semana e mês, e cascata se for agendamento)
  const handleDayChange = (type: SdrTargetType, value: string) => {
    const numValue = parseInt(value) || 0;
    let newValues = { ...values };
    
    const agendamentoDiaType = `${buPrefix}agendamento_dia` as SdrTargetType;
    
    // Se é o Agendamento, calcula todos os outros em cascata
    if (type === agendamentoDiaType) {
      const dayValues = calculateDayCascade(numValue, buPrefix);
      
      // Atualiza todos os valores do dia
      Object.entries(dayValues).forEach(([key, val]) => {
        newValues[key as SdrTargetType] = val;
      });
      
      // Calcula semana e mês para TODOS os tipos do dia
      Object.keys(dayValues).forEach(dayType => {
        const dayVal = dayValues[dayType];
        const weekType = dynamicDayToWeek[dayType];
        const monthType = dynamicDayToMonth[dayType];
        
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
      const weekType = dynamicDayToWeek[type];
      const monthType = dynamicDayToMonth[type];
      
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
    const agendamentoDiaType = `${buPrefix}agendamento_dia` as SdrTargetType;
    const agendamento = values[agendamentoDiaType] || 0;
    const dayValues = calculateDayCascade(agendamento, buPrefix);
    
    const newValues = { ...values };
    
    // Aplica valores do dia em cascata
    Object.entries(dayValues).forEach(([key, val]) => {
      newValues[key as SdrTargetType] = val;
    });
    
    // Recalcula semana e mês para todos
    Object.keys(dayValues).forEach(dayType => {
      const dayVal = dayValues[dayType];
      const weekType = dynamicDayToWeek[dayType];
      const monthType = dynamicDayToMonth[dayType];
      
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

  const dayConfigs = dynamicConfigs.filter(c => c.period === 'day');
  const weekConfigs = dynamicConfigs.filter(c => c.period === 'week');
  const monthConfigs = dynamicConfigs.filter(c => c.period === 'month');

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
                <p className="font-semibold text-foreground">{(annualTotals[`${buPrefix}r1_realizada_mes`] || 0).toLocaleString('pt-BR')}</p>
                <p className="text-muted-foreground">R1 Realizadas</p>
              </div>
              <div className="text-center">
                <p className="font-semibold text-foreground">{(annualTotals[`${buPrefix}contrato_mes`] || 0).toLocaleString('pt-BR')}</p>
                <p className="text-muted-foreground">Contratos</p>
              </div>
              {buPrefix === 'consorcio_sdr_' ? (
                <>
                  <div className="text-center">
                    <p className="font-semibold text-foreground">{(annualTotals[`${buPrefix}carta_fechada_mes`] || 0).toLocaleString('pt-BR')}</p>
                    <p className="text-muted-foreground">Carta Sócios</p>
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-foreground">{(annualTotals[`${buPrefix}aporte_mes`] || 0).toLocaleString('pt-BR')}</p>
                    <p className="text-muted-foreground">Aporte Holding</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="text-center">
                    <p className="font-semibold text-foreground">{(annualTotals[`${buPrefix}r2_realizada_mes`] || 0).toLocaleString('pt-BR')}</p>
                    <p className="text-muted-foreground">R2 Realizadas</p>
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-foreground">{(annualTotals[`${buPrefix}venda_realizada_mes`] || 0).toLocaleString('pt-BR')}</p>
                    <p className="text-muted-foreground">Vendas</p>
                  </div>
                </>
              )}
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