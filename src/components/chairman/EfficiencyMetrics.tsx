import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EfficiencyMetric } from "@/hooks/useChairmanMetrics";
import { TrendingUp, TrendingDown, Minus, Target, Zap, Users, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";

interface EfficiencyMetricsProps {
  data: EfficiencyMetric[];
  isLoading?: boolean;
}

const METRIC_ICONS: Record<string, React.ReactNode> = {
  roi: <Target className="h-4 w-4" />,
  roas: <Zap className="h-4 w-4" />,
  cpl: <Users className="h-4 w-4" />,
  ticket: <CreditCard className="h-4 w-4" />,
};

const formatValue = (value: number, format: 'percent' | 'currency' | 'number') => {
  switch (format) {
    case 'percent':
      return `${value.toFixed(1)}%`;
    case 'currency':
      if (value >= 1000) {
        return `R$ ${(value / 1000).toFixed(1)}K`;
      }
      return `R$ ${value.toFixed(0)}`;
    case 'number':
      return value.toFixed(2);
    default:
      return value.toString();
  }
};

export const EfficiencyMetrics = ({ data, isLoading }: EfficiencyMetricsProps) => {
  if (isLoading) {
    return (
      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardHeader>
          <div className="h-6 w-48 bg-muted rounded animate-pulse" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-muted/50 rounded animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Zap className="h-5 w-5 text-primary" />
          Métricas de Eficiência
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          {data.map((metric) => {
            const TrendIcon = metric.change > 0 
              ? TrendingUp 
              : metric.change < 0 
                ? TrendingDown 
                : Minus;
            
            const trendColorClass = metric.isPositive 
              ? 'text-emerald-500' 
              : 'text-rose-500';

            return (
              <div 
                key={metric.key}
                className="relative p-4 rounded-lg bg-muted/30 border border-border/50 hover:border-primary/30 transition-colors group"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1.5 rounded-md bg-primary/10 text-primary">
                    {METRIC_ICONS[metric.key]}
                  </div>
                  <span className="text-sm font-medium text-muted-foreground">
                    {metric.label}
                  </span>
                </div>
                
                <div className="flex items-end justify-between">
                  <span className="text-2xl font-bold">
                    {formatValue(metric.value, metric.format)}
                  </span>
                  
                  <div className={cn(
                    "flex items-center gap-1 text-xs font-medium",
                    trendColorClass
                  )}>
                    <TrendIcon className="h-3 w-3" />
                    <span>{metric.change > 0 ? '+' : ''}{metric.change.toFixed(0)}%</span>
                  </div>
                </div>

                {/* Subtle hover effect */}
                <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
              </div>
            );
          })}
        </div>
        
        {/* Quick insights */}
        <div className="mt-4 p-3 rounded-lg bg-primary/5 border border-primary/10">
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-primary">Insight:</span>{' '}
            {data[0]?.isPositive 
              ? 'ROI positivo indica retorno saudável sobre investimentos.'
              : 'Atenção ao ROI - considere otimizar custos operacionais.'}
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
