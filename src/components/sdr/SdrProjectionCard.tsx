import { TrendingUp, Target, Calendar, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ProjectionData } from "@/hooks/useSdrPerformanceData";
import { cn } from "@/lib/utils";

interface SdrProjectionCardProps {
  data: ProjectionData;
  isLoading?: boolean;
}

export function SdrProjectionCard({ data, isLoading }: SdrProjectionCardProps) {
  if (isLoading) {
    return (
      <Card className="bg-card border-border animate-pulse">
        <CardContent className="p-6 h-[140px]" />
      </Card>
    );
  }

  const willHitMeta = data.projection >= data.metaFinal;
  const progressPct = Math.min(data.attainment, 100);

  return (
    <Card className="bg-card border-border overflow-hidden">
      <CardContent className="p-0">
        <div className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Projeção do Período</h3>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {/* Meta Final */}
            <div className="space-y-1">
              <span className="text-[11px] text-muted-foreground uppercase tracking-wide">Meta Final</span>
              <p className="text-xl font-bold text-foreground">{data.metaFinal}</p>
            </div>

            {/* Realizado */}
            <div className="space-y-1">
              <span className="text-[11px] text-muted-foreground uppercase tracking-wide">Realizado</span>
              <p className="text-xl font-bold text-foreground">{data.realized}</p>
            </div>

            {/* Projeção */}
            <div className="space-y-1">
              <span className="text-[11px] text-muted-foreground uppercase tracking-wide">Projeção</span>
              <p className={cn("text-xl font-bold", willHitMeta ? "text-green-500" : "text-destructive")}>
                {data.projection}
              </p>
            </div>

            {/* Gap */}
            <div className="space-y-1">
              <span className="text-[11px] text-muted-foreground uppercase tracking-wide">Faltam</span>
              <p className={cn("text-xl font-bold", data.gap <= 0 ? "text-green-500" : "text-destructive")}>
                {data.gap <= 0 ? "✓" : data.gap}
              </p>
            </div>

            {/* Required per day */}
            <div className="space-y-1">
              <span className="text-[11px] text-muted-foreground uppercase tracking-wide">Necessário/dia</span>
              <p className={cn("text-xl font-bold", data.requiredPerDay <= 0 ? "text-green-500" : "text-foreground")}>
                {data.gap <= 0 ? "—" : data.requiredPerDay.toFixed(1)}
              </p>
              <span className="text-[10px] text-muted-foreground">
                {data.businessDaysRemaining} dias úteis restantes
              </span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-4 space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">Atingimento</span>
              <span className={cn("font-semibold", progressPct >= 100 ? "text-green-500" : progressPct >= 70 ? "text-yellow-500" : "text-destructive")}>
                {data.attainment.toFixed(0)}%
              </span>
            </div>
            <Progress
              value={progressPct}
              className="h-2"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
