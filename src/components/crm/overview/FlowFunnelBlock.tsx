import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { FlowFunnelStep } from '@/hooks/useCRMOverviewData';
import { ArrowRight } from 'lucide-react';

interface Props {
  data: FlowFunnelStep[] | undefined;
  isLoading: boolean;
}

export function FlowFunnelBlock({ data, isLoading }: Props) {
  if (isLoading) {
    return <Skeleton className="h-40 w-full rounded-lg" />;
  }

  if (!data || data.length === 0) return null;

  const maxValue = Math.max(...data.map(s => s.value), 1);

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-foreground">Funil Real do Período</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {data.map((step, i) => {
            const widthPercent = Math.max((step.value / maxValue) * 100, 4);
            const convRate = i > 0 && data[i - 1].value > 0
              ? ((step.value / data[i - 1].value) * 100).toFixed(1)
              : null;
            return (
              <div key={step.label} className="flex items-center gap-3">
                <div className="w-28 shrink-0 text-right">
                  <span className="text-sm font-medium text-foreground">{step.label}</span>
                </div>
                <div className="flex-1 relative">
                  <div
                    className="h-7 rounded bg-primary/20 flex items-center transition-all"
                    style={{ width: `${widthPercent}%` }}
                  >
                    <div
                      className="h-full rounded bg-primary transition-all"
                      style={{ width: `${widthPercent}%` }}
                    />
                  </div>
                </div>
                <div className="w-16 shrink-0 text-right">
                  <span className="text-sm font-bold text-foreground">{step.value}</span>
                </div>
                <div className="w-14 shrink-0 text-right">
                  {convRate && (
                    <span className="text-xs text-muted-foreground">{convRate}%</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
