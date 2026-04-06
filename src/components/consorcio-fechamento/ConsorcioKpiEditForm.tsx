import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Save, RefreshCw, Edit3, DollarSign, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/formatters';
import { ConsorcioCloserPayout, ConsorcioKpiFormData } from '@/types/consorcio-fechamento';

interface ConsorcioKpiEditFormProps {
  payout: ConsorcioCloserPayout;
  disabled?: boolean;
  onSave: (data: ConsorcioKpiFormData) => void;
  isSaving?: boolean;
}

export const ConsorcioKpiEditForm = ({
  payout,
  disabled = false,
  onSave,
  isSaving = false,
}: ConsorcioKpiEditFormProps) => {
  const [formData, setFormData] = useState({
    comissao_consorcio: 0,
    comissao_holding: 0,
    score_organizacao: 100,
    meta_comissao_consorcio: 0,
    meta_comissao_holding: 0,
  });

  useEffect(() => {
    if (payout) {
      setFormData({
        comissao_consorcio: payout.comissao_consorcio || 0,
        comissao_holding: payout.comissao_holding || 0,
        score_organizacao: payout.score_organizacao || 100,
        meta_comissao_consorcio: payout.meta_comissao_consorcio || 0,
        meta_comissao_holding: payout.meta_comissao_holding || 0,
      });
    }
  }, [payout]);

  const handleChange = (field: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    setFormData(prev => ({ ...prev, [field]: numValue }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.score_organizacao === 0) {
      toast.warning('Atenção: Score de Organização está zerado.');
    }

    onSave({
      comissao_consorcio: formData.comissao_consorcio,
      comissao_holding: formData.comissao_holding,
      score_organizacao: formData.score_organizacao,
      meta_comissao_consorcio: formData.meta_comissao_consorcio,
      meta_comissao_holding: formData.meta_comissao_holding,
    });
  };

  const organizacaoPending = formData.score_organizacao === 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between py-3">
        <div>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            Editar KPIs
            <Badge variant="secondary" className="text-[10px]">Closer Consórcio</Badge>
          </CardTitle>
          {organizacaoPending && (
            <p className="text-xs text-yellow-500 mt-1 flex items-center gap-1">
              <Edit3 className="h-3 w-3" />
              Score de Organização pendente
            </p>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {organizacaoPending && (
          <Alert className="mb-3 border-yellow-500/50 bg-yellow-500/10 py-2">
            <Edit3 className="h-3.5 w-3.5 text-yellow-500" />
            <AlertDescription className="text-xs text-yellow-500">
              <strong>Preencha o campo manual:</strong> Score de Organização
              deve ser inserido manualmente pelo coordenador.
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {/* Comissão Consórcio - Realizado */}
            <div className="space-y-1">
              <Label className="flex items-center gap-1.5 text-xs">
                Comissão Consórcio (R$)
                <Badge variant="outline" className="text-[10px] h-4 border-green-500 text-green-500">
                  <Zap className="h-2.5 w-2.5 mr-0.5" />
                  Auto
                </Badge>
              </Label>
              <span className="text-[10px] text-muted-foreground/70 block">
                Realizado: {formatCurrency(payout.comissao_consorcio || 0)}
                {formData.meta_comissao_consorcio > 0 && (
                  <> • Meta: {formatCurrency(formData.meta_comissao_consorcio)}</>
                )}
              </span>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={formData.comissao_consorcio}
                onChange={(e) => handleChange('comissao_consorcio', e.target.value)}
                disabled={disabled}
                className="h-8 text-sm"
              />
            </div>

            {/* Meta Comissão Consórcio */}
            <div className="space-y-1">
              <Label className="flex items-center gap-1.5 text-xs">
                Meta Comissão Consórcio (R$)
                <Badge variant="outline" className="text-[10px] h-4 border-blue-500 text-blue-500">
                  Manual
                </Badge>
              </Label>
              <span className="text-[10px] text-muted-foreground/70 block">
                Definida no Plano OTE do closer
              </span>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={formData.meta_comissao_consorcio}
                onChange={(e) => handleChange('meta_comissao_consorcio', e.target.value)}
                disabled={disabled}
                className="h-8 text-sm"
              />
            </div>

            {/* Comissão Holding - Realizado */}
            <div className="space-y-1">
              <Label className="flex items-center gap-1.5 text-xs">
                Comissão Holding (R$)
                <Badge variant="outline" className="text-[10px] h-4 border-blue-500 text-blue-500">
                  <DollarSign className="h-2.5 w-2.5 mr-0.5" />
                  Manual
                </Badge>
              </Label>
              <span className="text-[10px] text-muted-foreground/70 block">
                Realizado: {formatCurrency(payout.comissao_holding || 0)}
                {formData.meta_comissao_holding > 0 && (
                  <> • Meta: {formatCurrency(formData.meta_comissao_holding)}</>
                )}
              </span>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={formData.comissao_holding}
                onChange={(e) => handleChange('comissao_holding', e.target.value)}
                disabled={disabled}
                className="h-8 text-sm"
              />
            </div>

            {/* Meta Comissão Holding */}
            <div className="space-y-1">
              <Label className="flex items-center gap-1.5 text-xs">
                Meta Comissão Holding (R$)
                <Badge variant="outline" className="text-[10px] h-4 border-blue-500 text-blue-500">
                  Manual
                </Badge>
              </Label>
              <span className="text-[10px] text-muted-foreground/70 block">
                Definida no Plano OTE do closer
              </span>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={formData.meta_comissao_holding}
                onChange={(e) => handleChange('meta_comissao_holding', e.target.value)}
                disabled={disabled}
                className="h-8 text-sm"
              />
            </div>

            {/* Score de Organização - Manual */}
            <div className="space-y-1">
              <Label className="flex items-center gap-1.5 text-xs">
                Organização (%)
                <Badge variant="outline" className={cn(
                  "text-[10px] h-4",
                  organizacaoPending ? "border-yellow-500 text-yellow-500" : "border-blue-500 text-blue-500"
                )}>
                  Manual
                </Badge>
              </Label>
              <span className="text-[10px] text-muted-foreground/70 block">
                Meta: 100% (fixa) - Preenchido pelo coordenador
              </span>
              <Input
                type="number"
                min="0"
                max="150"
                value={formData.score_organizacao}
                onChange={(e) => handleChange('score_organizacao', e.target.value)}
                disabled={disabled}
                className={cn(
                  "h-8 text-sm",
                  organizacaoPending && "border-yellow-500 focus-visible:ring-yellow-500"
                )}
                placeholder={organizacaoPending ? "Preencha" : undefined}
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              type="submit"
              size="sm"
              disabled={disabled || isSaving}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {isSaving ? (
                <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5 mr-1.5" />
              )}
              Salvar e Recalcular
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};
