import { useState } from "react";
import { Crown, Building2 } from "lucide-react";
import { useChairmanMetrics, ChairmanFilters, PeriodType } from "@/hooks/useChairmanMetrics";
import { ChairmanKPICards } from "@/components/chairman/ChairmanKPICards";
import { RevenueBUChart } from "@/components/chairman/RevenueBUChart";
import { EvolutionChart } from "@/components/chairman/EvolutionChart";
import { CostsDistributionChart } from "@/components/chairman/CostsDistributionChart";
import { EfficiencyMetrics } from "@/components/chairman/EfficiencyMetrics";
import { ChairmanFiltersComponent } from "@/components/chairman/ChairmanFilters";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const Chairman = () => {
  const [filters, setFilters] = useState<ChairmanFilters>({
    periodType: 'month' as PeriodType,
  });

  const { data: metrics, isLoading, refetch } = useChairmanMetrics(filters);

  const handleFiltersChange = (newFilters: ChairmanFilters) => {
    setFilters(newFilters);
  };

  const periodLabel = metrics?.period 
    ? `${format(metrics.period.start, "dd MMM", { locale: ptBR })} - ${format(metrics.period.end, "dd MMM yyyy", { locale: ptBR })}`
    : '';

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/20">
              <Crown className="h-6 w-6 text-amber-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Visão Chairman</h1>
              <p className="text-sm text-muted-foreground">
                Dashboard executivo consolidado
                {periodLabel && <span className="ml-2">• {periodLabel}</span>}
              </p>
            </div>
          </div>
          
          <ChairmanFiltersComponent
            filters={filters}
            onFiltersChange={handleFiltersChange}
            onRefresh={() => refetch()}
            isLoading={isLoading}
          />
        </div>

        {/* KPI Cards */}
        <ChairmanKPICards
          faturamento={metrics?.faturamento || { value: 0, previousValue: 0, change: 0, changePercent: 0, trend: 'stable', sparklineData: [] }}
          despesas={metrics?.despesas || { value: 0, previousValue: 0, change: 0, changePercent: 0, trend: 'stable', sparklineData: [] }}
          lucro={metrics?.lucro || { value: 0, previousValue: 0, change: 0, changePercent: 0, trend: 'stable', sparklineData: [] }}
          margem={metrics?.margem || { value: 0, previousValue: 0, change: 0, changePercent: 0, trend: 'stable', sparklineData: [] }}
          isLoading={isLoading}
        />

        {/* Main Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <RevenueBUChart 
            data={metrics?.revenueByBU || []} 
            isLoading={isLoading}
          />
          <EvolutionChart 
            data={metrics?.evolution || []} 
            isLoading={isLoading}
          />
        </div>

        {/* Secondary Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <CostsDistributionChart 
            data={metrics?.costDistribution || []} 
            isLoading={isLoading}
          />
          <EfficiencyMetrics 
            data={metrics?.efficiency || []} 
            isLoading={isLoading}
          />
        </div>

        {/* Footer insights */}
        {metrics && !isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Top BU */}
            {metrics.revenueByBU[0] && (
              <div className="p-4 rounded-lg bg-card/50 border border-border/50">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <Building2 className="h-4 w-4" />
                  Top Business Unit
                </div>
                <p className="font-semibold text-lg">{metrics.revenueByBU[0].label}</p>
                <p className="text-sm text-primary">
                  {metrics.revenueByBU[0].percentage.toFixed(1)}% do faturamento
                </p>
              </div>
            )}
            
            {/* Profit margin status */}
            <div className="p-4 rounded-lg bg-card/50 border border-border/50">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Crown className="h-4 w-4" />
                Status da Margem
              </div>
              <p className="font-semibold text-lg">
                {metrics.margem.value >= 20 ? 'Saudável' : metrics.margem.value >= 10 ? 'Moderada' : 'Atenção'}
              </p>
              <p className={`text-sm ${metrics.margem.value >= 20 ? 'text-emerald-500' : metrics.margem.value >= 10 ? 'text-amber-500' : 'text-rose-500'}`}>
                Margem de {metrics.margem.value.toFixed(1)}%
              </p>
            </div>
            
            {/* Period comparison */}
            <div className="p-4 rounded-lg bg-card/50 border border-border/50">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                📊 Comparação
              </div>
              <p className="font-semibold text-lg">
                {metrics.faturamento.changePercent > 0 ? 'Crescimento' : metrics.faturamento.changePercent < 0 ? 'Retração' : 'Estável'}
              </p>
              <p className={`text-sm ${metrics.faturamento.changePercent >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                {metrics.faturamento.changePercent > 0 ? '+' : ''}{metrics.faturamento.changePercent.toFixed(1)}% vs período anterior
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Chairman;
