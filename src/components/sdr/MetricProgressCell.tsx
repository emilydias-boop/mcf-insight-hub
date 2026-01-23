import { useMemo } from "react";
import { cn } from "@/lib/utils";

interface MetricProgressCellProps {
  value: number;
  target: number;
  compact?: boolean;
}

export function MetricProgressCell({ value, target, compact = false }: MetricProgressCellProps) {
  const { percentage, colorClass, bgClass } = useMemo(() => {
    const pct = target > 0 ? Math.min((value / target) * 100, 100) : 0;
    
    let color: string;
    let bg: string;
    
    if (pct >= 75) {
      color = "text-green-500";
      bg = "bg-green-500";
    } else if (pct >= 35) {
      color = "text-yellow-500";
      bg = "bg-yellow-500";
    } else {
      color = "text-red-500";
      bg = "bg-red-500";
    }
    
    return { percentage: pct, colorClass: color, bgClass: bg };
  }, [value, target]);

  const displayPercentage = target > 0 ? Math.round((value / target) * 100) : 0;

  return (
    <div className={cn("flex flex-col gap-1", compact ? "min-w-[80px]" : "min-w-[100px]")}>
      {/* Value / Target */}
      <div className="flex items-baseline justify-between gap-1">
        <span className="text-sm font-semibold text-foreground">
          {value}
          <span className="text-muted-foreground font-normal">/{target}</span>
        </span>
        <span className={cn("text-xs font-bold", colorClass)}>
          {displayPercentage}%
        </span>
      </div>
      
      {/* Progress Bar */}
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-500 ease-out", bgClass)}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
