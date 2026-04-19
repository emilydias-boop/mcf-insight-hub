import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, Minus, Users, CheckCircle, XCircle, FileText, Package, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export interface ConsorcioCloserMetrics {
  r1_agendada: number;
  r1_realizada: number;
  noshow: number;
  propostas_enviadas: number;
  produtos_fechados: number;
}

export interface ConsorcioTeamAverages {
  avgR1Agendada: number;
  avgR1Realizada: number;
  avgNoShow: number;
  avgTaxaNoShow: number;
  avgPropostas: number;
  avgProdutos: number;
  avgTaxaConversao: number;
}

interface Props {
  metrics: ConsorcioCloserMetrics | null;
  teamAverages: ConsorcioTeamAverages;
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

export function CloserConsorcioDetailKPICards({ metrics, teamAverages, isLoading }: Props) {
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
    propostas_enviadas: 0,
    produtos_fechados: 0,
  };

  const taxaNoShow = m.r1_agendada > 0 ? (m.noshow / m.r1_agendada) * 100 : 0;
  const taxaConversao = m.r1_realizada > 0 ? (m.produtos_fechados / m.r1_realizada) * 100 : 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
      <KPICard title="R1 Agendada" value={m.r1_agendada} average={teamAverages.avgR1Agendada} icon={Users} />
      <KPICard title="R1 Realizada" value={m.r1_realizada} average={teamAverages.avgR1Realizada} icon={CheckCircle} />
      <KPICard title="No-Show" value={m.noshow} average={teamAverages.avgNoShow} icon={XCircle} lowerIsBetter />
      <KPICard
        title="Taxa No-Show"
        value={taxaNoShow}
        average={teamAverages.avgTaxaNoShow}
        icon={XCircle}
        format={(v) => `${v.toFixed(1)}%`}
        lowerIsBetter
      />
      <KPICard title="Propostas Enviadas" value={m.propostas_enviadas} average={teamAverages.avgPropostas} icon={FileText} />
      <KPICard title="Produtos Fechados" value={m.produtos_fechados} average={teamAverages.avgProdutos} icon={Package} />
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
