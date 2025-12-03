import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Save, RefreshCw, Cloud } from 'lucide-react';
import { SdrMonthKpi, SdrCompPlan } from '@/types/sdr-fechamento';
import { useSyncSdrKpis } from '@/hooks/useSyncSdrKpis';

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
    }
  }, [kpi]);

  const handleChange = (field: string, value: string) => {
    const numValue = parseInt(value) || 0;
    setFormData(prev => ({ ...prev, [field]: numValue }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
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

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Editar KPIs</CardTitle>
        <Button
          variant="outline"
          size="sm"
          onClick={handleSyncFromClint}
          disabled={disabled || syncKpis.isPending}
        >
          {syncKpis.isPending ? (
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Cloud className="h-4 w-4 mr-2" />
          )}
          Sincronizar do Clint
        </Button>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Campo Automático: Reuniões Agendadas */}
            <div className="space-y-2">
              <Label htmlFor="reunioes_agendadas" className="flex items-center gap-2">
                Reuniões Agendadas
                <Badge variant="secondary" className="text-xs">Automático</Badge>
              </Label>
              {compPlan && (
                <span className="text-xs text-muted-foreground block">
                  Meta: {compPlan.meta_reunioes_agendadas}
                </span>
              )}
              <Input
                id="reunioes_agendadas"
                type="number"
                min="0"
                value={formData.reunioes_agendadas}
                readOnly
                className="bg-muted/50"
              />
            </div>

            {/* Campo Automático: Reuniões Realizadas */}
            <div className="space-y-2">
              <Label htmlFor="reunioes_realizadas" className="flex items-center gap-2">
                Reuniões Realizadas
                <Badge variant="secondary" className="text-xs">Automático</Badge>
              </Label>
              {compPlan && (
                <span className="text-xs text-muted-foreground block">
                  Meta: {compPlan.meta_reunioes_realizadas}
                </span>
              )}
              <Input
                id="reunioes_realizadas"
                type="number"
                min="0"
                value={formData.reunioes_realizadas}
                readOnly
                className="bg-muted/50"
              />
            </div>

            {/* Campo Automático: No-Shows */}
            <div className="space-y-2">
              <Label htmlFor="no_shows" className="flex items-center gap-2">
                No-Shows
                <Badge variant="secondary" className="text-xs">Automático</Badge>
              </Label>
              <span className="text-xs text-muted-foreground block">
                Taxa: {taxaNoShow}% / Max: 30%
              </span>
              <Input
                id="no_shows"
                type="number"
                min="0"
                value={formData.no_shows}
                readOnly
                className="bg-muted/50"
              />
            </div>

            {/* Campo Manual: Tentativas de Ligações */}
            <div className="space-y-2">
              <Label htmlFor="tentativas_ligacoes" className="flex items-center gap-2">
                Tentativas de Ligações
                <Badge variant="outline" className="text-xs">Manual</Badge>
              </Label>
              {compPlan && compPlan.meta_tentativas > 0 && (
                <span className="text-xs text-muted-foreground block">
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
              />
            </div>

            {/* Campo Manual: Score de Organização */}
            <div className="space-y-2">
              <Label htmlFor="score_organizacao" className="flex items-center gap-2">
                Score de Organização (%)
                <Badge variant="outline" className="text-xs">Manual</Badge>
              </Label>
              {compPlan && (
                <span className="text-xs text-muted-foreground block">
                  Meta: {compPlan.meta_organizacao}%
                </span>
              )}
              <Input
                id="score_organizacao"
                type="number"
                min="0"
                max="100"
                value={formData.score_organizacao}
                onChange={(e) => handleChange('score_organizacao', e.target.value)}
                disabled={disabled}
              />
            </div>

            {/* Campo Automático: Intermediações de Contrato */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                Intermediações de Contrato
                <Badge variant="secondary" className="text-xs">Automático</Badge>
              </Label>
              <div className="h-10 px-3 py-2 rounded-md border bg-muted/50 flex items-center">
                <span className="font-medium">{intermediacoes}</span>
                <span className="text-muted-foreground text-xs ml-2">(calculado da Hubla)</span>
              </div>
            </div>
          </div>

          <Button type="submit" disabled={disabled || isSaving} className="w-full">
            {isSaving ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Salvar e Recalcular
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
