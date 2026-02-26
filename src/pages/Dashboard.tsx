// Dashboard - Director Panel with sector metrics
import { useEffect, useState } from "react";
import { ResourceGuard } from "@/components/auth/ResourceGuard";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";
import { SetorRow } from "@/components/dashboard/SetorRow";
import { EfeitoAlavancaRow } from "@/components/dashboard/EfeitoAlavancaRow";
import { TotalGeralRow } from "@/components/dashboard/TotalGeralRow";
import { useSetoresDashboard } from "@/hooks/useSetoresDashboard";
import { Separator } from "@/components/ui/separator";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { BURevenueGoalsEditModal, BURevenueSection } from "@/components/sdr/BURevenueGoalsEditModal";

const SETOR_MODAL_CONFIG: Record<string, { title: string; sections: BURevenueSection[] }> = {
  incorporador: {
    title: "MCF Incorporador",
    sections: [{ prefix: "setor_incorporador", label: "Incorporador" }],
  },
  efeito_alavanca: {
    title: "Efeito Alavanca",
    sections: [{ prefix: "setor_efeito_alavanca", label: "Efeito Alavanca (Valor em Carta)" }],
  },
  credito: {
    title: "MCF Crédito",
    sections: [{ prefix: "setor_credito", label: "Crédito (Comissão)" }],
  },
  projetos: {
    title: "MCF Projetos",
    sections: [{ prefix: "setor_projetos", label: "Projetos" }],
  },
  leilao: {
    title: "MCF Leilão",
    sections: [{ prefix: "setor_leilao", label: "Leilão" }],
  },
};

export default function Dashboard() {
  const queryClient = useQueryClient();
  const { role } = useAuth();
  const canEdit = !!role && ['admin', 'manager', 'coordenador'].includes(role);

  const [editingSetor, setEditingSetor] = useState<string | null>(null);

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

  const modalConfig = editingSetor ? SETOR_MODAL_CONFIG[editingSetor] : null;

  return (
    <ResourceGuard resource="dashboard">
      <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6">

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

        {/* Quadro Geral - Totais Consolidados */}
        <TotalGeralRow
          semanaLabel={data?.semanaLabel || ""}
          mesLabel={data?.mesLabel || ""}
          apuradoSemanal={data?.totais?.apuradoSemanal || 0}
          metaSemanal={data?.totais?.metaSemanal || 0}
          apuradoMensal={data?.totais?.apuradoMensal || 0}
          metaMensal={data?.totais?.metaMensal || 0}
          apuradoAnual={data?.totais?.apuradoAnual || 0}
          metaAnual={data?.totais?.metaAnual || 0}
          isLoading={isLoading}
        />

        <Separator className="my-2" />

        {/* Setores em Linhas */}
        <div className="space-y-4">
          {isLoading ? (
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
                  metaSemanal={setor.metaSemanal}
                  totalCartasMensal={setor.apuradoMensal}
                  comissaoMensal={setor.comissaoMensal || 0}
                  metaMensal={setor.metaMensal}
                  totalCartasAnual={setor.apuradoAnual}
                  comissaoAnual={setor.comissaoAnual || 0}
                  metaAnual={setor.metaAnual}
                  onEditGoals={canEdit ? () => setEditingSetor('efeito_alavanca') : undefined}
                  canEdit={canEdit}
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
                  onEditGoals={canEdit ? () => setEditingSetor(setor.id) : undefined}
                  canEdit={canEdit}
                />
              )
            )
          )}
        </div>

        {/* Modal genérico de edição de metas */}
        {modalConfig && (
          <BURevenueGoalsEditModal
            open={!!editingSetor}
            onOpenChange={(open) => { if (!open) setEditingSetor(null); }}
            title={modalConfig.title}
            sections={modalConfig.sections}
          />
        )}
      </div>
    </ResourceGuard>
  );
}
