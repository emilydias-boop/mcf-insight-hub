import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface KPICardProps {
  title: string;
  value: string;
  change?: number;
  icon?: LucideIcon;
  variant?: 'success' | 'danger' | 'neutral';
}

export function KPICard({ title, value, change, icon: Icon, variant = 'neutral' }: KPICardProps) {
  const variantStyles = {
    success: 'text-success',
    danger: 'text-destructive',
    neutral: 'text-muted-foreground'
  };

  return (
    <Card className="bg-card border-border hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-2">
              {Icon && (
                <div className={cn("p-2 rounded-lg", variant === 'success' ? 'bg-success/10' : variant === 'danger' ? 'bg-destructive/10' : 'bg-muted')}>
                  <Icon className={cn("h-5 w-5", variantStyles[variant])} />
                </div>
              )}
              <p className="text-base font-semibold text-foreground">{title}</p>
            </div>
            
            <div className="space-y-1">
              <p className="text-2xl font-bold text-foreground">{value}</p>
              {change !== undefined && (
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
