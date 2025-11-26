import { useState } from "react";
import { ResourceGuard } from "@/components/auth/ResourceGuard";
import { KPICard } from "@/components/ui/KPICard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MOCK_KPIS } from "@/data/mockData";
import { DollarSign, TrendingDown, TrendingUp, Percent, Target, Megaphone, Users, AlertTriangle, Eye, Calendar } from "lucide-react";
import { FunilDuplo } from "@/components/dashboard/FunilDuplo";
import { FunilLista } from "@/components/dashboard/FunilLista";
import { TargetsConfigDialog } from "@/components/dashboard/TargetsConfigDialog";
import { ResumoFinanceiro } from "@/components/dashboard/ResumoFinanceiro";
import { UltrametaCard } from "@/components/dashboard/UltrametaCard";
import { PeriodSelector } from "@/components/dashboard/PeriodSelector";
import { TrendChart } from "@/components/dashboard/TrendChart";
import { PeriodComparison } from "@/components/dashboard/PeriodComparison";
import { DashboardCustomizer } from "@/components/dashboard/DashboardCustomizer";
import { exportDashboardData } from "@/lib/exportHelpers";
import { useToast } from "@/hooks/use-toast";
import { startOfMonth, endOfMonth, format } from "date-fns";
import { getCustomWeekStart, getCustomWeekEnd } from "@/lib/dateHelpers";
import { useMetricsSummary } from "@/hooks/useWeeklyMetrics";
import { useHublaSummary } from "@/hooks/useHublaTransactions";
import { useClintFunnel } from "@/hooks/useClintFunnel";
import { useUltrameta } from "@/hooks/useUltrameta";
import { useEvolutionData } from "@/hooks/useEvolutionData";
import { useWeeklyResumo } from "@/hooks/useWeeklyMetrics";
import { formatCurrency, formatPercent, formatNumber } from "@/lib/formatters";

import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

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
  const queryClient = useQueryClient();
  const [periodo, setPeriodo] = useState({
    tipo: 'semana' as 'semana' | 'mes',
    inicio: getCustomWeekStart(new Date()),
    fim: getCustomWeekEnd(new Date()),
  });
  const [canal, setCanal] = useState('todos');
  const [viewMode, setViewMode] = useState<'periodo' | 'atual'>('periodo');
  
  const { data: metricsSummary, isLoading: loadingMetrics, error: errorMetrics } = useMetricsSummary(periodo.inicio, periodo.fim, canal);
  const { data: hublaSummary, isLoading: loadingHubla } = useHublaSummary();
  const { data: evolutionData, isLoading: loadingEvolution, error: errorEvolution } = useEvolutionData(canal, 52);
  const PIPELINE_INSIDE_SALES_ID = "e3c04f21-ba2c-4c66-84f8-b4341c826b1c";
  const { data: a010Funnel, isLoading: loadingA010, error: errorA010 } = useClintFunnel(
    PIPELINE_INSIDE_SALES_ID,
    periodo.inicio,
    periodo.fim,
    viewMode === 'atual'
  );
  const { data: ultrameta, isLoading: loadingUltrameta, error: errorUltrameta } = useUltrameta(periodo.inicio, periodo.fim);
  const { data: weeklyResumo, isLoading: loadingResumo, error: errorResumo } = useWeeklyResumo(5, periodo.inicio, periodo.fim, canal);

  // Debug logs
  console.log('🔍 Dashboard Data Debug:');
  console.log('Metrics Summary:', { data: metricsSummary, loading: loadingMetrics, error: errorMetrics });
  console.log('Evolution Data:', { count: evolutionData?.length, loading: loadingEvolution, error: errorEvolution });
  console.log('A010 Funnel:', { count: a010Funnel?.length, loading: loadingA010, error: errorA010 });
  console.log('Ultrameta:', { data: ultrameta, loading: loadingUltrameta, error: errorUltrameta });
  console.log('Weekly Resumo:', { count: weeklyResumo?.length, loading: loadingResumo, error: errorResumo });

  const handleRefreshData = () => {
    queryClient.invalidateQueries({ queryKey: ['weekly-metrics'] });
    queryClient.invalidateQueries({ queryKey: ['metrics-summary'] });
    queryClient.invalidateQueries({ queryKey: ['evolution-data'] });
    queryClient.invalidateQueries({ queryKey: ['funnel-data'] });
    queryClient.invalidateQueries({ queryKey: ['ultrameta'] });
    queryClient.invalidateQueries({ queryKey: ['weekly-resumo'] });
    toast({
      title: "Dados atualizados",
      description: "Os dados do dashboard foram recarregados.",
    });
  };

  const handleApplyFilters = (filters: { periodo: { tipo: 'semana' | 'mes'; inicio: Date; fim: Date }; canal: string }) => {
    setPeriodo(filters.periodo);
    setCanal(filters.canal);
    
    // Invalidar queries para forçar atualização
    queryClient.invalidateQueries({ queryKey: ['metrics-summary'] });
    queryClient.invalidateQueries({ queryKey: ['evolution-data'] });
    queryClient.invalidateQueries({ queryKey: ['funnel-data'] });
    queryClient.invalidateQueries({ queryKey: ['ultrameta'] });
    queryClient.invalidateQueries({ queryKey: ['weekly-resumo'] });
    
    toast({
      title: "Filtros aplicados",
      description: "Os dados do dashboard foram atualizados com os filtros selecionados.",
    });
  };

  const handleClearFilters = () => {
    setPeriodo({
      tipo: 'semana',
      inicio: getCustomWeekStart(new Date()),
      fim: getCustomWeekEnd(new Date()),
    });
    setCanal('todos');
    
    // Invalidar queries
    queryClient.invalidateQueries({ queryKey: ['metrics-summary'] });
    queryClient.invalidateQueries({ queryKey: ['evolution-data'] });
    queryClient.invalidateQueries({ queryKey: ['funnel-data'] });
    queryClient.invalidateQueries({ queryKey: ['ultrameta'] });
    queryClient.invalidateQueries({ queryKey: ['weekly-resumo'] });
    
    toast({
      title: "Filtros limpos",
      description: "Os filtros foram resetados para a semana atual.",
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
        { titulo: 'Funil A010', etapas: a010Funnel || [] }
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
    <ResourceGuard resource="dashboard">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground mt-1">Visão geral dos principais indicadores de desempenho</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleRefreshData} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Atualizar
            </Button>
              <TargetsConfigDialog />
              <PeriodComparison />
            <DashboardCustomizer />
          </div>
        </div>

        <PeriodSelector 
          onApply={handleApplyFilters}
          onClear={handleClearFilters}
          onExport={handleExport}
        />


        {/* Error Display */}
        {(errorMetrics || errorEvolution || errorA010 || errorUltrameta || errorResumo) && (
          <Card className="bg-destructive/10 border-destructive">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                <div>
                  <p className="font-semibold">Erro ao carregar dados</p>
                  <p className="text-sm">
                    {errorMetrics && 'Métricas: ' + (errorMetrics as Error).message}
                    {errorEvolution && ' | Evolução: ' + (errorEvolution as Error).message}
                    {errorA010 && ' | Funil A010: ' + (errorA010 as Error).message}
                    {errorUltrameta && ' | Ultrameta: ' + (errorUltrameta as Error).message}
                    {errorResumo && ' | Resumo: ' + (errorResumo as Error).message}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* KPIs + Ultrameta Layout Compacto */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4">
          {/* KPIs Grid 3x2 - Esquerda */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 content-start">
            {loadingMetrics ? (
              <>
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="h-24 bg-card animate-pulse rounded-lg border border-border" />
                ))}
              </>
            ) : (
              kpis.map((kpi) => {
                const Icon = iconMap[kpi.id as keyof typeof iconMap];
                return (
                  <KPICard
                    key={kpi.id}
                    title={kpi.title}
                    value={kpi.value}
                    change={kpi.change}
                    icon={Icon}
                    variant={kpi.variant as any}
                    compact
                  />
                );
              })
            )}
          </div>

          {/* Ultrameta Card - Direita */}
          {loadingUltrameta ? (
            <div className="h-full min-h-[240px] bg-card animate-pulse rounded-lg border border-border" />
          ) : ultrameta ? (
            <div className="h-full">
              <UltrametaCard data={ultrameta} />
            </div>
          ) : null}
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

        {/* Funil Pipeline Inside Sales - Dividido em Leads A e B */}
        <div className="space-y-3">
          <div className="flex items-center justify-end">
            <div className="flex gap-2 border border-border rounded-lg p-1 bg-card">
              <Button
                variant={viewMode === 'periodo' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('periodo')}
                className="gap-2"
              >
                <Calendar className="h-4 w-4" />
                Período
              </Button>
              <Button
                variant={viewMode === 'atual' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('atual')}
                className="gap-2"
              >
                <Eye className="h-4 w-4" />
                Visão Atual
              </Button>
            </div>
          </div>
          <FunilDuplo
            originId="e3c04f21-ba2c-4c66-84f8-b4341c826b1c"
            weekStart={periodo.inicio}
            weekEnd={periodo.fim}
            showCurrentState={viewMode === 'atual'}
          />
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
    </ResourceGuard>
  );
}
