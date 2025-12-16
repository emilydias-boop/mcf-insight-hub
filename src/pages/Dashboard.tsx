import { useState, useEffect, useMemo } from "react";
import { ResourceGuard } from "@/components/auth/ResourceGuard";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";
import { FunilDuplo } from "@/components/dashboard/FunilDuplo";
import { TargetsConfigDialog } from "@/components/dashboard/TargetsConfigDialog";
import { PeriodSelector } from "@/components/dashboard/PeriodSelector";
import { TrendChart } from "@/components/dashboard/TrendChart";
import { PeriodComparison } from "@/components/dashboard/PeriodComparison";
import { DashboardCustomizer } from "@/components/dashboard/DashboardCustomizer";
import { RecalculateMetricsButton } from "@/components/dashboard/RecalculateMetricsButton";
import { RecalculateOnlyMetricsButton } from "@/components/dashboard/RecalculateOnlyMetricsButton";
import { ImportMetricsDialog } from "@/components/dashboard/ImportMetricsDialog";
import { DirectorKPIRow } from "@/components/dashboard/DirectorKPIRow";
import { MetasProgress } from "@/components/dashboard/MetasProgress";
import { exportDashboardData } from "@/lib/exportHelpers";
import { useToast } from "@/hooks/use-toast";
import { getCustomWeekStart, getCustomWeekEnd } from "@/lib/dateHelpers";
import { useClintFunnel } from "@/hooks/useClintFunnel";
import { useEvolutionData } from "@/hooks/useEvolutionData";
import { useDirectorKPIs } from "@/hooks/useDirectorKPIs";
import { useTeamTargets } from "@/hooks/useTeamTargets";
import { formatCurrency } from "@/lib/formatters";
import { useQueryClient } from "@tanstack/react-query";
import { useDashboardPreferences } from "@/hooks/useDashboardPreferences";
import type { DashboardWidget } from "@/types/dashboard";

export default function Dashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { preferences } = useDashboardPreferences();
  const [periodo, setPeriodo] = useState({
    tipo: 'semana' as 'semana' | 'mes',
    inicio: getCustomWeekStart(new Date()),
    fim: getCustomWeekEnd(new Date()),
  });
  const [canal, setCanal] = useState('todos');
  const [sdrIa, setSdrIa] = useState(0); // Estado para SDR IA manual

  // Hooks de dados - CALCULA EM TEMPO REAL de hubla_transactions
  const { data: directorKPIs, isLoading: loadingKPIs, error: errorKPIs } = useDirectorKPIs(periodo.inicio, periodo.fim);
  const { data: evolutionData, isLoading: loadingEvolution, error: errorEvolution } = useEvolutionData(canal, 52);
  const PIPELINE_INSIDE_SALES_ID = "e3c04f21-ba2c-4c66-84f8-b4341c826b1c";
  const { data: a010Funnel, isLoading: loadingA010, error: errorA010 } = useClintFunnel(
    PIPELINE_INSIDE_SALES_ID,
    periodo.inicio,
    periodo.fim,
    false
  );
  
  // Buscar metas dinâmicas da tabela team_targets
  const { data: teamTargets } = useTeamTargets(periodo.inicio, periodo.fim);

  // Realtime listeners para atualização automática
  useEffect(() => {
    // Listener para hubla_transactions (vendas em tempo real)
    const hublaChannel = supabase
      .channel('hubla-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'hubla_transactions' },
        async (payload) => {
          console.log('💰 Nova venda Hubla:', payload);
          // Invalida E força refetch imediato
          await queryClient.invalidateQueries({ 
            queryKey: ['director-kpis'],
            refetchType: 'all'
          });
          await queryClient.refetchQueries({ 
            queryKey: ['director-kpis'],
            type: 'all'
          });
          queryClient.invalidateQueries({ queryKey: ['a010-novo-lead'], refetchType: 'all' });
          queryClient.invalidateQueries({ queryKey: ['evolution-data'], refetchType: 'all' });
          toast({
            title: "💰 Nova venda registrada",
            description: `${(payload.new as any)?.customer_name || 'Cliente'} - Dados atualizados!`,
          });
        }
      )
      .subscribe();

    // Listener para daily_costs (gastos ads)
    const costsChannel = supabase
      .channel('costs-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'daily_costs' },
        async () => {
          await queryClient.invalidateQueries({ 
            queryKey: ['director-kpis'],
            refetchType: 'all'
          });
          await queryClient.refetchQueries({ 
            queryKey: ['director-kpis'],
            type: 'all'
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(hublaChannel);
      supabase.removeChannel(costsChannel);
    };
  }, [queryClient, toast]);

  const isWidgetVisible = (widgetId: DashboardWidget) => {
    if (!preferences?.visible_widgets) return true;
    return preferences.visible_widgets.includes(widgetId);
  };

  const handleApplyFilters = (filters: { periodo: { tipo: 'semana' | 'mes'; inicio: Date; fim: Date }; canal: string }) => {
    setPeriodo(filters.periodo);
    setCanal(filters.canal);
    queryClient.invalidateQueries({ queryKey: ['director-kpis'] });
    queryClient.invalidateQueries({ queryKey: ['evolution-data'] });
    queryClient.invalidateQueries({ queryKey: ['funnel-data'] });
    toast({
      title: "Filtros aplicados",
      description: "Os dados do dashboard foram atualizados.",
    });
  };

  const handleClearFilters = () => {
    setPeriodo({
      tipo: 'semana',
      inicio: getCustomWeekStart(new Date()),
      fim: getCustomWeekEnd(new Date()),
    });
    setCanal('todos');
    queryClient.invalidateQueries({ queryKey: ['director-kpis'] });
    queryClient.invalidateQueries({ queryKey: ['evolution-data'] });
    queryClient.invalidateQueries({ queryKey: ['funnel-data'] });
    toast({
      title: "Filtros limpos",
      description: "Os filtros foram resetados para a semana atual.",
    });
  };

  const handleExport = () => {
    exportDashboardData({
      kpis: directorKPIs ? [
        { id: '1', title: 'Faturamento Total', value: formatCurrency(directorKPIs.faturamentoTotal.value), change: directorKPIs.faturamentoTotal.change, variant: 'success' },
        { id: '2', title: 'Gastos Ads', value: formatCurrency(directorKPIs.gastosAds.value), change: directorKPIs.gastosAds.change, variant: 'danger' },
      ] : [],
      funis: [{ titulo: 'Funil A010', etapas: a010Funnel || [] }],
      semanas: [],
      periodo,
      canal,
    });
    toast({
      title: "Dados exportados",
      description: "O arquivo CSV foi baixado com sucesso.",
    });
  };

  // Metas dinâmicas (busca da tabela team_targets, com fallback para valores padrão)
  const metas = useMemo(() => ({
    ultrametaClint: teamTargets?.find(t => t.target_type === 'ultrameta_clint')?.target_value || 337680,
    faturamentoClint: teamTargets?.find(t => t.target_type === 'faturamento_clint')?.target_value || 198377,
    ultrametaLiquido: teamTargets?.find(t => t.target_type === 'ultrameta_liquido')?.target_value || 281400,
    faturamentoLiquido: teamTargets?.find(t => t.target_type === 'faturamento_liquido')?.target_value || 159276,
  }), [teamTargets]);

  return (
    <ResourceGuard resource="dashboard">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground mt-1">Visão geral dos principais indicadores de desempenho</p>
          </div>
          <div className="flex gap-2">
            <ImportMetricsDialog />
            <RecalculateMetricsButton />
            <RecalculateOnlyMetricsButton />
            <TargetsConfigDialog />
            <PeriodComparison />
            <DashboardCustomizer />
          </div>
        </div>

        {/* Filtros */}
        <PeriodSelector 
          onApply={handleApplyFilters}
          onClear={handleClearFilters}
          onExport={handleExport}
        />

        {/* Erros */}
        {(errorKPIs || errorEvolution || errorA010) && (
          <Card className="bg-destructive/10 border-destructive">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                <div>
                  <p className="font-semibold">Erro ao carregar dados</p>
                  <p className="text-sm">
                    {errorKPIs && 'KPIs: ' + (errorKPIs as Error).message}
                    {errorEvolution && ' | Evolução: ' + (errorEvolution as Error).message}
                    {errorA010 && ' | Funil: ' + (errorA010 as Error).message}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Linha 1: 7 KPIs principais */}
        {isWidgetVisible('kpis') && directorKPIs && (
          <DirectorKPIRow
            faturamentoTotal={directorKPIs.faturamentoTotal}
            gastosAds={directorKPIs.gastosAds}
            cpl={directorKPIs.cpl}
            custoTotal={directorKPIs.custoTotal}
            lucro={directorKPIs.lucro}
            roi={directorKPIs.roi}
            roas={directorKPIs.roas}
            isLoading={loadingKPIs}
          />
        )}

        {/* Linha 2: Metas (esquerda) + Funil (direita) */}
        <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">
          {/* Coluna Esquerda - Metas com SDR IA (agora usando dados pré-calculados) */}
          {isWidgetVisible('ultrameta') && directorKPIs && (
            <MetasProgress
              ultrametaClint={directorKPIs.ultrametaClint + (sdrIa * 1400)}
              metaUltrametaClint={metas.ultrametaClint}
              faturamentoClintBruto={directorKPIs.faturamentoClint}
              metaFaturamentoClint={metas.faturamentoClint}
              ultrametaLiquido={directorKPIs.ultrametaLiquido}
              metaUltrametaLiquido={metas.ultrametaLiquido}
              faturamentoLiquido={directorKPIs.faturamentoLiquido}
              metaFaturamentoLiquido={metas.faturamentoLiquido}
              sdrIa={sdrIa}
              onSdrIaChange={setSdrIa}
              vendasA010={directorKPIs.vendasA010}
              isLoading={loadingKPIs}
            />
          )}

          {/* Coluna Direita - Funil */}
          {isWidgetVisible('funil-a010') && (
            <FunilDuplo
              originId="e3c04f21-ba2c-4c66-84f8-b4341c826b1c"
              weekStart={periodo.inicio}
              weekEnd={periodo.fim}
              showCurrentState={false}
            />
          )}
        </div>

        {/* Linha 3: Evolução Temporal */}
        {isWidgetVisible('grafico-evolucao') && (
          <>
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
          </>
        )}
      </div>
    </ResourceGuard>
  );
}
