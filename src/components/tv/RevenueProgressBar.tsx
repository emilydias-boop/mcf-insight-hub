import { Progress } from "@/components/ui/progress";
import { TrendingUp } from "lucide-react";

interface RevenueProgressBarProps {
  title: string;
  atual: number;
  meta: number;
  percentual: number;
}

function formatCurrency(value: number): string {
  if (value >= 1000000) {
    return `R$ ${(value / 1000000).toFixed(2).replace('.', ',')}M`;
  }
  if (value >= 1000) {
    return `R$ ${(value / 1000).toFixed(0)}K`;
  }
  return `R$ ${value.toFixed(0)}`;
}

function getProgressColor(percentual: number): string {
  if (percentual <= 35) return "bg-red-500";
  if (percentual <= 75) return "bg-yellow-500";
  return "bg-green-500";
}

function getTextColor(percentual: number): string {
  if (percentual <= 35) return "text-red-500";
  if (percentual <= 75) return "text-yellow-500";
  return "text-green-500";
}

export function RevenueProgressBar({ title, atual, meta, percentual }: RevenueProgressBarProps) {
  const progressValue = Math.min(percentual, 100);
  const colorClass = getProgressColor(percentual);
  const textColorClass = getTextColor(percentual);

  return (
    <div className="bg-card/80 backdrop-blur-sm rounded-lg p-3 border border-border/50">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">{title}</span>
        </div>
        <span className={`text-lg font-bold ${textColorClass}`}>
          {percentual.toFixed(0)}%
        </span>
      </div>
      
      <div className="relative h-3 bg-muted rounded-full overflow-hidden mb-2">
        <div 
          className={`absolute left-0 top-0 h-full transition-all duration-500 rounded-full ${colorClass}`}
          style={{ width: `${progressValue}%` }}
        />
      </div>
      
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{formatCurrency(atual)}</span>
        <span>Meta: {formatCurrency(meta)}</span>
      </div>
    </div>
  );
}
