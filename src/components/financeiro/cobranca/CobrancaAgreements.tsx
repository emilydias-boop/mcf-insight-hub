import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BillingAgreement, AGREEMENT_STATUS_LABELS } from '@/types/billing';
import { formatCurrency, formatDate } from '@/lib/formatters';

interface CobrancaAgreementsProps {
  agreements: BillingAgreement[];
  isLoading: boolean;
}

const statusColors: Record<string, string> = {
  em_aberto: 'bg-amber-100 text-amber-800',
  em_andamento: 'bg-blue-100 text-blue-800',
  cumprido: 'bg-green-100 text-green-800',
  quebrado: 'bg-red-100 text-red-800',
};

export const CobrancaAgreements = ({ agreements, isLoading }: CobrancaAgreementsProps) => {
  if (isLoading) return <div className="text-center py-4 text-muted-foreground">Carregando acordos...</div>;
  if (agreements.length === 0) return <div className="text-center py-4 text-muted-foreground">Nenhum acordo registrado</div>;

  return (
    <div className="space-y-3">
      {agreements.map((ag) => (
        <Card key={ag.id} className="border-border/50">
          <CardHeader className="py-3 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">
                Acordo - {formatDate(ag.data_negociacao)}
              </CardTitle>
              <Badge className={`text-xs ${statusColors[ag.status] || ''}`} variant="outline">
                {AGREEMENT_STATUS_LABELS[ag.status]}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-3 pt-0">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Responsável</span>
                <p className="font-medium">{ag.responsavel}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Valor original</span>
                <p className="font-medium">{formatCurrency(ag.valor_original_divida)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Novo valor</span>
                <p className="font-medium text-green-600">{formatCurrency(ag.novo_valor_negociado)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Parcelas</span>
                <p className="font-medium">{ag.quantidade_parcelas}x</p>
              </div>
            </div>
            {ag.motivo_negociacao && (
              <p className="text-xs text-muted-foreground mt-2">Motivo: {ag.motivo_negociacao}</p>
            )}
            {ag.observacoes && (
              <p className="text-xs text-muted-foreground mt-1">Obs: {ag.observacoes}</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
