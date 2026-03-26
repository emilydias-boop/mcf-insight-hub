import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, TrendingDown } from "lucide-react";
import { MetricWithMeta } from "@/hooks/useSdrPerformanceData";
import { cn } from "@/lib/utils";

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

function KPICard({ metric }: { metric: MetricWithMeta }) {
  const hasMeta = metric.meta > 0;
  const progressPct = hasMeta ? Math.min(metric.attainment, 100) : 0;
  const isPositive = metric.gap >= 0;

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

  return (
    <Card className="bg-card border-border">
      <CardContent className="p-4 space-y-3">
        {/* Title */}
        <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">
          {metric.label}
        </p>

        {/* Value */}
        <p className="text-2xl font-bold text-foreground">{formattedValue}</p>

        {/* Meta + attainment */}
        {hasMeta && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">Meta: {formattedMeta}</span>
              <span
                className={cn(
                  "font-semibold",
                  metric.attainment >= 100
                    ? "text-green-500"
                    : metric.attainment >= 70
                      ? "text-yellow-500"
                      : "text-destructive"
                )}
              >
                {metric.attainment.toFixed(0)}%
              </span>
            </div>
            <Progress value={progressPct} className="h-1.5" />
          </div>
        )}

        {/* Gap + comparison */}
        <div className="flex items-center justify-between text-[11px]">
          {hasMeta ? (
            <span
              className={cn(
                "font-medium",
                isPositive ? "text-green-500" : "text-destructive"
              )}
            >
              Gap: {metric.gap > 0 ? "+" : ""}
              {metric.format === "percent" ? `${metric.gap.toFixed(1)}%` : metric.gap.toFixed(0)}
            </span>
          ) : (
            <span />
          )}

          {metric.compVariation !== null && (
            <span
              className={cn(
                "flex items-center gap-0.5",
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
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {[...Array(9)].map((_, i) => (
          <Card key={i} className="bg-card border-border animate-pulse">
            <CardContent className="p-4 h-[140px]" />
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
      {metrics.map((metric) => (
        <KPICard key={metric.key} metric={metric} />
      ))}
    </div>
  );
}
