import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Save, RefreshCw, AlertCircle } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import { useActiveMetricsForCargo, getMetricValueLabel } from '@/hooks/useActiveMetricsForSdr';

interface PlanValues {
  ote_total: number;
  fixo_valor: number;
  variavel_total: number;
  meta_diaria: number;
  valor_meta_rpg: number;
  valor_docs_reuniao: number;
  valor_tentativas: number;
  valor_organizacao: number;
}

interface EditIndividualPlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeName: string;
  employeeId: string;
  sdrId: string | null;
  cargoName: string;
  cargoId?: string;
  squad?: string;
  anoMes: string;
  // Valores atuais (do sdr_comp_plan ou cargos_catalogo)
  currentValues: PlanValues;
  // Valores do catálogo (para referência)
  catalogValues?: PlanValues;
  isPersonalized: boolean;
  onSave: (values: PlanValues) => void;
  isSaving?: boolean;
}

export const EditIndividualPlanDialog = ({
  open,
  onOpenChange,
  employeeName,
  employeeId,
  sdrId,
  cargoName,
  cargoId,
  squad,
  anoMes,
  currentValues,
  catalogValues,
  isPersonalized,
  onSave,
  isSaving = false,
}: EditIndividualPlanDialogProps) => {
  const [formData, setFormData] = useState<PlanValues>(currentValues);
  const [autoCalculateVariavel, setAutoCalculateVariavel] = useState(true);

  // Fetch active metrics for this cargo
  const { data: activeMetrics, isLoading: loadingMetrics } = useActiveMetricsForCargo(cargoId, anoMes, squad);

  useEffect(() => {
    setFormData(currentValues);
  }, [currentValues, open]);

  // Recalcular variável quando OTE ou Fixo mudam
  useEffect(() => {
    if (autoCalculateVariavel) {
      const variavelCalculado = formData.ote_total - formData.fixo_valor;
      if (variavelCalculado !== formData.variavel_total) {
        setFormData(prev => ({
          ...prev,
          variavel_total: Math.max(0, variavelCalculado),
        }));
      }
    }
  }, [formData.ote_total, formData.fixo_valor, autoCalculateVariavel]);

  const handleChange = (field: keyof PlanValues, value: string) => {
    const numValue = parseFloat(value) || 0;
    setFormData(prev => ({ ...prev, [field]: numValue }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const handleResetToCatalog = () => {
    if (catalogValues) {
      setFormData(catalogValues);
    }
  };

  const hasChanges = JSON.stringify(formData) !== JSON.stringify(currentValues);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Editar Plano Individual
            {isPersonalized && (
              <Badge variant="secondary" className="text-xs">
                Personalizado
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            <span className="font-medium">{employeeName}</span> • {cargoName}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!sdrId && (
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
              <p className="text-xs text-yellow-500">
                Este colaborador não possui registro no sistema de fechamento (SDR). 
                É necessário criar o vínculo primeiro.
              </p>
            </div>
          )}

          {/* OTE e Fixo/Variável */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ote_total" className="text-xs">OTE Total</Label>
              <Input
                id="ote_total"
                type="number"
                min="0"
                step="1"
                value={formData.ote_total}
                onChange={(e) => handleChange('ote_total', e.target.value)}
                className="h-9"
              />
              {catalogValues && (
                <span className="text-[10px] text-muted-foreground">
                  Catálogo: {formatCurrency(catalogValues.ote_total)}
                </span>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="fixo_valor" className="text-xs">Fixo</Label>
              <Input
                id="fixo_valor"
                type="number"
                min="0"
                step="1"
                value={formData.fixo_valor}
                onChange={(e) => handleChange('fixo_valor', e.target.value)}
                className="h-9"
              />
              {catalogValues && (
                <span className="text-[10px] text-muted-foreground">
                  Catálogo: {formatCurrency(catalogValues.fixo_valor)}
                </span>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="variavel_total" className="text-xs text-muted-foreground">
                Variável {autoCalculateVariavel && '(auto)'}
              </Label>
              <Input
                id="variavel_total"
                type="number"
                min="0"
                step="1"
                value={formData.variavel_total}
                onChange={(e) => {
                  setAutoCalculateVariavel(false);
                  handleChange('variavel_total', e.target.value);
                }}
                className="h-9 bg-muted/50"
                disabled={autoCalculateVariavel}
              />
              <span className="text-[10px] text-muted-foreground">
                OTE - Fixo = Variável
              </span>
            </div>
          </div>

          {/* Meta Diária */}
          <div className="space-y-1.5">
            <Label htmlFor="meta_diaria" className="text-xs">Meta Diária (reuniões)</Label>
            <Input
              id="meta_diaria"
              type="number"
              min="1"
              max="50"
              value={formData.meta_diaria}
              onChange={(e) => handleChange('meta_diaria', e.target.value)}
              className="h-9 w-32"
            />
            <span className="text-[10px] text-muted-foreground">
              Quantidade de reuniões/dia esperadas
            </span>
          </div>

          {/* Valores por Métrica - Dynamic based on active metrics */}
          <div className="border-t pt-3">
            <Label className="text-xs text-muted-foreground mb-2 block flex items-center gap-2">
              Valores por Métrica (componentes do variável)
              {loadingMetrics && <RefreshCw className="h-3 w-3 animate-spin" />}
              {activeMetrics && activeMetrics.length > 0 && (
                <Badge variant="outline" className="text-[10px]">
                  {activeMetrics.length} métricas configuradas
                </Badge>
              )}
            </Label>
            <div className="grid grid-cols-2 gap-3">
              {/* Show dynamic metrics if configured, otherwise show defaults */}
              {activeMetrics && activeMetrics.length > 0 ? (
                <>
                  {activeMetrics.map((metric) => {
                    const fieldMap: Record<string, keyof PlanValues> = {
                      agendamentos: 'valor_meta_rpg',
                      realizadas: 'valor_docs_reuniao',
                      tentativas: 'valor_tentativas',
                      organizacao: 'valor_organizacao',
                      contratos: 'valor_docs_reuniao', // reuse for contracts
                      r2_agendadas: 'valor_meta_rpg', // reuse for R2
                    };
                    const field = fieldMap[metric.nome_metrica];
                    if (!field) return null;
                    
                    return (
                      <div key={metric.nome_metrica} className="space-y-1">
                        <Label htmlFor={field} className="text-[10px]">
                          {metric.label_exibicao} (R$)
                        </Label>
                        <Input
                          id={field}
                          type="number"
                          min="0"
                          step="1"
                          value={formData[field]}
                          onChange={(e) => handleChange(field, e.target.value)}
                          className="h-8 text-sm"
                        />
                      </div>
                    );
                  })}
                </>
              ) : (
                <>
                  {/* Default fields when no metrics configured */}
                  <div className="space-y-1">
                    <Label htmlFor="valor_meta_rpg" className="text-[10px]">Agendadas (R$)</Label>
                    <Input
                      id="valor_meta_rpg"
                      type="number"
                      min="0"
                      step="1"
                      value={formData.valor_meta_rpg}
                      onChange={(e) => handleChange('valor_meta_rpg', e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="valor_docs_reuniao" className="text-[10px]">Realizadas (R$)</Label>
                    <Input
                      id="valor_docs_reuniao"
                      type="number"
                      min="0"
                      step="1"
                      value={formData.valor_docs_reuniao}
                      onChange={(e) => handleChange('valor_docs_reuniao', e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="valor_tentativas" className="text-[10px]">Tentativas (R$)</Label>
                    <Input
                      id="valor_tentativas"
                      type="number"
                      min="0"
                      step="1"
                      value={formData.valor_tentativas}
                      onChange={(e) => handleChange('valor_tentativas', e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="valor_organizacao" className="text-[10px]">Organização (R$)</Label>
                    <Input
                      id="valor_organizacao"
                      type="number"
                      min="0"
                      step="1"
                      value={formData.valor_organizacao}
                      onChange={(e) => handleChange('valor_organizacao', e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2">
            {catalogValues && isPersonalized && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleResetToCatalog}
                className="mr-auto"
              >
                Restaurar do Catálogo
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSaving || !hasChanges || !sdrId}
            >
              {isSaving ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Salvar Plano
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
