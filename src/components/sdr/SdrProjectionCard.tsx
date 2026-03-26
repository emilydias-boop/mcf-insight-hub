import { TrendingUp } from "lucide-react";
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
        <CardContent className="p-6 h-full" />
      </Card>
    );
  }

  const willHitMeta = data.projection >= data.metaFinal;
  const progressPct = Math.min(data.attainment, 100);

  const rows = [
    { label: "Meta Final", value: String(data.metaFinal), color: "text-foreground" },
    { label: "Realizado", value: String(data.realized), color: "text-foreground" },
    {
      label: "Projeção",
      value: String(data.projection),
      color: willHitMeta ? "text-green-500" : "text-destructive",
    },
    {
      label: "Faltam",
      value: data.gap <= 0 ? "✓" : String(data.gap),
      color: data.gap <= 0 ? "text-green-500" : "text-destructive",
    },
    {
      label: "Necessário/dia",
      value: data.gap <= 0 ? "—" : data.requiredPerDay.toFixed(1),
      color: data.gap <= 0 ? "text-green-500" : "text-foreground",
      sub: `${data.businessDaysRemaining} dias úteis restantes`,
    },
  ];

  return (
    <Card className="bg-card border-border h-full">
      <CardContent className="p-5 flex flex-col h-full">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Projeção do Período</h3>
        </div>

        <div className="flex-1 space-y-3">
          {rows.map((r) => (
            <div key={r.label} className="flex items-baseline justify-between">
              <span className="text-[11px] text-muted-foreground uppercase tracking-wide">
                {r.label}
              </span>
              <div className="text-right">
                <span className={cn("text-lg font-bold", r.color)}>{r.value}</span>
                {r.sub && (
                  <p className="text-[10px] text-muted-foreground">{r.sub}</p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <div className="mt-4 space-y-1.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground">Atingimento</span>
            <span
              className={cn(
                "font-semibold",
                progressPct >= 100
                  ? "text-green-500"
                  : progressPct >= 70
                    ? "text-yellow-500"
                    : "text-destructive"
              )}
            >
              {data.attainment.toFixed(0)}%
            </span>
          </div>
          <Progress value={progressPct} className="h-2" />
        </div>
      </CardContent>
    </Card>
  );
}
