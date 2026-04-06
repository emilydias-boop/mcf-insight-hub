import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { getMultiplierConsorcio } from '@/types/consorcio-fechamento';

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

// Faixas específicas do Consórcio
function getMultiplierRangeConsorcio(pct: number): string {
  if (pct <= 70) return '0-70%';
  if (pct <= 85) return '71-85%';
  if (pct <= 99) return '86-99%';
  if (pct <= 119) return '100-119%';
  return '120%+';
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

  const faixa = getMultiplierRangeConsorcio(pct);

  const getColorByPct = (pct: number) => {
    if (pct <= 70) return 'text-red-400';
    if (pct <= 85) return 'text-yellow-400';
    if (pct <= 99) return 'text-orange-400';
    if (pct <= 119) return 'text-green-400';
    return 'text-emerald-400';
  };

  const getProgressColor = (pct: number) => {
    if (pct <= 70) return 'bg-red-500';
    if (pct <= 85) return 'bg-yellow-500';
    if (pct <= 99) return 'bg-orange-500';
    if (pct <= 119) return 'bg-green-500';
    return 'bg-emerald-500';
  };

  const progressValue = Math.min(pct, 150);

  // Determine the valor base (peso × variavel) from valorFinal / mult
  const valorBase = mult > 0 ? valorFinal / mult : 0;

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-1 pt-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xs font-medium text-muted-foreground">
            {label}
          </CardTitle>
          <Badge variant="outline" className="text-[10px] h-5">
            Peso: {peso}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 pt-0 pb-3">
        <div className="grid grid-cols-2 gap-1.5 text-xs">
          <div>
            <span className="text-muted-foreground/70">Meta:</span>
            <span className="ml-1.5 font-medium">{formatValue(meta)}</span>
          </div>
          <div>
            <span className="text-muted-foreground/70">Realizado:</span>
            <span className="ml-1.5 font-medium">{formatValue(realizado)}</span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-0.5">
          <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className={cn(
                "h-full transition-all duration-500",
                getProgressColor(pct)
              )}
              style={{ width: `${Math.min((progressValue / 150) * 100, 100)}%` }}
            />
            {/* 100% marker */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-foreground/50"
              style={{ left: `${(100 / 150) * 100}%` }}
            />
          </div>
          <div className="flex justify-between text-[9px] text-muted-foreground/60">
            <span>0%</span>
            <span>70%</span>
            <span>100%</span>
            <span>150%</span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className={cn("text-xl font-bold", getColorByPct(pct))}>
            {pct.toFixed(1)}%
          </div>
          <div className="text-right">
            <div className="text-[10px] text-muted-foreground/70">Faixa</div>
            <div className="text-xs font-medium">{faixa}</div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-border pt-2">
          <div>
            <div className="text-[10px] text-muted-foreground/70">Multiplicador</div>
            <div className="text-base font-bold">{mult}x</div>
          </div>
          <div className="text-right">
            {valorBase > 0 && (
              <div className="text-[10px] text-muted-foreground/70">
                {formatCurrency(valorBase)} × {mult}
              </div>
            )}
            <div className="text-base font-bold text-primary">
              {formatCurrency(valorFinal)}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
