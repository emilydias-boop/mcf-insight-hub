import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Save, RefreshCw, Cloud, AlertCircle, Zap, Edit3, FileWarning } from 'lucide-react';
import { SdrMonthKpi, SdrCompPlan } from '@/types/sdr-fechamento';
import { useSyncSdrKpis } from '@/hooks/useSyncSdrKpis';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// Meses que requerem entrada manual devido a dados incompletos no Clint
const MANUAL_OVERRIDE_MONTHS = ['2025-11'];

interface KpiEditFormProps {
  kpi: SdrMonthKpi | null;
  compPlan: SdrCompPlan | null;
  sdrId: string;
  anoMes: string;
  disabled?: boolean;
  onSave: (kpiData: Partial<SdrMonthKpi>) => void;
  isSaving?: boolean;
  intermediacoes?: number;
  sdrMetaDiaria?: number;
  diasUteisMes?: number;
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
  sdrMetaDiaria = 10,
  diasUteisMes = 19,
}: KpiEditFormProps) => {
  // Calcular metas baseadas na meta diária do SDR
  const metaAgendadasCalculada = sdrMetaDiaria * diasUteisMes;
  // Meta fixa de tentativas: 84 por dia × dias úteis
  const metaTentativasCalculada = 84 * diasUteisMes;
  // Meta fixa de organização: 100%
  const metaOrganizacaoFixa = 100;
  const [formData, setFormData] = useState({
    reunioes_agendadas: 0,
    reunioes_realizadas: 0,
    no_shows: 0,
    tentativas_ligacoes: 0,
    score_organizacao: 0,
  });

  const syncKpis = useSyncSdrKpis();
  
  // Verifica se é mês de entrada manual (dados incompletos)
  const isManualOverrideMonth = MANUAL_OVERRIDE_MONTHS.includes(anoMes);

  useEffect(() => {
    if (kpi) {
      setFormData({
        reunioes_agendadas: kpi.reunioes_agendadas || 0,
        reunioes_realizadas: kpi.reunioes_realizadas || 0,
        no_shows: kpi.no_shows || 0,
        tentativas_ligacoes: kpi.tentativas_ligacoes || 0,
        score_organizacao: kpi.score_organizacao || 0,
      });
    }
  }, [kpi]);

  const handleChange = (field: string, value: string) => {
    const numValue = parseInt(value) || 0;
    setFormData(prev => ({ ...prev, [field]: numValue }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate manual fields
    const hasPendingManualFields = formData.tentativas_ligacoes === 0 || formData.score_organizacao === 0;
    
    // Para meses de override, validar também os campos de KPI
    if (isManualOverrideMonth) {
      const hasIncompleteKpis = formData.reunioes_agendadas === 0;
      if (hasIncompleteKpis) {
        toast.warning('Preencha os KPIs', {
          description: 'Reuniões Agendadas deve ser preenchido para este mês.',
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
    });
  };

  const handleSyncFromClint = () => {
    syncKpis.mutate({ sdr_id: sdrId, ano_mes: anoMes });
  };

  const taxaNoShow = formData.reunioes_agendadas > 0
    ? ((formData.no_shows / formData.reunioes_agendadas) * 100).toFixed(1)
    : '0.0';

  // Check for pending manual inputs (usando metas calculadas, não do plano)
  const tentativasPending = formData.tentativas_ligacoes === 0 && metaTentativasCalculada > 0;
  const organizacaoPending = formData.score_organizacao === 0 && metaOrganizacaoFixa > 0;
  const hasPendingFields = tentativasPending || organizacaoPending;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between py-3">
        <div>
          <CardTitle className="text-sm font-semibold">Editar KPIs</CardTitle>
          {hasPendingFields && !isManualOverrideMonth && (
            <p className="text-xs text-yellow-500 mt-1 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              Campos manuais pendentes de preenchimento
            </p>
          )}
          {isManualOverrideMonth && (
            <p className="text-xs text-orange-500 mt-1 flex items-center gap-1">
              <FileWarning className="h-3 w-3" />
              Mês com entrada manual de KPIs
            </p>
          )}
        </div>
        {/* Ocultar botão de sincronização para meses de override */}
        {!isManualOverrideMonth && (
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
      </CardHeader>
      <CardContent className="pt-0">
        {/* Alerta para mês de entrada manual */}
        {isManualOverrideMonth && (
          <Alert className="mb-3 border-orange-500/50 bg-orange-500/10 py-2">
            <FileWarning className="h-3.5 w-3.5 text-orange-500" />
            <AlertDescription className="text-xs text-orange-500">
              <strong>Novembro 2025 - Entrada Manual:</strong> Devido a dados incompletos no Clint 
              (período 15-23/nov sem registro), os valores de R1 Agendadas, R1 Realizadas e No-Shows 
              devem ser inseridos manualmente.
            </AlertDescription>
          </Alert>
        )}
        
        {hasPendingFields && !isManualOverrideMonth && (
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
            {/* Campo: Reuniões Agendadas - Editável */}
            <div className="space-y-1">
              <Label htmlFor="reunioes_agendadas" className="flex items-center gap-1.5 text-xs">
                Reuniões Agendadas
                <Badge variant="outline" className="text-[10px] h-4 border-blue-500 text-blue-500">
                  Editável
                </Badge>
              </Label>
              <span className="text-[10px] text-muted-foreground/70 block">
                Meta: {metaAgendadasCalculada} ({sdrMetaDiaria}/dia × {diasUteisMes} dias)
              </span>
              <Input
                id="reunioes_agendadas"
                type="number"
                min="0"
                value={formData.reunioes_agendadas}
                onChange={(e) => handleChange('reunioes_agendadas', e.target.value)}
                disabled={disabled}
                className="h-8 text-sm"
              />
            </div>

            {/* Campo: Reuniões Realizadas - Editável */}
            <div className="space-y-1">
              <Label htmlFor="reunioes_realizadas" className="flex items-center gap-1.5 text-xs">
                Reuniões Realizadas
                <Badge variant="outline" className="text-[10px] h-4 border-blue-500 text-blue-500">
                  Editável
                </Badge>
              </Label>
              <span className="text-[10px] text-muted-foreground/70 block">
                Meta: {Math.round(formData.reunioes_agendadas * 0.7)} (70% de {formData.reunioes_agendadas} agendadas)
              </span>
              <Input
                id="reunioes_realizadas"
                type="number"
                min="0"
                value={formData.reunioes_realizadas}
                onChange={(e) => handleChange('reunioes_realizadas', e.target.value)}
                disabled={disabled}
                className="h-8 text-sm"
              />
            </div>

            {/* Campo: No-Shows - Editável */}
            <div className="space-y-1">
              <Label htmlFor="no_shows" className="flex items-center gap-1.5 text-xs">
                No-Shows
                <Badge variant="outline" className="text-[10px] h-4 border-blue-500 text-blue-500">
                  Editável
                </Badge>
              </Label>
              <span className="text-[10px] text-muted-foreground/70 block">
                Taxa: {taxaNoShow}% / Max: 30%
              </span>
              <Input
                id="no_shows"
                type="number"
                min="0"
                value={formData.no_shows}
                onChange={(e) => handleChange('no_shows', e.target.value)}
                disabled={disabled}
                className="h-8 text-sm"
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
              <span className="text-[10px] text-muted-foreground/70 block">
                Meta: {metaTentativasCalculada} (84/dia × {diasUteisMes} dias)
              </span>
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
              <span className="text-[10px] text-muted-foreground/70 block">
                Meta: {metaOrganizacaoFixa}% (fixa)
              </span>
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