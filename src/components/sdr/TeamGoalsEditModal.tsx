import { useState, useEffect } from "react";
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
import { Loader2, RefreshCcw, Info } from "lucide-react";
import { toast } from "sonner";
import { SdrTargetType, SDR_TARGET_CONFIGS, SdrTarget, useUpsertSdrTargets } from "@/hooks/useSdrTeamTargets";
import { getDiasUteisSemanaAtual, getDiasUteisMesAtual } from "@/lib/businessDays";

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

export function TeamGoalsEditModal({ open, onOpenChange, existingTargets }: TeamGoalsEditModalProps) {
  const [values, setValues] = useState<Record<SdrTargetType, number>>({} as Record<SdrTargetType, number>);
  const upsertMutation = useUpsertSdrTargets();

  // Calcular dias úteis
  const diasUteisSemana = getDiasUteisSemanaAtual();
  const diasUteisMes = getDiasUteisMesAtual();

  // Initialize values from existing targets and auto-recalculate if needed
  useEffect(() => {
    if (!open) return;
    
    const initial: Record<string, number> = {};
    SDR_TARGET_CONFIGS.forEach(config => {
      const existing = existingTargets.find(t => t.target_type === config.type);
      initial[config.type] = existing?.target_value ?? 0;
    });
    
    // Auto-recalcular semana e mês se estiverem zerados mas o dia tiver valor
    const dayConfigsList = SDR_TARGET_CONFIGS.filter(c => c.period === 'day');
    
    dayConfigsList.forEach(dayConfig => {
      const dayValue = initial[dayConfig.type] || 0;
      
      if (dayValue > 0) {
        const weekType = dayToWeekMapping[dayConfig.type];
        const monthType = dayToMonthMapping[dayConfig.type];
        
        // Se semana estiver zerada, calcula automaticamente
        if (weekType && (!initial[weekType] || initial[weekType] === 0)) {
          initial[weekType] = dayValue * diasUteisSemana;
        }
        
        // Se mês estiver zerado, calcula automaticamente
        if (monthType && (!initial[monthType] || initial[monthType] === 0)) {
          initial[monthType] = dayValue * diasUteisMes;
        }
      }
    });
    
    setValues(initial as Record<SdrTargetType, number>);
  }, [existingTargets, open, diasUteisSemana, diasUteisMes]);

  // Handler para campos de semana e mês (edição manual)
  const handleChange = (type: SdrTargetType, value: string) => {
    const numValue = parseInt(value) || 0;
    setValues(prev => ({ ...prev, [type]: Math.max(0, numValue) }));
  };

  // Handler para campos de dia (auto-calcula semana e mês)
  const handleDayChange = (type: SdrTargetType, value: string) => {
    const numValue = parseInt(value) || 0;
    const newValues = { ...values, [type]: Math.max(0, numValue) };
    
    // Calcula automaticamente semana e mês
    const weekType = dayToWeekMapping[type];
    const monthType = dayToMonthMapping[type];
    
    if (weekType) {
      newValues[weekType] = numValue * diasUteisSemana;
    }
    if (monthType) {
      newValues[monthType] = numValue * diasUteisMes;
    }
    
    setValues(newValues);
  };

  // Função para recalcular todas as metas baseado nos dias
  const handleRecalculate = () => {
    const newValues = { ...values };
    
    dayConfigs.forEach(dayConfig => {
      const dayValue = values[dayConfig.type] || 0;
      const weekType = dayToWeekMapping[dayConfig.type];
      const monthType = dayToMonthMapping[dayConfig.type];
      
      if (weekType) {
        newValues[weekType] = dayValue * diasUteisSemana;
      }
      if (monthType) {
        newValues[monthType] = dayValue * diasUteisMes;
      }
    });
    
    setValues(newValues);
    toast.success(`Metas recalculadas: ${diasUteisSemana} dias úteis na semana, ${diasUteisMes} dias úteis no mês`);
  };

  const handleSave = async () => {
    await upsertMutation.mutateAsync(values);
    onOpenChange(false);
  };

  const dayConfigs = SDR_TARGET_CONFIGS.filter(c => c.period === 'day');
  const weekConfigs = SDR_TARGET_CONFIGS.filter(c => c.period === 'week');
  const monthConfigs = SDR_TARGET_CONFIGS.filter(c => c.period === 'month');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
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

        {/* Info de dias úteis */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 px-3 py-2 rounded-md">
          <Info className="h-4 w-4" />
          <span>Semana: <strong>{diasUteisSemana}</strong> dias úteis | Mês: <strong>{diasUteisMes}</strong> dias úteis</span>
        </div>

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
