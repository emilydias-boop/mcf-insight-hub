import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { calculateNoShowPerformance, getMultiplier } from '@/types/sdr-fechamento';
import { formatCurrency } from '@/lib/formatters';
import { cn } from '@/lib/utils';

interface NoShowIndicatorProps {
  agendadas: number;
  noShows: number;
  valorBase?: number;
  valorFinal?: number;
}

export const NoShowIndicator = ({
  agendadas,
  noShows,
  valorBase = 0,
  valorFinal = 0,
}: NoShowIndicatorProps) => {
  const taxaNoShow = agendadas > 0 ? (noShows / agendadas) * 100 : 0;
  const performance = calculateNoShowPerformance(noShows, agendadas);
  const multiplicador = getMultiplier(performance);

  // Determina o status
  const isGood = taxaNoShow <= 30;
  const isCritical = taxaNoShow > 50;

  const getStatusIcon = () => {
    if (taxaNoShow <= 20) return <CheckCircle className="h-4 w-4 text-green-500" />;
    if (taxaNoShow <= 30) return <CheckCircle className="h-4 w-4 text-yellow-500" />;
    if (taxaNoShow <= 50) return <AlertTriangle className="h-4 w-4 text-orange-500" />;
    return <XCircle className="h-4 w-4 text-red-500" />;
  };

  const getPerformanceColor = () => {
    if (performance >= 100) return 'text-green-500';
    if (performance >= 70) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getProgressColor = () => {
    if (taxaNoShow <= 20) return 'bg-green-500';
    if (taxaNoShow <= 30) return 'bg-yellow-500';
    if (taxaNoShow <= 50) return 'bg-orange-500';
    return 'bg-red-500';
  };

  return (
    <Card className={cn(
      'border-2',
      isGood ? 'border-green-500/20' : isCritical ? 'border-red-500/20' : 'border-orange-500/20'
    )}>
      <CardHeader className="pb-1 pt-3">
        <CardTitle className="text-xs font-medium flex items-center justify-between">
          <span className="text-muted-foreground">Taxa de No-Show</span>
          {getStatusIcon()}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-0 pb-3">
        {/* Taxa atual */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground/70">Taxa Atual</span>
            <span className={cn('font-semibold text-base', getPerformanceColor())}>
              {taxaNoShow.toFixed(1)}%
            </span>
          </div>
          <div className="relative h-2.5 rounded-full bg-muted overflow-hidden">
            <div 
              className={cn('h-full transition-all', getProgressColor())}
              style={{ width: `${Math.min(taxaNoShow, 100)}%` }}
            />
            {/* Linha de referência em 30% */}
            <div 
              className="absolute top-0 bottom-0 w-0.5 bg-foreground/50"
              style={{ left: '30%' }}
            />
          </div>
          <div className="flex items-center justify-between text-[9px] text-muted-foreground/60">
            <span>0%</span>
            <span>Meta: ≤30%</span>
            <span>100%</span>
          </div>
        </div>

        {/* Detalhes */}
        <div className="grid grid-cols-2 gap-3 pt-1.5 border-t">
          <div>
            <div className="text-[10px] text-muted-foreground/70">No-Shows / Agendadas</div>
            <div className="text-xs font-medium">{noShows} / {agendadas}</div>
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground/70">Performance (inverso)</div>
            <div className={cn('text-xs font-medium', getPerformanceColor())}>
              {performance.toFixed(0)}%
            </div>
          </div>
        </div>

        {/* Multiplicador e valor */}
        {valorBase > 0 && (
          <div className="grid grid-cols-2 gap-3 pt-1.5 border-t">
            <div>
              <div className="text-[10px] text-muted-foreground/70">Multiplicador</div>
              <div className="font-bold text-base">{multiplicador}x</div>
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground/70">Valor Final</div>
              <div className="font-bold text-base text-primary">
                {formatCurrency(valorFinal)}
              </div>
            </div>
          </div>
        )}

        {/* Explicação */}
        <div className="text-[10px] text-muted-foreground/70 bg-muted/50 p-1.5 rounded">
          <strong>Cálculo inverso:</strong> Quanto menor a taxa de no-show, maior a performance.
          Taxa ≤30% = 100-150%, acima de 30% a performance decresce.
        </div>
      </CardContent>
    </Card>
  );
};