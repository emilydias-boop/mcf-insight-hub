import { useState } from "react";
import { KPICard } from "@/components/ui/KPICard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MOCK_KPIS } from "@/data/mockData";
import { DollarSign, TrendingDown, TrendingUp, Percent, Target, Megaphone, Users, AlertTriangle } from "lucide-react";
import { FunilLista } from "@/components/dashboard/FunilLista";
import { ResumoFinanceiro } from "@/components/dashboard/ResumoFinanceiro";
import { UltrametaCard } from "@/components/dashboard/UltrametaCard";
import { PeriodSelector } from "@/components/dashboard/PeriodSelector";
import { TrendChart } from "@/components/dashboard/TrendChart";
import { PeriodComparison } from "@/components/dashboard/PeriodComparison";
import { DashboardCustomizer } from "@/components/dashboard/DashboardCustomizer";
import { exportDashboardData } from "@/lib/exportHelpers";
import { useToast } from "@/hooks/use-toast";
import { startOfMonth, endOfMonth } from "date-fns";
import { useMetricsSummary } from "@/hooks/useWeeklyMetrics";
import { useHublaSummary } from "@/hooks/useHublaTransactions";
import { useA010Funnel, useInstagramFunnel } from "@/hooks/useFunnelData";
import { useUltrameta } from "@/hooks/useUltrameta";
import { useEvolutionData } from "@/hooks/useEvolutionData";
import { useWeeklyResumo } from "@/hooks/useWeeklyMetrics";
import { formatCurrency, formatPercent, formatNumber } from "@/lib/formatters";
import { ImportMetricsDialog } from "@/components/dashboard/ImportMetricsDialog";

const iconMap = {
  '1': DollarSign,
  '2': TrendingDown,
  '3': TrendingUp,
  '4': Percent,
  '5': Target,
  '6': Megaphone,
  '7': Users,
  '8': AlertTriangle,
};

export default function Dashboard() {
  const { toast } = useToast();
  const [periodo, setPeriodo] = useState({
    tipo: 'mes' as 'semana' | 'mes',
    inicio: startOfMonth(new Date()),
    fim: endOfMonth(new Date()),
  });
  const [canal, setCanal] = useState('todos');
  
  const { data: metricsSummary, isLoading: loadingMetrics } = useMetricsSummary();
  const { data: hublaSummary, isLoading: loadingHubla } = useHublaSummary();
  const { data: evolutionData, isLoading: loadingEvolution } = useEvolutionData(52);
  const { data: a010Funnel, isLoading: loadingA010 } = useA010Funnel();
  const { data: instagramFunnel, isLoading: loadingInstagram } = useInstagramFunnel();
  const { data: ultrameta, isLoading: loadingUltrameta } = useUltrameta();
  const { data: weeklyResumo, isLoading: loadingResumo } = useWeeklyResumo(5);

  const handleApplyFilters = (filters: { periodo: { tipo: 'semana' | 'mes'; inicio: Date; fim: Date }; canal: string }) => {
    setPeriodo(filters.periodo);
    setCanal(filters.canal);
    toast({
      title: "Filtros aplicados",
      description: "Os dados do dashboard foram atualizados com os filtros selecionados.",
    });
  };

  const handleClearFilters = () => {
    setPeriodo({
      tipo: 'mes',
      inicio: startOfMonth(new Date()),
      fim: endOfMonth(new Date()),
    });
    setCanal('todos');
    toast({
      title: "Filtros limpos",
      description: "Os filtros foram resetados para os valores padrão.",
    });
  };

  const handleExport = () => {
    const kpiData = metricsSummary ? [
      {
        id: '1',
        title: 'Faturamento',
        value: formatCurrency(metricsSummary.revenue.value),
        change: metricsSummary.revenue.change,
        variant: metricsSummary.revenue.change >= 0 ? 'success' : 'danger',
      },
      {
        id: '2',
        title: 'Vendas',
        value: formatNumber(metricsSummary.sales.value),
        change: metricsSummary.sales.change,
        variant: metricsSummary.sales.change >= 0 ? 'success' : 'danger',
      },
    ] : MOCK_KPIS;

    exportDashboardData({
      kpis: kpiData,
      funis: [
        { titulo: 'Funil A010', etapas: a010Funnel || [] },
        { titulo: 'Funil Instagram', etapas: instagramFunnel || [] }
      ],
      semanas: weeklyResumo || [],
      periodo,
      canal,
    });
    toast({
      title: "Dados exportados",
      description: "O arquivo CSV foi baixado com sucesso.",
    });
  };

  // KPIs com dados reais
  const kpis = metricsSummary ? [
    {
      id: '1',
      title: 'Faturamento',
      value: formatCurrency(metricsSummary.revenue.value),
      change: metricsSummary.revenue.change,
      variant: metricsSummary.revenue.change >= 0 ? 'success' : 'danger',
    },
    {
      id: '2',
      title: 'Vendas',
      value: formatNumber(metricsSummary.sales.value),
      change: metricsSummary.sales.change,
      variant: metricsSummary.sales.change >= 0 ? 'success' : 'danger',
    },
    {
      id: '3',
      title: 'ROI',
      value: formatPercent(metricsSummary.roi.value, 0),
      change: metricsSummary.roi.change,
      variant: metricsSummary.roi.change >= 0 ? 'success' : 'danger',
    },
    {
      id: '4',
      title: 'ROAS',
      value: `${metricsSummary.roas.value.toFixed(2)}x`,
      change: metricsSummary.roas.change,
      variant: metricsSummary.roas.change >= 0 ? 'success' : 'danger',
    },
    {
      id: '5',
      title: 'Custos',
      value: formatCurrency(metricsSummary.cost.value),
      change: metricsSummary.cost.change,
      variant: metricsSummary.cost.change <= 0 ? 'success' : 'danger',
    },
    {
      id: '6',
      title: 'Leads',
      value: formatNumber(metricsSummary.leads.value),
      change: metricsSummary.leads.change,
      variant: metricsSummary.leads.change >= 0 ? 'success' : 'danger',
    },
  ] : MOCK_KPIS;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Visão geral dos principais indicadores de desempenho</p>
        </div>
        <div className="flex gap-2">
          <ImportMetricsDialog 
            onImportSuccess={() => {
              // Refetch metrics data after successful import
              window.location.reload();
            }} 
          />
          <PeriodComparison />
          <DashboardCustomizer />
        </div>
      </div>

      <PeriodSelector 
        onApply={handleApplyFilters}
        onClear={handleClearFilters}
        onExport={handleExport}
      />

      {/* Seção de KPIs */}
      <div className="space-y-4">
        {/* KPIs Principais (primeiros 3) + Ultrameta */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
          {loadingMetrics ? (
            <>
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-32 bg-card animate-pulse rounded-lg border border-border" />
              ))}
            </>
          ) : (
            kpis.slice(0, 3).map((kpi) => {
              const Icon = iconMap[kpi.id as keyof typeof iconMap];
              return (
                <KPICard
                  key={kpi.id}
                  title={kpi.title}
                  value={kpi.value}
                  change={kpi.change}
                  icon={Icon}
                  variant={kpi.variant as any}
                />
              );
            })
          )}
          {loadingUltrameta ? (
            <div className="h-full bg-card animate-pulse rounded-lg border border-border" />
          ) : ultrameta ? (
            <UltrametaCard data={ultrameta} />
          ) : null}
        </div>

        {/* KPIs Secundários */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {loadingMetrics ? (
            <>
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-32 bg-card animate-pulse rounded-lg border border-border" />
              ))}
            </>
          ) : (
            kpis.slice(3).map((kpi) => {
              const Icon = iconMap[kpi.id as keyof typeof iconMap];
              return (
                <KPICard
                  key={kpi.id}
                  title={kpi.title}
                  value={kpi.value}
                  change={kpi.change}
                  icon={Icon}
                  variant={kpi.variant as any}
                />
              );
            })
          )}
        </div>
      </div>

      {/* Gráfico de Evolução Temporal */}
      {loadingEvolution ? (
        <div className="h-96 bg-card animate-pulse rounded-lg border border-border" />
      ) : evolutionData && evolutionData.length > 0 ? (
        <TrendChart data={evolutionData} />
      ) : (
        <Card className="bg-card border-border">
          <CardContent className="p-6 text-center text-muted-foreground">
            Nenhum dado de evolução disponível
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Funil A010</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingA010 ? (
              <div className="h-64 bg-muted animate-pulse rounded" />
            ) : a010Funnel && a010Funnel.length > 0 ? (
              <FunilLista titulo="Funil A010" etapas={a010Funnel} />
            ) : (
              <p className="text-center text-muted-foreground py-8">Nenhum dado disponível</p>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Funil Instagram</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingInstagram ? (
              <div className="h-64 bg-muted animate-pulse rounded" />
            ) : instagramFunnel && instagramFunnel.length > 0 ? (
              <FunilLista titulo="Funil Instagram" etapas={instagramFunnel} />
            ) : (
              <p className="text-center text-muted-foreground py-8">Nenhum dado disponível</p>
            )}
          </CardContent>
        </Card>
      </div>

      {loadingResumo ? (
        <div className="h-64 bg-card animate-pulse rounded-lg border border-border" />
      ) : weeklyResumo && weeklyResumo.length > 0 ? (
        <ResumoFinanceiro dados={weeklyResumo} />
      ) : (
        <Card className="bg-card border-border">
          <CardContent className="p-6 text-center text-muted-foreground">
            Nenhum dado de resumo disponível
          </CardContent>
        </Card>
      )}
    </div>
  );
}
