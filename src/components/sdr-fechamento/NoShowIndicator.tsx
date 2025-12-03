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
    if (taxaNoShow <= 20) return <CheckCircle className="h-5 w-5 text-green-500" />;
    if (taxaNoShow <= 30) return <CheckCircle className="h-5 w-5 text-yellow-500" />;
    if (taxaNoShow <= 50) return <AlertTriangle className="h-5 w-5 text-orange-500" />;
    return <XCircle className="h-5 w-5 text-red-500" />;
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
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between">
          <span>Taxa de No-Show</span>
          {getStatusIcon()}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Taxa atual */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Taxa Atual</span>
            <span className={cn('font-bold text-lg', getPerformanceColor())}>
              {taxaNoShow.toFixed(1)}%
            </span>
          </div>
          <div className="relative h-3 rounded-full bg-muted overflow-hidden">
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
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>0%</span>
            <span>Meta: ≤30%</span>
            <span>100%</span>
          </div>
        </div>

        {/* Detalhes */}
        <div className="grid grid-cols-2 gap-4 pt-2 border-t">
          <div>
            <div className="text-xs text-muted-foreground">No-Shows / Agendadas</div>
            <div className="font-medium">{noShows} / {agendadas}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Performance (inverso)</div>
            <div className={cn('font-medium', getPerformanceColor())}>
              {performance.toFixed(0)}%
            </div>
          </div>
        </div>

        {/* Multiplicador e valor */}
        {valorBase > 0 && (
          <div className="grid grid-cols-2 gap-4 pt-2 border-t">
            <div>
              <div className="text-xs text-muted-foreground">Multiplicador</div>
              <div className="font-bold text-lg">{multiplicador}x</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Valor Final</div>
              <div className="font-bold text-lg text-primary">
                {formatCurrency(valorFinal)}
              </div>
            </div>
          </div>
        )}

        {/* Explicação */}
        <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
          <strong>Cálculo inverso:</strong> Quanto menor a taxa de no-show, maior a performance.
          Taxa ≤30% = 100-150%, acima de 30% a performance decresce.
        </div>
      </CardContent>
    </Card>
  );
};
