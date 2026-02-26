import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Save, RefreshCw, Calendar, AlertCircle, Zap, Edit3, Phone, FileCheck, Sparkles } from 'lucide-react';
import { SdrMonthKpi, SdrCompPlan } from '@/types/sdr-fechamento';
import { useSdrAgendaMetricsBySdrId } from '@/hooks/useSdrAgendaMetricsBySdrId';
import { useSdrCallMetricsBySdrId } from '@/hooks/useSdrCallMetrics';
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
  sdrMetaDiaria?: number;
  diasUteisMes?: number;
  roleType?: 'sdr' | 'closer';
  metaContratosDiaria?: number;
  vendasParceria?: number;
  metaContratosPercentual?: number; // Novo: % das Realizadas para meta de contratos
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
  roleType = 'sdr',
  metaContratosDiaria = 1,
  vendasParceria = 0,
  metaContratosPercentual,
}: KpiEditFormProps) => {
  const isCloser = roleType === 'closer';
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

  // Buscar métricas da Agenda
  const agendaMetrics = useSdrAgendaMetricsBySdrId(sdrId, anoMes);
  
  // Buscar métricas de ligações do Twilio (apenas para SDRs)
  const callMetrics = useSdrCallMetricsBySdrId(sdrId, anoMes);

  // Flag para indicar se estamos carregando dados automáticos
  const isLoadingAuto = agendaMetrics.isLoading || (!isCloser && callMetrics.isLoading);

  // Meta de contratos para Closer - dinâmica se metaContratosPercentual está configurado
  const realizadasAtual = kpi?.reunioes_realizadas || agendaMetrics.data?.r1_realizada || 0;
  const metaContratosCalculada = metaContratosPercentual && metaContratosPercentual > 0
    ? Math.round((realizadasAtual * metaContratosPercentual) / 100)
    : metaContratosDiaria * diasUteisMes;

  // Preencher formulário com dados existentes do KPI
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

  // Auto-preencher campos com dados da Agenda e Twilio (sempre, mesmo com KPI salvo)
  useEffect(() => {
    if (agendaMetrics.data && !agendaMetrics.isLoading) {
      setFormData(prev => ({
        ...prev,
        reunioes_agendadas: agendaMetrics.data.agendamentos,
        reunioes_realizadas: agendaMetrics.data.r1_realizada,
        no_shows: agendaMetrics.data.no_shows,
      }));
    }
  }, [agendaMetrics.data, agendaMetrics.isLoading]);

  useEffect(() => {
    if (!isCloser && callMetrics.data && !callMetrics.isLoading) {
      setFormData(prev => ({
        ...prev,
        tentativas_ligacoes: callMetrics.data.totalCalls,
      }));
    }
  }, [callMetrics.data, callMetrics.isLoading, isCloser]);

  const handleChange = (field: string, value: string) => {
    const numValue = parseInt(value) || 0;
    setFormData(prev => ({ ...prev, [field]: numValue }));
  };

  const handleSyncFromAgenda = () => {
    let updated = false;
    
    if (agendaMetrics.data) {
      setFormData(prev => ({
        ...prev,
        reunioes_agendadas: agendaMetrics.data!.agendamentos,
        reunioes_realizadas: agendaMetrics.data!.r1_realizada,
        no_shows: agendaMetrics.data!.no_shows,
      }));
      updated = true;
    }
    
    if (!isCloser && callMetrics.data) {
      setFormData(prev => ({
        ...prev,
        tentativas_ligacoes: callMetrics.data!.totalCalls,
      }));
      updated = true;
    }
    
    if (updated) {
      toast.success(isCloser ? 'Dados atualizados da Agenda' : 'Dados atualizados da Agenda e Twilio');
    } else {
      toast.info('Nenhum dado disponível para sincronizar');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate manual fields - organização para todos
    const hasPendingManualFields = formData.score_organizacao === 0;
    
    if (hasPendingManualFields) {
      toast.warning('Atenção: Campo manual está zerado', {
        description: 'Score de Organização ainda precisa ser preenchido.',
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


  const taxaNoShow = formData.reunioes_agendadas > 0
    ? ((formData.no_shows / formData.reunioes_agendadas) * 100).toFixed(1)
    : '0.0';

  // Check for pending manual inputs
  const organizacaoPending = formData.score_organizacao === 0 && metaOrganizacaoFixa > 0;
  const hasPendingFields = organizacaoPending;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between py-3">
        <div>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            Editar KPIs
            {isCloser && (
              <Badge variant="secondary" className="text-[10px]">Closer</Badge>
            )}
          </CardTitle>
          {hasPendingFields && (
            <p className="text-xs text-yellow-500 mt-1 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              Campo manual pendente de preenchimento
            </p>
          )}
          {isLoadingAuto && (
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <RefreshCw className="h-3 w-3 animate-spin" />
              {isCloser ? 'Carregando dados da Agenda...' : 'Carregando dados da Agenda e Twilio...'}
            </p>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleSyncFromAgenda}
          disabled={disabled || isLoadingAuto}
          className="text-xs h-8"
        >
          {isLoadingAuto ? (
            <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
          ) : (
            <Calendar className="h-3.5 w-3.5 mr-1.5" />
          )}
          Atualizar da Agenda
        </Button>
      </CardHeader>
      <CardContent className="pt-0">
        {hasPendingFields && (
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
            {/* ============ CAMPOS PARA CLOSER ============ */}
            {isCloser ? (
              <>
                {/* Campo: Reuniões Realizadas (R1 que o Closer atendeu) - Auto (Agenda) */}
                <div className="space-y-1">
                  <Label htmlFor="reunioes_realizadas" className="flex items-center gap-1.5 text-xs">
                    R1 Realizadas
                    <Badge variant="outline" className="text-[10px] h-4 border-green-500 text-green-500">
                      <Calendar className="h-2.5 w-2.5 mr-0.5" />
                      Auto (Agenda)
                    </Badge>
                  </Label>
                  <span className="text-[10px] text-muted-foreground/70 block">
                    Reuniões atendidas pelo Closer
                    {agendaMetrics.data && (
                      <span className="ml-1 text-green-500">• Agenda: {agendaMetrics.data.r1_realizada}</span>
                    )}
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

                {/* Campo: Contratos Pagos - Auto (Agenda) */}
                <div className="space-y-1">
                  <Label className="flex items-center gap-1.5 text-xs">
                    Contratos Pagos
                    <Badge variant="outline" className="text-[10px] h-4 border-green-500 text-green-500">
                      <FileCheck className="h-2.5 w-2.5 mr-0.5" />
                      Auto (Agenda)
                    </Badge>
                  </Label>
                  <span className="text-[10px] text-muted-foreground/70 block">
                    {metaContratosPercentual && metaContratosPercentual > 0 ? (
                      <>Meta: {metaContratosPercentual}% de {realizadasAtual} Realizadas = {metaContratosCalculada}</>
                    ) : (
                      <>Meta: {metaContratosCalculada} ({metaContratosDiaria}/dia × {diasUteisMes} dias)</>
                    )}
                    {agendaMetrics.data && (
                      <span className="ml-1 text-green-500">• Agenda: {agendaMetrics.data.contratos}</span>
                    )}
                  </span>
                  <div className="h-8 px-3 py-1.5 rounded-md border bg-muted/50 flex items-center text-sm">
                    <span className="font-medium">{intermediacoes}</span>
                    <span className="text-muted-foreground/70 text-[10px] ml-1.5">(da Agenda)</span>
                  </div>
                </div>

                {/* Campo: No-Shows - Auto (Agenda) */}
                <div className="space-y-1">
                  <Label htmlFor="no_shows" className="flex items-center gap-1.5 text-xs">
                    No-Shows
                    <Badge variant="outline" className="text-[10px] h-4 border-green-500 text-green-500">
                      <Calendar className="h-2.5 w-2.5 mr-0.5" />
                      Auto (Agenda)
                    </Badge>
                  </Label>
                  <span className="text-[10px] text-muted-foreground/70 block">
                    Taxa: {taxaNoShow}% / Max: 30%
                    {agendaMetrics.data && (
                      <span className="ml-1 text-green-500">• Agenda: {agendaMetrics.data.no_shows}</span>
                    )}
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

                {/* Campo Manual: Score de Organização - Closer */}
                <div className="space-y-1">
                  <Label htmlFor="score_organizacao" className="flex items-center gap-1.5 text-xs">
                    Organização (%)
                    <Badge variant="outline" className={cn(
                      "text-[10px] h-4",
                      organizacaoPending ? "border-yellow-500 text-yellow-500" : "border-blue-500 text-blue-500"
                    )}>
                      Manual
                    </Badge>
                  </Label>
                  <span className="text-[10px] text-muted-foreground/70 block">
                    Meta: {metaOrganizacaoFixa}% (fixa) - Preenchido pelo coordenador
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

                {/* Campo: Vendas Parceria - Auto (Agenda) */}
                <div className="space-y-1 col-span-2">
                  <Label className="flex items-center gap-1.5 text-xs">
                    Vendas Parceria
                    <Badge variant="outline" className="text-[10px] h-4 border-purple-500 text-purple-500">
                      <Sparkles className="h-2.5 w-2.5 mr-0.5" />
                      Auto (Agenda)
                    </Badge>
                  </Label>
                  <span className="text-[10px] text-muted-foreground/70 block">
                    Vendas em parceria com outros Closers
                    {agendaMetrics.data && (
                      <span className="ml-1 text-purple-500">• Agenda: {agendaMetrics.data.vendas_parceria}</span>
                    )}
                  </span>
                  <div className="h-8 px-3 py-1.5 rounded-md border bg-muted/50 flex items-center text-sm">
                    <span className="font-medium">{vendasParceria}</span>
                    <span className="text-muted-foreground/70 text-[10px] ml-1.5">(da Agenda)</span>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* ============ CAMPOS PARA SDR ============ */}
                {/* Campo: Reuniões Agendadas - Auto (Agenda) + Editável */}
                <div className="space-y-1">
                  <Label htmlFor="reunioes_agendadas" className="flex items-center gap-1.5 text-xs">
                    Agendamento
                    <Badge variant="outline" className="text-[10px] h-4 border-green-500 text-green-500">
                      <Calendar className="h-2.5 w-2.5 mr-0.5" />
                      Auto (Agenda)
                    </Badge>
                  </Label>
                  <span className="text-[10px] text-muted-foreground/70 block">
                    Meta: {metaAgendadasCalculada} ({sdrMetaDiaria}/dia × {diasUteisMes} dias)
                    {agendaMetrics.data && (
                      <span className="ml-1 text-green-500">• Agenda: {agendaMetrics.data.agendamentos}</span>
                    )}
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

                {/* Campo: Reuniões Realizadas - Auto (Agenda) + Editável */}
                <div className="space-y-1">
                  <Label htmlFor="reunioes_realizadas" className="flex items-center gap-1.5 text-xs">
                    Reuniões Realizadas
                    <Badge variant="outline" className="text-[10px] h-4 border-green-500 text-green-500">
                      <Calendar className="h-2.5 w-2.5 mr-0.5" />
                      Auto (Agenda)
                    </Badge>
                  </Label>
                  <span className="text-[10px] text-muted-foreground/70 block">
                    Meta: {Math.round(formData.reunioes_agendadas * 0.7)} (70% de {formData.reunioes_agendadas} agendadas)
                    {agendaMetrics.data && (
                      <span className="ml-1 text-green-500">• Agenda: {agendaMetrics.data.r1_realizada}</span>
                    )}
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

                {/* Campo: No-Shows - Auto (Agenda) + Editável */}
                <div className="space-y-1">
                  <Label htmlFor="no_shows" className="flex items-center gap-1.5 text-xs">
                    No-Shows
                    <Badge variant="outline" className="text-[10px] h-4 border-green-500 text-green-500">
                      <Calendar className="h-2.5 w-2.5 mr-0.5" />
                      Auto (Agenda)
                    </Badge>
                  </Label>
                  <span className="text-[10px] text-muted-foreground/70 block">
                    Taxa: {taxaNoShow}% / Max: 30%
                    {agendaMetrics.data && (
                      <span className="ml-1 text-green-500">• Agenda: {agendaMetrics.data.no_shows}</span>
                    )}
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

                {/* Campo: Tentativas de Ligações - Auto (Twilio) + Editável */}
                <div className="space-y-1">
                  <Label htmlFor="tentativas_ligacoes" className="flex items-center gap-1.5 text-xs">
                    Tentativas de Ligações
                    <Badge variant="outline" className="text-[10px] h-4 border-purple-500 text-purple-500">
                      <Phone className="h-2.5 w-2.5 mr-0.5" />
                      Auto (Twilio)
                    </Badge>
                  </Label>
                  <span className="text-[10px] text-muted-foreground/70 block">
                    Meta: {metaTentativasCalculada} (84/dia × {diasUteisMes} dias)
                    {callMetrics.data && (
                      <span className="ml-1 text-purple-500">• Twilio: {callMetrics.data.totalCalls}</span>
                    )}
                  </span>
                  <Input
                    id="tentativas_ligacoes"
                    type="number"
                    min="0"
                    value={formData.tentativas_ligacoes}
                    onChange={(e) => handleChange('tentativas_ligacoes', e.target.value)}
                    disabled={disabled}
                    className="h-8 text-sm"
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
              </>
            )}
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