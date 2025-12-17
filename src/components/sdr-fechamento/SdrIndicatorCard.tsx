import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getMultiplierRange } from '@/types/sdr-fechamento';
import { formatCurrency } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { AlertCircle, Zap } from 'lucide-react';

interface SdrIndicatorCardProps {
  title: string;
  meta: number;
  realizado: number;
  pct: number;
  multiplicador: number;
  valorBase: number;
  valorFinal: number;
  isPercentage?: boolean;
  isManual?: boolean;
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
  isManual = false,
}: SdrIndicatorCardProps) => {
  const faixa = getMultiplierRange(pct);
  const needsInput = isManual && realizado === 0 && meta > 0;
  
  const getColorByPct = (pct: number) => {
    if (pct < 71) return 'text-red-400';
    if (pct < 86) return 'text-yellow-400';
    if (pct < 100) return 'text-orange-400';
    if (pct < 120) return 'text-green-400';
    return 'text-emerald-400';
  };

  const getProgressColor = (pct: number) => {
    if (pct < 71) return 'bg-red-500';
    if (pct < 86) return 'bg-yellow-500';
    if (pct < 100) return 'bg-orange-500';
    if (pct < 120) return 'bg-green-500';
    return 'bg-emerald-500';
  };

  const progressValue = Math.min(pct, 150);

  return (
    <Card className={cn(
      "bg-card border-border",
      needsInput && "border-yellow-500/50 bg-yellow-500/5"
    )}>
      <CardHeader className="pb-1 pt-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xs font-medium text-muted-foreground">
            {title}
          </CardTitle>
          <div className="flex items-center gap-1">
            {isManual ? (
              <Badge variant="outline" className="text-[10px] h-5 border-yellow-500/50 text-yellow-500">
                Manual
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-[10px] h-5">
                <Zap className="h-2.5 w-2.5 mr-0.5" />
                Auto
              </Badge>
            )}
          </div>
        </div>
        {needsInput && (
          <div className="flex items-center gap-1 mt-1 text-yellow-500 text-[10px]">
            <AlertCircle className="h-3 w-3" />
            <span>Pendente de preenchimento</span>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-2 pt-0 pb-3">
        <div className="grid grid-cols-2 gap-1.5 text-xs">
          <div>
            <span className="text-muted-foreground/70">Meta:</span>
            <span className="ml-1.5 font-medium">
              {isPercentage ? `${meta}%` : meta.toLocaleString('pt-BR')}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground/70">Realizado:</span>
            <span className={cn(
              "ml-1.5 font-medium",
              needsInput && "text-yellow-500"
            )}>
              {isPercentage ? `${realizado.toFixed(1)}%` : realizado.toLocaleString('pt-BR')}
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-0.5">
          <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-secondary">
            <div 
              className={cn(
                "h-full transition-all duration-500",
                needsInput ? "bg-yellow-500/30" : getProgressColor(pct)
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
          <div className={cn(
            "text-xl font-bold",
            needsInput ? "text-yellow-500" : getColorByPct(pct)
          )}>
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
            <div className="text-base font-bold">{multiplicador}x</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-muted-foreground/70">
              {formatCurrency(valorBase)} × {multiplicador}
            </div>
            <div className="text-base font-bold text-primary">
              {formatCurrency(valorFinal)}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};