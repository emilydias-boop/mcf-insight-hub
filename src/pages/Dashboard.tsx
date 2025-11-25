import { useState } from "react";
import { KPICard } from "@/components/ui/KPICard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MOCK_KPIS, MOCK_FUNIL_A010, MOCK_FUNIL_INSTAGRAM, MOCK_SEMANAS_DETALHADO, MOCK_ULTRAMETA } from "@/data/mockData";
import { MOCK_EVOLUTION_DATA } from "@/data/evolutionMockData";
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
import { formatCurrency, formatPercent, formatNumber } from "@/lib/formatters";

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
    exportDashboardData({
      kpis: MOCK_KPIS,
      funis: [
        { titulo: 'Funil A010', etapas: MOCK_FUNIL_A010 },
        { titulo: 'Funil Instagram', etapas: MOCK_FUNIL_INSTAGRAM }
      ],
      semanas: MOCK_SEMANAS_DETALHADO,
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
          <UltrametaCard data={MOCK_ULTRAMETA} />
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
      <TrendChart data={MOCK_EVOLUTION_DATA} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Funil A010</CardTitle>
          </CardHeader>
          <CardContent>
            <FunilLista titulo="Funil A010" etapas={MOCK_FUNIL_A010} />
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Funil Instagram</CardTitle>
          </CardHeader>
          <CardContent>
            <FunilLista titulo="Funil Instagram" etapas={MOCK_FUNIL_INSTAGRAM} />
          </CardContent>
        </Card>
      </div>

      <ResumoFinanceiro dados={MOCK_SEMANAS_DETALHADO} />
    </div>
  );
}
