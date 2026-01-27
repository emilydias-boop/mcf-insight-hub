import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Layers, GitBranch, CheckCircle2, Users, Webhook } from 'lucide-react';
import { WizardData } from './types';

interface WizardStepReviewProps {
  data: WizardData;
}

export const WizardStepReview = ({ data }: WizardStepReviewProps) => {
  const totalPercentage = data.distribution
    .filter((d) => d.is_active)
    .reduce((sum, d) => sum + d.percentage, 0);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Revisão Final</h3>
        <p className="text-sm text-muted-foreground">
          Revise todas as configurações antes de criar o pipeline.
        </p>
      </div>

      {/* Info Summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            {data.type === 'group' ? <Layers className="h-5 w-5" /> : <GitBranch className="h-5 w-5" />}
            Informações Básicas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Tipo:</span>
            <Badge variant="outline">
              {data.type === 'group' ? 'Pipeline (Grupo)' : 'Origin (Sub-pipeline)'}
            </Badge>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Nome:</span>
            <span className="font-medium">{data.name}</span>
          </div>
          {data.display_name && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Nome de Exibição:</span>
              <span>{data.display_name}</span>
            </div>
          )}
          {data.description && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Descrição:</span>
              <span className="text-right max-w-[200px] truncate">{data.description}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stages Summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5" />
            Etapas do Kanban ({data.stages.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {data.stages.map((stage, index) => (
              <Badge
                key={stage.id}
                variant="outline"
                className="gap-2"
                style={{ borderColor: stage.color }}
              >
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: stage.color }}
                />
                {stage.name}
                {stage.stage_type === 'won' && '✅'}
                {stage.stage_type === 'lost' && '❌'}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Distribution Summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-5 w-5" />
            Distribuição de Leads
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.distribution.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Nenhuma distribuição configurada. Leads não serão atribuídos automaticamente.
            </p>
          ) : (
            <div className="space-y-2">
              {data.distribution
                .filter((d) => d.is_active)
                .map((dist) => (
                  <div key={dist.user_email} className="flex justify-between items-center">
                    <span className="truncate">{dist.user_name}</span>
                    <Badge variant="secondary">{dist.percentage}%</Badge>
                  </div>
                ))}
              <div className="pt-2 border-t flex justify-between font-medium">
                <span>Total:</span>
                <span className={totalPercentage === 100 ? 'text-green-600' : 'text-amber-600'}>
                  {totalPercentage}%
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Integrations Summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Webhook className="h-5 w-5" />
            Integrações
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!data.integration.enabled ? (
            <p className="text-muted-foreground text-sm">
              Nenhum webhook configurado.
            </p>
          ) : (
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Webhook:</span>
                <Badge variant="default" className="bg-green-500">Ativado</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Slug:</span>
                <span className="font-mono text-sm">{data.integration.slug}</span>
              </div>
              {data.integration.auto_tags.length > 0 && (
                <div className="flex justify-between items-start">
                  <span className="text-muted-foreground">Tags:</span>
                  <div className="flex flex-wrap gap-1 justify-end">
                    {data.integration.auto_tags.map((tag) => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
