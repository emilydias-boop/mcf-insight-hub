import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { Save, RefreshCw, Cloud, AlertCircle, Zap, Edit3, TrendingUp, TrendingDown } from 'lucide-react';
import { SdrMonthKpi, SdrCompPlan } from '@/types/sdr-fechamento';
import { useSyncSdrKpis } from '@/hooks/useSyncSdrKpis';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface KpiEditFormProps {
  kpi: SdrMonthKpi | null;
  compPlan: SdrCompPlan | null;
  sdrId: string;
  anoMes: string;
  disabled?: boolean;
  onSave: (kpiData: Partial<SdrMonthKpi>) => void;
  isSaving?: boolean;
  intermediacoes?: number;
}

export const KpiEditForm = ({
  kpi,
  compPlan,
  sdrId,
  anoMes,
  disabled = false,
  onSave,
  isSaving = false,
  intermediacoes = 0,
}: KpiEditFormProps) => {
  const [formData, setFormData] = useState({
    reunioes_agendadas: 0,
    reunioes_realizadas: 0,
    no_shows: 0,
    tentativas_ligacoes: 0,
    score_organizacao: 0,
  });
  
  const [isManualMode, setIsManualMode] = useState(false);

  const syncKpis = useSyncSdrKpis();

  useEffect(() => {
    if (kpi) {
      setFormData({
        reunioes_agendadas: kpi.reunioes_agendadas || 0,
        reunioes_realizadas: kpi.reunioes_realizadas || 0,
        no_shows: kpi.no_shows || 0,
        tentativas_ligacoes: kpi.tentativas_ligacoes || 0,
        score_organizacao: kpi.score_organizacao || 0,
      });
      setIsManualMode(kpi.modo_entrada === 'manual');
    }
  }, [kpi]);

  const handleChange = (field: string, value: string) => {
    const numValue = parseInt(value) || 0;
    setFormData(prev => ({ ...prev, [field]: numValue }));
  };

  const handleModeChange = (checked: boolean) => {
    setIsManualMode(checked);
    if (!checked) {
      toast.info('Modo Automático ativado', {
        description: 'Use o botão "Sincronizar do Clint" para atualizar os KPIs.',
      });
    } else {
      toast.info('Modo Manual ativado', {
        description: 'Você pode editar manualmente os valores de R1 Agendada, R1 Realizada e No-Shows.',
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate manual fields
    const hasPendingManualFields = formData.tentativas_ligacoes === 0 || formData.score_organizacao === 0;
    
    // Para modo manual, validar também os campos de KPI
    if (isManualMode) {
      const hasIncompleteKpis = formData.reunioes_agendadas === 0;
      if (hasIncompleteKpis) {
        toast.warning('Preencha os KPIs', {
          description: 'Reuniões Agendadas deve ser preenchido.',
        });
      }
    }
    
    if (hasPendingManualFields) {
      toast.warning('Atenção: Campos manuais estão zerados', {
        description: 'Tentativas de Ligações e/ou Organização ainda precisam ser preenchidos.',
      });
    }
    
    // Calculate taxa_no_show
    const taxa_no_show = formData.reunioes_agendadas > 0
      ? (formData.no_shows / formData.reunioes_agendadas) * 100
      : 0;

    onSave({
      sdr_id: sdrId,
      ano_mes: anoMes,
      ...formData,
      taxa_no_show,
      intermediacoes_contrato: intermediacoes,
      modo_entrada: isManualMode ? 'manual' : 'auto',
    });
  };

  const handleSyncFromClint = () => {
    if (isManualMode) {
      toast.warning('Modo Manual ativo', {
        description: 'Desative o modo manual para sincronizar do Clint.',
      });
      return;
    }
    syncKpis.mutate({ sdr_id: sdrId, ano_mes: anoMes });
  };

  const taxaNoShow = formData.reunioes_agendadas > 0
    ? ((formData.no_shows / formData.reunioes_agendadas) * 100).toFixed(1)
    : '0.0';

  // Taxa de Realização: R1 Realizadas / R1 Agendadas
  const taxaRealizacao = formData.reunioes_agendadas > 0
    ? (formData.reunioes_realizadas / formData.reunioes_agendadas) * 100
    : 0;
  
  const getRealizacaoStatus = () => {
    if (taxaRealizacao >= 70) return { label: 'BOM', color: 'text-green-500', bgColor: 'bg-green-500/10 border-green-500/50' };
    if (taxaRealizacao >= 50) return { label: 'REGULAR', color: 'text-yellow-500', bgColor: 'bg-yellow-500/10 border-yellow-500/50' };
    return { label: 'BAIXO', color: 'text-red-500', bgColor: 'bg-red-500/10 border-red-500/50' };
  };

  const realizacaoStatus = getRealizacaoStatus();

  // Check for pending manual inputs
  const tentativasPending = formData.tentativas_ligacoes === 0 && (compPlan?.meta_tentativas || 0) > 0;
  const organizacaoPending = formData.score_organizacao === 0 && (compPlan?.meta_organizacao || 0) > 0;
  const hasPendingFields = tentativasPending || organizacaoPending;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between py-3">
        <div className="flex-1">
          <CardTitle className="text-sm font-semibold">Editar KPIs</CardTitle>
          {hasPendingFields && !isManualMode && (
            <p className="text-xs text-yellow-500 mt-1 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              Campos manuais pendentes de preenchimento
            </p>
          )}
        </div>
        
        {/* Toggle Manual/Auto */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 border rounded-lg px-3 py-1.5">
            <span className={cn("text-xs", !isManualMode && "font-medium text-primary")}>Auto</span>
            <Switch 
              checked={isManualMode} 
              onCheckedChange={handleModeChange}
              disabled={disabled}
            />
            <span className={cn("text-xs", isManualMode && "font-medium text-orange-500")}>Manual</span>
          </div>
          
          {/* Botão Sincronizar - só aparece no modo automático */}
          {!isManualMode && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleSyncFromClint}
              disabled={disabled || syncKpis.isPending}
              className="text-xs h-8"
            >
              {syncKpis.isPending ? (
                <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <Cloud className="h-3.5 w-3.5 mr-1.5" />
              )}
              Sincronizar do Clint
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {/* Indicador de Taxa de Realização */}
        <div className={cn("mb-3 p-2.5 rounded-lg border flex items-center justify-between", realizacaoStatus.bgColor)}>
          <div className="flex items-center gap-2">
            {taxaRealizacao >= 70 ? (
              <TrendingUp className={cn("h-4 w-4", realizacaoStatus.color)} />
            ) : (
              <TrendingDown className={cn("h-4 w-4", realizacaoStatus.color)} />
            )}
            <span className="text-xs font-medium">Taxa de Realização</span>
            <span className="text-[10px] text-muted-foreground">(R1 Realizadas / R1 Agendadas)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn("text-sm font-bold", realizacaoStatus.color)}>
              {taxaRealizacao.toFixed(1)}%
            </span>
            <Badge variant="outline" className={cn("text-[10px] h-5", realizacaoStatus.color, "border-current")}>
              {realizacaoStatus.label} {taxaRealizacao >= 70 ? '✓' : ''}
            </Badge>
          </div>
        </div>
        
        {/* Alertas */}
        {isManualMode && (
          <Alert className="mb-3 border-orange-500/50 bg-orange-500/10 py-2">
            <Edit3 className="h-3.5 w-3.5 text-orange-500" />
            <AlertDescription className="text-xs text-orange-500">
              <strong>Modo Manual:</strong> Você pode editar manualmente os valores de R1 Agendadas, 
              R1 Realizadas e No-Shows. A sincronização automática está desabilitada.
            </AlertDescription>
          </Alert>
        )}
        
        {hasPendingFields && !isManualMode && (
          <Alert className="mb-3 border-yellow-500/50 bg-yellow-500/10 py-2">
            <Edit3 className="h-3.5 w-3.5 text-yellow-500" />
            <AlertDescription className="text-xs text-yellow-500">
              <strong>Preencha os campos manuais:</strong> Tentativas de Ligações e Score de Organização 
              devem ser inseridos manualmente pelo coordenador.
            </AlertDescription>
          </Alert>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {/* Campo: Reuniões Agendadas */}
            <div className="space-y-1">
              <Label htmlFor="reunioes_agendadas" className="flex items-center gap-1.5 text-xs">
                Reuniões Agendadas
                {isManualMode ? (
                  <Badge variant="outline" className="text-[10px] h-4 border-orange-500 text-orange-500">
                    Manual
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-[10px] h-4">
                    <Zap className="h-2.5 w-2.5 mr-0.5" />
                    Auto
                  </Badge>
                )}
              </Label>
              {compPlan && (
                <span className="text-[10px] text-muted-foreground/70 block">
                  Meta: {compPlan.meta_reunioes_agendadas}
                </span>
              )}
              <Input
                id="reunioes_agendadas"
                type="number"
                min="0"
                value={formData.reunioes_agendadas}
                readOnly={!isManualMode}
                onChange={isManualMode ? (e) => handleChange('reunioes_agendadas', e.target.value) : undefined}
                disabled={disabled}
                className={cn("h-8 text-sm", isManualMode ? "border-orange-500/50" : "bg-muted/50")}
              />
            </div>

            {/* Campo: Reuniões Realizadas */}
            <div className="space-y-1">
              <Label htmlFor="reunioes_realizadas" className="flex items-center gap-1.5 text-xs">
                Reuniões Realizadas
                {isManualMode ? (
                  <Badge variant="outline" className="text-[10px] h-4 border-orange-500 text-orange-500">
                    Manual
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-[10px] h-4">
                    <Zap className="h-2.5 w-2.5 mr-0.5" />
                    Auto
                  </Badge>
                )}
              </Label>
              {compPlan && (
                <span className="text-[10px] text-muted-foreground/70 block">
                  Meta: {compPlan.meta_reunioes_realizadas} | Min 70% de Agendadas
                </span>
              )}
              <Input
                id="reunioes_realizadas"
                type="number"
                min="0"
                value={formData.reunioes_realizadas}
                readOnly={!isManualMode}
                onChange={isManualMode ? (e) => handleChange('reunioes_realizadas', e.target.value) : undefined}
                disabled={disabled}
                className={cn("h-8 text-sm", isManualMode ? "border-orange-500/50" : "bg-muted/50")}
              />
            </div>

            {/* Campo: No-Shows */}
            <div className="space-y-1">
              <Label htmlFor="no_shows" className="flex items-center gap-1.5 text-xs">
                No-Shows
                {isManualMode ? (
                  <Badge variant="outline" className="text-[10px] h-4 border-orange-500 text-orange-500">
                    Manual
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-[10px] h-4">
                    <Zap className="h-2.5 w-2.5 mr-0.5" />
                    Auto
                  </Badge>
                )}
              </Label>
              <span className="text-[10px] text-muted-foreground/70 block">
                Taxa: {taxaNoShow}% / Max: 30%
              </span>
              <Input
                id="no_shows"
                type="number"
                min="0"
                value={formData.no_shows}
                readOnly={!isManualMode}
                onChange={isManualMode ? (e) => handleChange('no_shows', e.target.value) : undefined}
                disabled={disabled}
                className={cn("h-8 text-sm", isManualMode ? "border-orange-500/50" : "bg-muted/50")}
              />
            </div>

            {/* Campo Manual: Tentativas de Ligações */}
            <div className="space-y-1">
              <Label htmlFor="tentativas_ligacoes" className="flex items-center gap-1.5 text-xs">
                Tentativas de Ligações
                <Badge variant="outline" className={cn(
                  "text-[10px] h-4",
                  tentativasPending ? "border-yellow-500 text-yellow-500" : "border-blue-500 text-blue-500"
                )}>
                  Manual
                </Badge>
              </Label>
              {compPlan && compPlan.meta_tentativas > 0 && (
                <span className="text-[10px] text-muted-foreground/70 block">
                  Meta: {compPlan.meta_tentativas}
                </span>
              )}
              <Input
                id="tentativas_ligacoes"
                type="number"
                min="0"
                value={formData.tentativas_ligacoes}
                onChange={(e) => handleChange('tentativas_ligacoes', e.target.value)}
                disabled={disabled}
                className={cn(
                  "h-8 text-sm",
                  tentativasPending && "border-yellow-500 focus-visible:ring-yellow-500"
                )}
                placeholder={tentativasPending ? "Preencha" : undefined}
              />
            </div>

            {/* Campo Manual: Score de Organização */}
            <div className="space-y-1">
              <Label htmlFor="score_organizacao" className="flex items-center gap-1.5 text-xs">
                Score de Organização (%)
                <Badge variant="outline" className={cn(
                  "text-[10px] h-4",
                  organizacaoPending ? "border-yellow-500 text-yellow-500" : "border-blue-500 text-blue-500"
                )}>
                  Manual
                </Badge>
              </Label>
              {compPlan && (
                <span className="text-[10px] text-muted-foreground/70 block">
                  Meta: {compPlan.meta_organizacao}%
                </span>
              )}
              <Input
                id="score_organizacao"
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

            {/* Campo Automático: Intermediações de Contrato */}
            <div className="space-y-1">
              <Label className="flex items-center gap-1.5 text-xs">
                Intermediações de Contrato
                <Badge variant="secondary" className="text-[10px] h-4">
                  <Zap className="h-2.5 w-2.5 mr-0.5" />
                  Auto
                </Badge>
              </Label>
              <div className="h-8 px-3 py-1.5 rounded-md border bg-muted/50 flex items-center text-sm">
                <span className="font-medium">{intermediacoes}</span>
                <span className="text-muted-foreground/70 text-[10px] ml-1.5">(calculado da Hubla)</span>
              </div>
            </div>
          </div>

          <Button type="submit" disabled={disabled || isSaving} className="w-full h-8 text-sm">
            {isSaving ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="h-3.5 w-3.5 mr-1.5" />
                Salvar e Recalcular
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
