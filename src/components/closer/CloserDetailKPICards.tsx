import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, Minus, Users, CheckCircle, XCircle, DollarSign, ArrowRightLeft, Calendar } from "lucide-react";
import { R1CloserMetric } from "@/hooks/useR1CloserMetrics";
import { CloserTeamAverages } from "@/hooks/useCloserDetailData";

interface CloserDetailKPICardsProps {
  metrics: R1CloserMetric | null;
  teamAverages: CloserTeamAverages;
  isLoading: boolean;
}

function KPICard({
  title,
  value,
  average,
  icon: Icon,
  format: formatFn = (v: number) => v.toString(),
  lowerIsBetter = false,
}: {
  title: string;
  value: number;
  average: number;
  icon: React.ElementType;
  format?: (v: number) => string;
  lowerIsBetter?: boolean;
}) {
  const diff = value - average;
  const isAboveAverage = lowerIsBetter ? diff < 0 : diff > 0;
  const isEqual = Math.abs(diff) < 0.01;

  return (
    <Card className="bg-card border-border">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground">{title}</span>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="text-2xl font-bold text-foreground">{formatFn(value)}</div>
        <div className="flex items-center gap-1 mt-1 text-xs">
          {isEqual ? (
            <>
              <Minus className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">Na média</span>
            </>
          ) : isAboveAverage ? (
            <>
              <TrendingUp className="h-3 w-3 text-green-400" />
              <span className="text-green-400">
                {lowerIsBetter ? formatFn(Math.abs(diff)) + ' abaixo' : formatFn(Math.abs(diff)) + ' acima'} da média
              </span>
            </>
          ) : (
            <>
              <TrendingDown className="h-3 w-3 text-red-400" />
              <span className="text-red-400">
                {lowerIsBetter ? formatFn(Math.abs(diff)) + ' acima' : formatFn(Math.abs(diff)) + ' abaixo'} da média
              </span>
            </>
          )}
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">
          Média: {formatFn(average)}
        </div>
      </CardContent>
    </Card>
  );
}

export function CloserDetailKPICards({
  metrics,
  teamAverages,
  isLoading,
}: CloserDetailKPICardsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        {[...Array(7)].map((_, i) => (
          <Card key={i} className="bg-card border-border">
            <CardContent className="p-4">
              <Skeleton className="h-4 w-20 mb-2" />
              <Skeleton className="h-8 w-16 mb-2" />
              <Skeleton className="h-3 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const m = metrics || {
    r1_agendada: 0,
    r1_realizada: 0,
    noshow: 0,
    contrato_pago: 0,
    outside: 0,
    r2_agendada: 0,
  };

  // Calculate rates
  const taxaConversao = m.r1_realizada > 0 
    ? (m.contrato_pago / m.r1_realizada) * 100 
    : 0;
  
  const taxaNoShow = m.r1_agendada > 0 
    ? (m.noshow / m.r1_agendada) * 100 
    : 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
      <KPICard
        title="R1 Agendada"
        value={m.r1_agendada}
        average={teamAverages.avgR1Agendada}
        icon={Users}
      />
      <KPICard
        title="R1 Realizada"
        value={m.r1_realizada}
        average={teamAverages.avgR1Realizada}
        icon={CheckCircle}
      />
      <KPICard
        title="No-Show"
        value={m.noshow}
        average={teamAverages.avgNoShow}
        icon={XCircle}
        lowerIsBetter
      />
      <KPICard
        title="Taxa No-Show"
        value={taxaNoShow}
        average={teamAverages.avgTaxaNoShow}
        icon={XCircle}
        format={(v) => `${v.toFixed(1)}%`}
        lowerIsBetter
      />
      <KPICard
        title="Contrato Pago"
        value={m.contrato_pago}
        average={teamAverages.avgContratoPago}
        icon={DollarSign}
      />
      <KPICard
        title="Outside"
        value={m.outside}
        average={teamAverages.avgOutside}
        icon={ArrowRightLeft}
      />
      <KPICard
        title="Taxa Conversão"
        value={taxaConversao}
        average={teamAverages.avgTaxaConversao}
        icon={TrendingUp}
        format={(v) => `${v.toFixed(1)}%`}
      />
    </div>
  );
}
