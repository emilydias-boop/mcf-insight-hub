import { useState, useEffect } from "react";
import { ResourceGuard } from "@/components/auth/ResourceGuard";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";
import { TargetsConfigDialog } from "@/components/dashboard/TargetsConfigDialog";
import { PeriodSelector } from "@/components/dashboard/PeriodSelector";
import { PeriodComparison } from "@/components/dashboard/PeriodComparison";
import { DashboardCustomizer } from "@/components/dashboard/DashboardCustomizer";
import { PendingMetricsAlert } from "@/components/dashboard/PendingMetricsAlert";
import { MetricsApprovalDialog } from "@/components/dashboard/MetricsApprovalDialog";
import { NotificationBadge } from "@/components/dashboard/NotificationBadge";
import { SetorCard } from "@/components/dashboard/SetorCard";
import { exportDashboardData } from "@/lib/exportHelpers";
import { useToast } from "@/hooks/use-toast";
import { getCustomWeekStart, getCustomWeekEnd } from "@/lib/dateHelpers";
import { useSetoresDashboard } from "@/hooks/useSetoresDashboard";
import { formatCurrency } from "@/lib/formatters";
import { useQueryClient } from "@tanstack/react-query";
import { format, isSameMonth, startOfMonth, endOfMonth } from "date-fns";

export default function Dashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [periodo, setPeriodo] = useState({
    tipo: 'semana' as 'semana' | 'mes',
    inicio: getCustomWeekStart(new Date()),
    fim: getCustomWeekEnd(new Date()),
  });
  const [canal, setCanal] = useState('todos');
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);

  // Hook para dados dos setores
  const { data: setoresData, isLoading: loadingSetores, error: errorSetores } = useSetoresDashboard(
    periodo.inicio,
    periodo.fim
  );

  // Determinar label do período para os cards
  const getPeriodoLabel = (): string => {
    const today = new Date();
    const isCurrentMonth = isSameMonth(periodo.inicio, today) && 
                           periodo.inicio.getDate() === 1 && 
                           periodo.fim.getDate() === endOfMonth(today).getDate();
    
    if (isCurrentMonth) {
      return "Mês Atual";
    }
    
    // Se é um range customizado ou semana
    return `${format(periodo.inicio, 'dd/MM')} - ${format(periodo.fim, 'dd/MM')}`;
  };

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
          await queryClient.invalidateQueries({ 
            queryKey: ['setores-dashboard'],
            refetchType: 'all'
          });
          toast({
            title: "💰 Nova venda registrada",
            description: `${(payload.new as any)?.customer_name || 'Cliente'} - Dados atualizados!`,
          });
        }
      )
      .subscribe();

    // Listener para consortium_payments
    const consorcioChannel = supabase
      .channel('consorcio-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'consortium_payments' },
        async () => {
          await queryClient.invalidateQueries({ 
            queryKey: ['setores-dashboard'],
            refetchType: 'all'
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(hublaChannel);
      supabase.removeChannel(consorcioChannel);
    };
  }, [queryClient, toast]);

  const handleApplyFilters = (filters: { periodo: { tipo: 'semana' | 'mes'; inicio: Date; fim: Date }; canal: string }) => {
    setPeriodo(filters.periodo);
    setCanal(filters.canal);
    queryClient.invalidateQueries({ queryKey: ['setores-dashboard'] });
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
    queryClient.invalidateQueries({ queryKey: ['setores-dashboard'] });
    toast({
      title: "Filtros limpos",
      description: "Os filtros foram resetados para a semana atual.",
    });
  };

  const handleExport = () => {
    exportDashboardData({
      kpis: setoresData?.map(setor => ({
        id: setor.id,
        title: setor.nome,
        value: formatCurrency(setor.apuradoPeriodo),
        change: 0,
        variant: 'success' as const,
      })) || [],
      funis: [],
      semanas: [],
      periodo,
      canal,
    });
    toast({
      title: "Dados exportados",
      description: "O arquivo CSV foi baixado com sucesso.",
    });
  };

  return (
    <ResourceGuard resource="dashboard">
      <div className="p-6 space-y-6">
        {/* Alert para métricas pendentes de aprovação */}
        <PendingMetricsAlert onReviewClick={() => setApprovalDialogOpen(true)} />
        
        {/* Dialog de aprovação */}
        <MetricsApprovalDialog 
          open={approvalDialogOpen} 
          onOpenChange={setApprovalDialogOpen} 
        />

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground mt-1">Visão geral dos principais indicadores de desempenho</p>
          </div>
          <div className="flex gap-2">
            <NotificationBadge />
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
        {errorSetores && (
          <Card className="bg-destructive/10 border-destructive">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                <div>
                  <p className="font-semibold">Erro ao carregar dados</p>
                  <p className="text-sm">{(errorSetores as Error).message}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Grid de 5 Setores */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {setoresData?.map(setor => (
            <SetorCard
              key={setor.id}
              titulo={setor.nome}
              icone={setor.icone}
              metaMensal={setor.metaMensal}
              apuradoMensal={setor.apuradoPeriodo}
              metaAnual={setor.metaAnual}
              apuradoAnual={setor.apuradoAnual}
              periodoLabel={getPeriodoLabel()}
              isLoading={loadingSetores}
            />
          ))}
          
          {/* Skeletons enquanto carrega */}
          {loadingSetores && !setoresData && (
            <>
              {[1, 2, 3, 4, 5].map(i => (
                <SetorCard
                  key={i}
                  titulo=""
                  icone={AlertTriangle}
                  metaMensal={0}
                  apuradoMensal={0}
                  metaAnual={0}
                  apuradoAnual={0}
                  isLoading={true}
                />
              ))}
            </>
          )}
        </div>
      </div>
    </ResourceGuard>
  );
}
