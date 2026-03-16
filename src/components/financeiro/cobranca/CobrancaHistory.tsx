import { BillingHistoryItem, HISTORY_TYPE_LABELS } from '@/types/billing';
import { formatCurrency, formatDateTime } from '@/lib/formatters';
import { Badge } from '@/components/ui/badge';

interface CobrancaHistoryProps {
  history: BillingHistoryItem[];
  isLoading: boolean;
}

const typeColors: Record<string, string> = {
  entrada_paga: 'bg-green-100 text-green-800',
  parcela_paga: 'bg-green-100 text-green-800',
  parcela_atrasada: 'bg-red-100 text-red-800',
  boleto_gerado: 'bg-blue-100 text-blue-800',
  tentativa_cobranca: 'bg-amber-100 text-amber-800',
  acordo_realizado: 'bg-purple-100 text-purple-800',
  cancelamento: 'bg-gray-100 text-gray-800',
  quitacao: 'bg-emerald-100 text-emerald-800',
  observacao: 'bg-slate-100 text-slate-800',
};

export const CobrancaHistory = ({ history, isLoading }: CobrancaHistoryProps) => {
  if (isLoading) return <div className="text-center py-4 text-muted-foreground">Carregando histórico...</div>;
  if (history.length === 0) return <div className="text-center py-4 text-muted-foreground">Nenhum registro no histórico</div>;

  return (
    <div className="space-y-2">
      {history.map((item) => (
        <div key={item.id} className="flex items-start gap-3 p-3 rounded-lg border border-border/50 bg-card">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={`text-xs ${typeColors[item.tipo] || ''}`} variant="outline">
                {HISTORY_TYPE_LABELS[item.tipo]}
              </Badge>
              {item.valor != null && (
                <span className="text-sm font-medium">{formatCurrency(item.valor)}</span>
              )}
              {item.responsavel && (
                <span className="text-xs text-muted-foreground">por {item.responsavel}</span>
              )}
            </div>
            {item.descricao && <p className="text-sm text-muted-foreground mt-1">{item.descricao}</p>}
          </div>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {formatDateTime(item.created_at)}
          </span>
        </div>
      ))}
    </div>
  );
};
