import { AlertTriangle } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';

interface Props {
  parcelasAtraso: number;
  cotasComAtraso: number;
  valorAberto: number;
}

export function PagamentosAlerts({ parcelasAtraso, cotasComAtraso, valorAberto }: Props) {
  if (parcelasAtraso === 0) return null;

  return (
    <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
      <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <span><strong className="text-destructive">{parcelasAtraso}</strong> parcelas em atraso</span>
        <span><strong className="text-destructive">{cotasComAtraso}</strong> cotas com atraso</span>
        <span><strong className="text-destructive">{formatCurrency(valorAberto)}</strong> em aberto</span>
      </div>
    </div>
  );
}
