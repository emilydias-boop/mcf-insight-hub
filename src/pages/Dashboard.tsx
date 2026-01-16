// Dashboard - Director Panel with sector metrics
import { useState, useEffect } from "react";
import { ResourceGuard } from "@/components/auth/ResourceGuard";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";
import { PendingMetricsAlert } from "@/components/dashboard/PendingMetricsAlert";
import { MetricsApprovalDialog } from "@/components/dashboard/MetricsApprovalDialog";
import { SetorRow } from "@/components/dashboard/SetorRow";
import { EfeitoAlavancaRow } from "@/components/dashboard/EfeitoAlavancaRow";
import { useSetoresDashboard } from "@/hooks/useSetoresDashboard";
import { useQueryClient } from "@tanstack/react-query";

export default function Dashboard() {
  const queryClient = useQueryClient();
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);

  // Hook para dados dos setores (busca semana/mês/ano automaticamente)
  const { data, isLoading, error } = useSetoresDashboard();

  // Realtime listeners para atualização automática
  useEffect(() => {
    const channel = supabase
      .channel('dashboard-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'hubla_transactions' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['setores-dashboard'] });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'consortium_payments' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['setores-dashboard'] });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'consortium_cards' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['setores-dashboard'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return (
    <ResourceGuard resource="dashboard">
      <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
        {/* Alert para métricas pendentes de aprovação */}
        <PendingMetricsAlert onReviewClick={() => setApprovalDialogOpen(true)} />
        
        {/* Dialog de aprovação */}
        <MetricsApprovalDialog 
          open={approvalDialogOpen} 
          onOpenChange={setApprovalDialogOpen} 
        />

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Painel do Diretor</h1>
            <p className="text-muted-foreground text-xs sm:text-sm hidden sm:block">
              Visão consolidada de metas e resultados por setor
            </p>
          </div>
        </div>

        {/* Erros */}
        {error && (
          <Card className="bg-destructive/10 border-destructive">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                <div>
                  <p className="font-semibold">Erro ao carregar dados</p>
                  <p className="text-sm">{(error as Error).message}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Setores em Linhas */}
        <div className="space-y-4">
          {isLoading ? (
            // Loading skeletons
            Array.from({ length: 5 }).map((_, i) => (
              <SetorRow
                key={i}
                titulo=""
                icone={AlertTriangle}
                metaSemanal={0}
                apuradoSemanal={0}
                semanaLabel=""
                metaMensal={0}
                apuradoMensal={0}
                mesLabel=""
                metaAnual={0}
                apuradoAnual={0}
                isLoading
              />
            ))
          ) : (
            data?.setores.map(setor => 
              setor.id === 'efeito_alavanca' ? (
                <EfeitoAlavancaRow
                  key={setor.id}
                  semanaLabel={data.semanaLabel}
                  mesLabel={data.mesLabel}
                  totalCartasSemanal={setor.apuradoSemanal}
                  comissaoSemanal={setor.comissaoSemanal || 0}
                  totalCartasMensal={setor.apuradoMensal}
                  comissaoMensal={setor.comissaoMensal || 0}
                  totalCartasAnual={setor.apuradoAnual}
                  comissaoAnual={setor.comissaoAnual || 0}
                />
              ) : (
                <SetorRow
                  key={setor.id}
                  titulo={setor.nome}
                  icone={setor.icone}
                  metaSemanal={setor.metaSemanal}
                  apuradoSemanal={setor.apuradoSemanal}
                  semanaLabel={data.semanaLabel}
                  metaMensal={setor.metaMensal}
                  apuradoMensal={setor.apuradoMensal}
                  mesLabel={data.mesLabel}
                  metaAnual={setor.metaAnual}
                  apuradoAnual={setor.apuradoAnual}
                />
              )
            )
          )}
        </div>
      </div>
    </ResourceGuard>
  );
}
