import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Save, RefreshCw } from 'lucide-react';
import { SdrMonthKpi, SdrCompPlan } from '@/types/sdr-fechamento';

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

  const taxaNoShow = formData.reunioes_agendadas > 0
    ? ((formData.no_shows / formData.reunioes_agendadas) * 100).toFixed(1)
    : '0.0';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Editar KPIs</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="reunioes_agendadas">
                Reuniões Agendadas
                {compPlan && (
                  <span className="text-muted-foreground ml-2">
                    (Meta: {compPlan.meta_reunioes_agendadas})
                  </span>
                )}
              </Label>
              <Input
                id="reunioes_agendadas"
                type="number"
                min="0"
                value={formData.reunioes_agendadas}
                onChange={(e) => handleChange('reunioes_agendadas', e.target.value)}
                disabled={disabled}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reunioes_realizadas">
                Reuniões Realizadas
                {compPlan && (
                  <span className="text-muted-foreground ml-2">
                    (Meta: {compPlan.meta_reunioes_realizadas})
                  </span>
                )}
              </Label>
              <Input
                id="reunioes_realizadas"
                type="number"
                min="0"
                value={formData.reunioes_realizadas}
                onChange={(e) => handleChange('reunioes_realizadas', e.target.value)}
                disabled={disabled}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="no_shows">
                No-Shows
                <span className="text-muted-foreground ml-2">
                  (Taxa: {taxaNoShow}% / Max: 30%)
                </span>
              </Label>
              <Input
                id="no_shows"
                type="number"
                min="0"
                value={formData.no_shows}
                onChange={(e) => handleChange('no_shows', e.target.value)}
                disabled={disabled}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tentativas_ligacoes">
                Tentativas de Ligações
                {compPlan && compPlan.meta_tentativas > 0 && (
                  <span className="text-muted-foreground ml-2">
                    (Meta: {compPlan.meta_tentativas})
                  </span>
                )}
              </Label>
              <Input
                id="tentativas_ligacoes"
                type="number"
                min="0"
                value={formData.tentativas_ligacoes}
                onChange={(e) => handleChange('tentativas_ligacoes', e.target.value)}
                disabled={disabled}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="score_organizacao">
                Score de Organização (%)
                {compPlan && (
                  <span className="text-muted-foreground ml-2">
                    (Meta: {compPlan.meta_organizacao}%)
                  </span>
                )}
              </Label>
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

            <div className="space-y-2">
              <Label>Intermediações de Contrato</Label>
              <div className="h-10 px-3 py-2 rounded-md border bg-muted/50 flex items-center">
                <span className="font-medium">{intermediacoes}</span>
                <span className="text-muted-foreground ml-2">(calculado automaticamente)</span>
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
