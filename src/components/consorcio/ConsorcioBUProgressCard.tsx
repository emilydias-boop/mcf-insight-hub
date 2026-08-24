import { useState } from "react";
import { startOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns";
import { TrendingUp, Info, Settings2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { SetorRow } from "@/components/dashboard/SetorRow";
import { useSetoresDashboard } from "@/hooks/useSetoresDashboard";
import { useConsorcioSummary } from "@/hooks/useConsorcio";
import { BURevenueGoalsEditModal } from "@/components/sdr/BURevenueGoalsEditModal";
import { CONSORCIO_WEEK_STARTS_ON } from "@/lib/businessDays";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Faixa de progresso "BU Consórcio" (Semana / Mês / Ano) com Apurado × Meta.
 *
 * Movida do Painel Comercial (`/consorcio/painel-equipe`) para o BI Consórcio.
 * Os cálculos e as fontes são exatamente os mesmos de antes: janelas fixas
 * (semana corrente / mês corrente / ano corrente), sem depender de filtro de
 * período de tela nenhuma.
 */
export function ConsorcioBUProgressCard() {
  const { role } = useAuth();
  const canEdit = !!role && ["admin", "manager", "coordenador"].includes(role);
  const [editOpen, setEditOpen] = useState(false);

  const { data: setoresData, isLoading: setoresLoading } = useSetoresDashboard();
  const efeitoAlavanca = setoresData?.setores.find((s) => s.id === "efeito_alavanca");
  const credito = setoresData?.setores.find((s) => s.id === "credito");

  const today = new Date();
  const todayNorm = startOfDay(today);
  const wStart = startOfWeek(todayNorm, { weekStartsOn: CONSORCIO_WEEK_STARTS_ON });
  const wEnd = endOfWeek(todayNorm, { weekStartsOn: CONSORCIO_WEEK_STARTS_ON });
  const mStart = startOfMonth(today);
  const mEnd = endOfMonth(today);
  const yStart = startOfYear(today);
  const yEnd = endOfYear(today);

  const { data: weeklySummary, isLoading: wLoading } = useConsorcioSummary({ startDate: wStart, endDate: wEnd });
  const { data: monthlySummary, isLoading: mLoading } = useConsorcioSummary({ startDate: mStart, endDate: mEnd });
  const { data: annualSummary, isLoading: yLoading } = useConsorcioSummary({ startDate: yStart, endDate: yEnd });

  const summaryLoading = wLoading || mLoading || yLoading;

  if (!efeitoAlavanca && !credito && !setoresLoading && !summaryLoading) return null;

  const combined = {
    apuradoSemanal: (weeklySummary?.totalCredito || 0) + (credito?.apuradoSemanal || 0),
    metaSemanal: (efeitoAlavanca?.metaSemanal || 0) + (credito?.metaSemanal || 0),
    apuradoMensal: (monthlySummary?.totalCredito || 0) + (credito?.apuradoMensal || 0),
    metaMensal: (efeitoAlavanca?.metaMensal || 0) + (credito?.metaMensal || 0),
    apuradoAnual: (annualSummary?.totalCredito || 0) + (credito?.apuradoAnual || 0),
    metaAnual: (efeitoAlavanca?.metaAnual || 0) + (credito?.metaAnual || 0),
  };

  return (
    <>
      <div className="relative group">
        <div className="absolute -inset-0.5 bg-gradient-to-r from-primary via-primary/60 to-primary rounded-xl blur opacity-30 group-hover:opacity-50 transition-opacity duration-300" />
        <div className="relative">
          <SetorRow
            titulo="BU Consórcio"
            icone={TrendingUp}
            semanaLabel={setoresData?.semanaLabel || "Semana"}
            mesLabel={setoresData?.mesLabel || "Mês"}
            apuradoSemanal={combined.apuradoSemanal}
            metaSemanal={combined.metaSemanal}
            apuradoMensal={combined.apuradoMensal}
            metaMensal={combined.metaMensal}
            apuradoAnual={combined.apuradoAnual}
            metaAnual={combined.metaAnual}
            isLoading={setoresLoading || summaryLoading}
          />
          <TooltipProvider delayDuration={100}>
            <div className="absolute top-3 right-3 flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="p-1.5 rounded-md hover:bg-accent/50 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="Origem dos valores"
                  >
                    <Info className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="left" className="max-w-sm text-xs leading-relaxed">
                  <div className="space-y-2">
                    <div>
                      <p className="font-semibold text-foreground">Apurado (Semana / Mês / Ano)</p>
                      <p>
                        Soma de <b>valor_credito</b> de todas as cotas cadastradas em
                        <b> BU Consórcio → Controle Consórcio</b> (rota <code>/consorcio</code>),
                        filtradas por <b>data de contratação</b> dentro do período.
                      </p>
                      <p className="mt-1">
                        Cotas novas entram via <b>Adicionar Cota</b> ou aprovando em
                        <b> Cotas a Fazer</b> (rota <code>/consorcio</code>).
                      </p>
                      <p className="mt-1">
                        + Comissão do setor <b>Crédito Imobiliário</b> registrada em
                        <b> BU Consórcio → Pagamentos</b> (rota <code>/consorcio/pagamentos</code>).
                      </p>
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">Meta (Semana / Mês / Ano)</p>
                      <p>
                        Configurada pelo botão <b>engrenagem ⚙️</b> ao lado
                        (permissão de admin/manager/coordenador). Chaves:
                        <code> setor_efeito_alavanca_[semana|mes|ano] </code> +
                        <code> setor_credito_[semana|mes|ano]</code>.
                      </p>
                    </div>
                    <div className="pt-1 border-t border-border/50">
                      <p className="text-muted-foreground">
                        Semana: segunda a domingo · Mês: mês corrente · Ano: 2026 completo.
                      </p>
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
              {canEdit && (
                <button
                  onClick={() => setEditOpen(true)}
                  className="p-1.5 rounded-md hover:bg-accent/50 text-muted-foreground hover:text-foreground transition-colors"
                  title="Editar metas"
                >
                  <Settings2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </TooltipProvider>
        </div>
      </div>

      <BURevenueGoalsEditModal
        open={editOpen}
        onOpenChange={setEditOpen}
        title="BU Consórcio"
        sections={[
          { prefix: "setor_efeito_alavanca", label: "Efeito Alavanca (Valor em Carta)" },
          { prefix: "setor_credito", label: "Crédito (Comissão)" },
        ]}
      />
    </>
  );
}
