import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getMultiplierRange } from '@/types/sdr-fechamento';
import { formatCurrency } from '@/lib/formatters';

interface SdrIndicatorCardProps {
  title: string;
  meta: number;
  realizado: number;
  pct: number;
  multiplicador: number;
  valorBase: number;
  valorFinal: number;
  isPercentage?: boolean;
}

export const SdrIndicatorCard = ({
  title,
  meta,
  realizado,
  pct,
  multiplicador,
  valorBase,
  valorFinal,
  isPercentage = false,
}: SdrIndicatorCardProps) => {
  const faixa = getMultiplierRange(pct);
  
  const getColorByPct = (pct: number) => {
    if (pct < 71) return 'text-red-400';
    if (pct < 86) return 'text-yellow-400';
    if (pct < 100) return 'text-orange-400';
    if (pct < 120) return 'text-green-400';
    return 'text-emerald-400';
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-muted-foreground">Meta:</span>
            <span className="ml-2 font-medium">
              {isPercentage ? `${meta}%` : meta.toLocaleString('pt-BR')}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Realizado:</span>
            <span className="ml-2 font-medium">
              {isPercentage ? `${realizado.toFixed(1)}%` : realizado.toLocaleString('pt-BR')}
            </span>
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <div className={`text-2xl font-bold ${getColorByPct(pct)}`}>
            {pct.toFixed(1)}%
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Faixa</div>
            <div className="text-sm font-medium">{faixa}</div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-border pt-3">
          <div>
            <div className="text-xs text-muted-foreground">Multiplicador</div>
            <div className="text-lg font-bold">{multiplicador}x</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">
              {formatCurrency(valorBase)} × {multiplicador}
            </div>
            <div className="text-lg font-bold text-primary">
              {formatCurrency(valorFinal)}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
