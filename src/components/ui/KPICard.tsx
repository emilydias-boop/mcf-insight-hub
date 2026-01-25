import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
interface KPICardProps {
  title: string;
  value: string;
  change?: number;
  icon?: LucideIcon;
  variant?: 'success' | 'danger' | 'neutral';
  compact?: boolean;
  mini?: boolean;
}
export function KPICard({
  title,
  value,
  change,
  icon: Icon,
  variant = 'neutral',
  compact = false,
  mini = false
}: KPICardProps) {
  const variantStyles = {
    success: 'text-success',
    danger: 'text-destructive',
    neutral: 'text-muted-foreground'
  };

  const getPadding = () => {
    if (mini) return "p-2";
    if (compact) return "p-3";
    return "p-6";
  };

  const getIconSize = () => {
    if (mini) return "h-3 w-3";
    if (compact) return "h-4 w-4";
    return "h-5 w-5";
  };

  const getIconPadding = () => {
    if (mini) return "p-1 rounded";
    if (compact) return "p-1.5 rounded-lg";
    return "p-2 rounded-lg";
  };

  const getTitleSize = () => {
    if (mini) return "text-xs";
    if (compact) return "text-sm";
    return "text-base";
  };

  const getValueSize = () => {
    if (mini) return "text-lg";
    if (compact) return "text-xl";
    return "text-2xl";
  };

  return (
    <Card className="bg-card border-border hover:shadow-md transition-shadow h-full">
      <CardContent className={getPadding()}>
        <div className="flex items-start justify-between gap-2">
          <div className={cn("flex-1", mini ? "space-y-1" : "space-y-2")}>
            <div className={cn("flex items-center", mini ? "gap-1.5" : "gap-2")}>
              {Icon && (
                <div className={cn(
                  getIconPadding(),
                  variant === 'success' ? 'bg-success/10' : variant === 'danger' ? 'bg-destructive/10' : 'bg-muted'
                )}>
                  <Icon className={cn(getIconSize(), variantStyles[variant])} />
                </div>
              )}
              <p className={cn("font-semibold text-foreground", getTitleSize())}>{title}</p>
            </div>
            
            <div className={mini ? "space-y-0" : "space-y-1"}>
              <p className={cn("font-bold text-foreground", getValueSize())}>{value}</p>
              {change !== undefined && !mini && (
                <p className={cn("text-sm font-medium flex items-center gap-1", change >= 0 ? 'text-success' : 'text-destructive')}>
                  <span>{change > 0 ? '+' : ''}{change.toFixed(1)}%</span>
                  <span className="text-xs text-muted-foreground">vs período anterior</span>
                </p>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}