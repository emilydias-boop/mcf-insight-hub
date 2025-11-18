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
    <Card className="bg-card border-border">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm text-muted-foreground mb-2">{title}</p>
            <p className="text-3xl font-bold text-foreground">{value}</p>
            {change !== undefined && (
              <p className={cn("text-sm mt-2 font-medium", change >= 0 ? 'text-success' : 'text-destructive')}>
                {change > 0 ? '+' : ''}{change.toFixed(1)}%
              </p>
            )}
          </div>
          {Icon && (
            <div className={cn("p-2 rounded-lg", variant === 'success' ? 'bg-success/10' : variant === 'danger' ? 'bg-destructive/10' : 'bg-muted')}>
              <Icon className={cn("h-5 w-5", variantStyles[variant])} />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
