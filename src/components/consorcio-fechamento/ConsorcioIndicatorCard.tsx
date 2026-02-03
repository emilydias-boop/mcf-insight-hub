import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency } from '@/lib/formatters';
import { cn } from '@/lib/utils';

interface ConsorcioIndicatorCardProps {
  label: string;
  peso: string;
  meta: number;
  realizado: number;
  pct: number;
  mult: number;
  valorFinal: number;
  tipo?: 'currency' | 'score';
}

export function ConsorcioIndicatorCard({
  label,
  peso,
  meta,
  realizado,
  pct,
  mult,
  valorFinal,
  tipo = 'currency',
}: ConsorcioIndicatorCardProps) {
  const formatValue = (v: number) => 
    tipo === 'currency' ? formatCurrency(v) : v.toFixed(0);
  
  const pctColor = pct >= 100 
    ? 'text-green-400' 
    : pct >= 70 
      ? 'text-yellow-400' 
      : 'text-red-400';

  return (
    <Card className="bg-card border-border">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-medium text-sm">{label}</h4>
          <span className="text-xs text-muted-foreground">({peso})</span>
        </div>
        
        <div className="grid grid-cols-5 gap-2 text-center text-sm">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Meta</p>
            <p className="font-medium">{formatValue(meta)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Realizado</p>
            <p className="font-medium">{formatValue(realizado)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">%</p>
            <p className={cn('font-medium', pctColor)}>{pct.toFixed(0)}%</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Mult</p>
            <p className="font-medium">×{mult.toFixed(1)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Valor</p>
            <p className="font-bold text-primary">{formatCurrency(valorFinal)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
