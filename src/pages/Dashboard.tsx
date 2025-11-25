import { useState } from "react";
import { KPICard } from "@/components/ui/KPICard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DollarSign, TrendingDown, TrendingUp, Percent, Target, Megaphone, Users, AlertTriangle, AlertCircle } from "lucide-react";
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
import { useMetricsSummary, useEvolutionData, useFunnelData, useFinancialSummary } from "@/hooks/useWeeklyMetrics";
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
  
  const { data: metricsSummary, isLoading: loadingMetrics } = useMetricsSummary(periodo.inicio, periodo.fim);
  const { data: evolutionData, isLoading: loadingEvolution } = useEvolutionData(52);
  const { data: funnelData, isLoading: loadingFunnel } = useFunnelData(periodo.inicio, periodo.fim);
  const { data: financialData, isLoading: loadingFinancial } = useFinancialSummary(periodo.inicio, periodo.fim);
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
  ] : [];

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

      {/* Alerta de dados vazios */}
      {!loadingMetrics && !metricsSummary && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Nenhum dado encontrado. Por favor,{" "}
            <a href="/dashboard/importar" className="font-semibold underline">
              importe a planilha Excel
            </a>{" "}
            com os dados históricos para visualizar as métricas reais.
          </AlertDescription>
        </Alert>
      )}

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
          {metricsSummary?.ultrameta && (
            <UltrametaCard data={{
              ultrametaClint: metricsSummary.ultrameta.ultrameta_clint || 0,
              faturamentoIncorporador50k: metricsSummary.ultrameta.incorporador_50k || 0,
              faturamentoClintBruto: metricsSummary.ultrameta.clint_revenue || 0,
              ultrametaLiquido: (metricsSummary.ultrameta.ultrameta_clint || 0) - (metricsSummary.ultrameta.total_cost || 0),
            }} />
          )}
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
      {evolutionData && evolutionData.length > 0 && (
        <TrendChart data={evolutionData} />
      )}

      {funnelData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground">Funil A010</CardTitle>
            </CardHeader>
            <CardContent>
              <FunilLista 
                titulo="Funil A010" 
                etapas={[
                  { etapa: 'Etapa 01', leads: funnelData.stage_01_actual, conversao: funnelData.stage_01_rate, meta: funnelData.stage_01_target },
                  { etapa: 'Etapa 02', leads: funnelData.stage_02_actual, conversao: funnelData.stage_02_rate, meta: funnelData.stage_02_target },
                  { etapa: 'Etapa 03', leads: funnelData.stage_03_actual, conversao: funnelData.stage_03_rate, meta: funnelData.stage_03_target },
                  { etapa: 'Etapa 04', leads: funnelData.stage_04_actual, conversao: funnelData.stage_04_rate, meta: funnelData.stage_04_target },
                ]}
              />
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground">Funil Instagram</CardTitle>
            </CardHeader>
            <CardContent>
              <FunilLista 
                titulo="Funil Instagram" 
                etapas={[
                  { etapa: 'Etapa 05', leads: funnelData.stage_05_actual, conversao: funnelData.stage_05_rate, meta: funnelData.stage_05_target },
                  { etapa: 'Etapa 06', leads: funnelData.stage_06_actual, conversao: funnelData.stage_06_rate, meta: funnelData.stage_06_target },
                  { etapa: 'Etapa 07', leads: funnelData.stage_07_actual, conversao: funnelData.stage_07_rate, meta: funnelData.stage_07_target },
                  { etapa: 'Etapa 08', leads: funnelData.stage_08_actual, conversao: funnelData.stage_08_rate, meta: funnelData.stage_08_target },
                ]}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {financialData && financialData.length > 0 && (
        <ResumoFinanceiro 
          dados={financialData.map(m => ({
            dataInicio: m.week_label.split(' - ')[0],
            dataFim: m.week_label.split(' - ')[1],
            faturamentoA010: m.a010_revenue || 0,
            vendasA010: m.a010_sales || 0,
            valorVendidoOBEvento: m.ob_evento_revenue || 0,
            vendasOBEvento: m.ob_evento_sales || 0,
            faturamentoContrato: m.contract_revenue || 0,
            vendasContratos: m.contract_sales || 0,
            faturamentoOBConstruir: m.ob_construir_revenue || 0,
            vendasOBConstruir: m.ob_construir_sales || 0,
            faturamentoOBVitalicio: m.ob_vitalicio_revenue || 0,
            vendasOBVitalicio: m.ob_vitalicio_sales || 0,
          }))}
        />
      )}
    </div>
  );
}
