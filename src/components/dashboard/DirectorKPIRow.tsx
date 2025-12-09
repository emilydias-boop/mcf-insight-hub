import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DollarSign, Megaphone, Target, Wallet, TrendingUp, Percent, BarChart3, Info } from "lucide-react";
import { formatCurrency, formatPercent } from "@/lib/formatters";
import { cn } from "@/lib/utils";

interface KPIData {
  value: number;
  change: number;
  isPositive: boolean;
}

interface DirectorKPIRowProps {
  faturamentoTotal: KPIData;
  gastosAds: KPIData;
  cpl: KPIData;
  custoTotal: KPIData;
  lucro: KPIData;
  roi: KPIData;
  roas: KPIData;
  isLoading?: boolean;
}

interface KPICardProps {
  title: string;
  value: string;
  change: number;
  isPositive: boolean;
  icon: React.ElementType;
  tooltip?: string;
}

function KPICard({ title, value, change, isPositive, icon: Icon, tooltip }: KPICardProps) {
  return (
    <Card className="bg-card border-border hover:border-primary/50 transition-colors">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Icon className="h-4 w-4 text-primary" />
            </div>
            {tooltip && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-3 w-3 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs max-w-[200px]">{tooltip}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{title}</p>
        <p className="text-xl font-bold text-foreground">{value}</p>
        <div className={cn(
          "text-xs mt-1 flex items-center gap-1",
          isPositive ? "text-success" : "text-destructive"
        )}>
          <span>{isPositive ? "↑" : "↓"}</span>
          <span>{Math.abs(change).toFixed(1)}% vs anterior</span>
        </div>
      </CardContent>
    </Card>
  );
}

export function DirectorKPIRow({
  faturamentoTotal,
  gastosAds,
  cpl,
  custoTotal,
  lucro,
  roi,
  roas,
  isLoading,
}: DirectorKPIRowProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {[...Array(7)].map((_, i) => (
          <div key={i} className="h-28 bg-card animate-pulse rounded-lg border border-border" />
        ))}
      </div>
    );
  }

  const kpis = [
    {
      title: "Faturamento Total",
      value: formatCurrency(faturamentoTotal.value),
      change: faturamentoTotal.change,
      isPositive: faturamentoTotal.isPositive,
      icon: DollarSign,
    },
    {
      title: "Gastos Ads",
      value: formatCurrency(gastosAds.value),
      change: gastosAds.change,
      isPositive: gastosAds.isPositive,
      icon: Megaphone,
    },
    {
      title: "CPL",
      value: formatCurrency(cpl.value),
      change: cpl.change,
      isPositive: cpl.isPositive,
      icon: Target,
      tooltip: "CPL = Gastos Ads / Leads do período",
    },
    {
      title: "Custo Total",
      value: formatCurrency(custoTotal.value),
      change: custoTotal.change,
      isPositive: custoTotal.isPositive,
      icon: Wallet,
    },
    {
      title: "Lucro",
      value: formatCurrency(lucro.value),
      change: lucro.change,
      isPositive: lucro.isPositive,
      icon: TrendingUp,
    },
    {
      title: "ROI",
      value: formatPercent(roi.value, 2),
      change: roi.change,
      isPositive: roi.isPositive,
      icon: Percent,
      tooltip: "ROI = Faturamento Clint / (Faturamento Clint - Lucro)",
    },
    {
      title: "ROAS",
      value: `${roas.value.toFixed(2)}x`,
      change: roas.change,
      isPositive: roas.isPositive,
      icon: BarChart3,
      tooltip: "ROAS = Faturamento Total / Gastos Ads",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 overflow-x-auto">
      {kpis.map((kpi) => (
        <KPICard key={kpi.title} {...kpi} />
      ))}
    </div>
  );
}
