import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Filter, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface FunnelStep {
  label: string;
  value: number;
  conversionRate: number | null;
}

interface SdrFunnelPanelProps {
  funnel: FunnelStep[];
  isLoading?: boolean;
}

export function SdrFunnelPanel({ funnel, isLoading }: SdrFunnelPanelProps) {
  if (isLoading) {
    return (
      <Card className="bg-card border-border animate-pulse">
        <CardContent className="p-6 h-[300px]" />
      </Card>
    );
  }

  const maxValue = Math.max(...funnel.map((s) => s.value), 1);

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Filter className="h-4 w-4 text-primary" />
          Funil Individual
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-1">
        {funnel.map((step, i) => {
          const widthPct = maxValue > 0 ? (step.value / maxValue) * 100 : 0;
          const isLowConversion = step.conversionRate !== null && step.conversionRate < 30;

          return (
            <div key={step.label}>
              {/* Conversion rate between steps */}
              {step.conversionRate !== null && (
                <div className="flex items-center justify-center gap-1 py-1">
                  <ArrowDown className="h-3 w-3 text-muted-foreground" />
                  <span
                    className={cn(
                      "text-[11px] font-medium",
                      isLowConversion ? "text-destructive" : "text-muted-foreground"
                    )}
                  >
                    {step.conversionRate.toFixed(1)}%
                  </span>
                </div>
              )}

              {/* Funnel bar */}
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-[80px] text-right shrink-0 truncate">
                  {step.label}
                </span>
                <div className="flex-1 relative h-8 bg-muted/30 rounded-md overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-md transition-all",
                      isLowConversion ? "bg-destructive/60" : "bg-primary/60"
                    )}
                    style={{ width: `${Math.max(widthPct, 4)}%` }}
                  />
                  <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-foreground">
                    {step.value}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
