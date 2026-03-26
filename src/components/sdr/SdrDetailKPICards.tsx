import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, TrendingDown, CheckCircle2, Info } from "lucide-react";
import { MetricWithMeta } from "@/hooks/useSdrPerformanceData";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SdrDetailKPICardsProps {
  metrics: MetricWithMeta[];
  isLoading?: boolean;
}

const formatDuration = (seconds: number): string => {
  if (seconds === 0) return "0s";
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (minutes === 0) return `${secs}s`;
  return `${minutes}m ${secs}s`;
};

const tooltipDescriptions: Record<string, string> = {
  agendamentos: "Total de reuniões agendadas no período selecionado vs meta calculada.",
  r1_agendada: "Reuniões de 1ª rodada com status 'agendada' no período.",
  r1_realizada: "Reuniões de 1ª rodada efetivamente realizadas no período.",
  taxaNoShow: "Percentual de no-shows sobre o total de agendamentos. Meta: máx 30%. Quanto menor, melhor.",
  contratos: "Contratos pagos originados dos agendamentos deste SDR.",
  ligacoes: "Total de ligações realizadas no período.",
  contatos: "Ligações que foram atendidas (contato efetivo).",
  taxa_contato: "Percentual de ligações que resultaram em contato efetivo.",
  tempo_medio: "Tempo médio de duração das ligações atendidas.",
};

function KPICard({ metric }: { metric: MetricWithMeta }) {
  const hasMeta = metric.meta > 0;
  const progressPct = hasMeta ? Math.min(metric.attainment, 100) : 0;

  const formattedValue =
    metric.format === "percent"
      ? `${metric.realized.toFixed(1)}%`
      : metric.format === "duration"
        ? formatDuration(metric.realized)
        : metric.realized.toFixed(0);

  const formattedMeta =
    metric.format === "percent"
      ? `${metric.meta.toFixed(0)}%`
      : metric.meta.toFixed(0);

  const absGap = Math.abs(metric.gap);
  const isInverted = metric.invertGap === true;

  const gapLabel =
    metric.gap < 0
      ? isInverted
        ? `Abaixo: -${metric.format === "percent" ? `${absGap.toFixed(1)}%` : absGap.toFixed(0)}`
        : `Faltam ${metric.format === "percent" ? `${absGap.toFixed(1)}%` : absGap.toFixed(0)}`
      : metric.gap > 0
        ? `Acima: +${metric.format === "percent" ? `${absGap.toFixed(1)}%` : absGap.toFixed(0)}`
        : "Na meta ✓";

  const gapColor = isInverted
    ? (metric.gap > 0 ? "text-destructive" : "text-green-500")
    : (metric.gap < 0 ? "text-destructive" : "text-green-500");

  const attainmentColor = isInverted
    ? (metric.attainment <= 100 ? "text-green-500" : metric.attainment <= 130 ? "text-yellow-500" : "text-destructive")
    : (metric.attainment >= 100 ? "text-green-500" : metric.attainment >= 70 ? "text-yellow-500" : "text-destructive");

  const tooltipText = tooltipDescriptions[metric.key] || `Métrica: ${metric.label}`;

  return (
    <Card className="bg-card border-border">
      <CardContent className="p-4 space-y-2.5">
        {/* Title + tooltip */}
        <div className="flex items-center justify-between">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">
            {metric.label}
          </p>
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-muted-foreground/50 cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[220px] text-xs">
                {tooltipText}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Value */}
        <p className="text-2xl font-bold text-foreground">{formattedValue}</p>

        {/* Progress bar + attainment */}
        {hasMeta && (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Progress value={progressPct} className="h-1.5 flex-1" />
              <span className={cn("text-xs font-semibold tabular-nums min-w-[32px] text-right", attainmentColor)}>
                {metric.attainment.toFixed(0)}%
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">Meta: {formattedMeta}</p>
          </div>
        )}

        {/* Extra breakdown (e.g. Contatos / Sem contato) */}
        {metric.extra && metric.key === "totalCalls" && (
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground pt-0.5 border-t border-border">
            <span>Contatos: <strong className="text-green-500">{metric.extra.answered}</strong></span>
            <span>·</span>
            <span>Sem contato: <strong className="text-orange-500">{metric.extra.unanswered}</strong></span>
          </div>
        )}

        {/* Gap + comparison */}
        <div className="flex items-center justify-between text-xs pt-0.5">
          {hasMeta ? (
            <span className={cn("font-medium flex items-center gap-1", gapColor)}>
              {metric.gap === 0 && <CheckCircle2 className="h-3 w-3" />}
              {gapLabel}
            </span>
          ) : (
            <span />
          )}

          {metric.compVariation !== null && (
            <span
              className={cn(
                "flex items-center gap-0.5 text-[11px]",
                metric.compVariation >= 0 ? "text-green-500" : "text-destructive"
              )}
            >
              {metric.compVariation >= 0 ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              {metric.compVariation > 0 ? "+" : ""}
              {metric.compVariation.toFixed(0)}%
              <span className="text-muted-foreground ml-0.5">vs ant.</span>
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function SdrDetailKPICards({ metrics, isLoading }: SdrDetailKPICardsProps) {
  if (isLoading || metrics.length === 0) {
    return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-3">
      {[...Array(6)].map((_, i) => (
          <Card key={i} className="bg-card border-border animate-pulse">
            <CardContent className="p-4 h-[140px]" />
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-3">
      {metrics.map((metric) => (
        <KPICard key={metric.key} metric={metric} />
      ))}
    </div>
  );
}
