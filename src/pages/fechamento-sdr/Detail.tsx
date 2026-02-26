import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SdrStatusBadge } from "@/components/sdr-fechamento/SdrStatusBadge";
import { SdrIndicatorCard } from "@/components/sdr-fechamento/SdrIndicatorCard";
import { SdrAdjustmentForm } from "@/components/sdr-fechamento/SdrAdjustmentForm";
import { KpiEditForm } from "@/components/sdr-fechamento/KpiEditForm";
import { IntermediacoesList } from "@/components/sdr-fechamento/IntermediacoesList";
import { NoShowIndicator } from "@/components/sdr-fechamento/NoShowIndicator";
import { DynamicIndicatorsGrid } from "@/components/fechamento/DynamicIndicatorCard";
import { useActiveMetricsForSdr } from "@/hooks/useActiveMetricsForSdr";
import { useCloserAgendaMetrics } from "@/hooks/useCloserAgendaMetrics";
import { useCalculatedVariavel } from "@/hooks/useCalculatedVariavel";
import { useSdrPayoutDetail, useSdrCompPlan, useSdrMonthKpi, useUpdatePayoutStatus } from "@/hooks/useSdrFechamento";
import { useRecalculateWithKpi, useAuthorizeUltrameta, useSdrIntermediacoes } from "@/hooks/useSdrKpiMutations";
import { useAuth } from "@/contexts/AuthContext";
import { formatCurrency, formatDateTime } from "@/lib/formatters";
import { PayoutAdjustment, SdrMonthKpi, SdrCompPlan, SdrMonthPayout, getMultiplierRange } from "@/types/sdr-fechamento";
import {
  ArrowLeft,
  Check,
  Lock,
  RefreshCw,
  Unlock,
  DollarSign,
  Target,
  Wallet,
  CreditCard,
  Gift,
  CheckCircle,
  Download,
  User,
} from "lucide-react";

// Component wrapper for dynamic indicators section
const DynamicIndicatorsSection = ({
  sdrId,
  anoMes,
  kpi,
  payout,
  compPlan,
  diasUteisMes,
  sdrMetaDiaria,
  isCloser,
  variavelTotal,
}: {
  sdrId: string;
  anoMes: string;
  kpi: SdrMonthKpi | null;
  payout: SdrMonthPayout;
  compPlan: SdrCompPlan | null;
  diasUteisMes: number;
  sdrMetaDiaria: number;
  isCloser: boolean;
  variavelTotal: number;
}) => {
  const { metricas, isLoading, fonte } = useActiveMetricsForSdr(sdrId, anoMes);

  return (
    <div>
      <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
        Indicadores de Meta
        {isCloser && <span className="text-muted-foreground font-normal">(Closer)</span>}
        {fonte === "configuradas" && (
          <Badge variant="outline" className="text-[10px]">
            Configurado
          </Badge>
        )}
        {fonte === "fallback" && (
          <Badge variant="secondary" className="text-[10px]">
            Padrão
          </Badge>
        )}
      </h2>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <DynamicIndicatorsGrid
          metricas={metricas}
          kpi={kpi}
          payout={payout}
          compPlan={compPlan}
          diasUteisMes={diasUteisMes}
          sdrMetaDiaria={sdrMetaDiaria}
          variavelTotal={variavelTotal}
        />
      )}
    </div>
  );
};

const FechamentoSDRDetail = () => {
  const { payoutId } = useParams<{ payoutId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fromMonth = searchParams.get('from');
  const fromBu = searchParams.get('bu');
  const { user, role } = useAuth();

  const { data: payout, isLoading } = useSdrPayoutDetail(payoutId);
  const { data: compPlan } = useSdrCompPlan(payout?.sdr_id, payout?.ano_mes || "");
  const { data: kpi } = useSdrMonthKpi(payout?.sdr_id, payout?.ano_mes || "");
  const { data: intermediacoes } = useSdrIntermediacoes(payout?.sdr_id, payout?.ano_mes || "");

  // Determine if Closer before hooks that need it
  const isCloser = (payout?.sdr as any)?.role_type === "closer";
  
  // Fetch Closer-specific metrics from Agenda (only for Closers)
  const closerMetrics = useCloserAgendaMetrics(
    isCloser ? payout?.sdr_id : undefined,
    payout?.ano_mes
  );

  // Fetch active metrics to get meta_percentual for contracts
  const { metricas: activeMetrics } = useActiveMetricsForSdr(payout?.sdr_id, payout?.ano_mes || "");
  const metricaContratos = activeMetrics?.find(m => m.nome_metrica === 'contratos');
  const metaContratosPercentual = metricaContratos?.meta_percentual ?? undefined;

  const updateStatus = useUpdatePayoutStatus();
  const recalculateWithKpi = useRecalculateWithKpi();
  const authorizeUltrameta = useAuthorizeUltrameta();

  // Calculate values needed for useCalculatedVariavel BEFORE early returns
  const sdrMetaDiariaEarly = (payout?.sdr as any)?.meta_diaria || 10;
  const diasUteisMesEarly = payout?.dias_uteis_mes || 19;
  const employeeEarly = (payout as any)?.employee;
  const effectiveVariavelEarly = compPlan?.variavel_total || employeeEarly?.cargo_catalogo?.variavel_valor || 1200;

  // Create effective KPI with Closer-specific metrics from Agenda (BEFORE early returns)
  const effectiveKpiEarly: SdrMonthKpi | null = kpi 
    ? isCloser && closerMetrics.data
      ? {
          ...kpi,
          reunioes_realizadas: closerMetrics.data.r1_realizadas,
          no_shows: closerMetrics.data.no_shows,
          intermediacoes_contrato: closerMetrics.data.contratos_pagos,
        }
      : kpi
    : null;

  // Calculate variable pay BEFORE early returns (hook handles null values)
  const calculatedVariavel = useCalculatedVariavel({
    metricas: activeMetrics,
    kpi: effectiveKpiEarly,
    payout,
    compPlan,
    diasUteisMes: diasUteisMesEarly,
    sdrMetaDiaria: sdrMetaDiariaEarly,
    variavelTotal: effectiveVariavelEarly,
  });

  const isAdmin = role === "admin";
  const isManager = role === "manager" || role === "coordenador";
  const canEdit = (isAdmin || isManager) && payout?.status !== "LOCKED";
  const canReopen = isAdmin && payout?.status === "LOCKED";
  const isReadOnly = role === "sdr";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!payout) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Fechamento não encontrado.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate(fromMonth ? `/fechamento-sdr?month=${fromMonth}${fromBu ? `&bu=${fromBu}` : ''}` : `/fechamento-sdr${fromBu ? `?bu=${fromBu}` : ''}`)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
      </div>
    );
  }

  const handleApprove = () => {
    if (!user) return;
    updateStatus.mutate({
      payoutId: payout.id,
      status: "APPROVED",
      userId: user.id,
    });
  };

  const handleLock = () => {
    if (!user) return;
    updateStatus.mutate({
      payoutId: payout.id,
      status: "LOCKED",
      userId: user.id,
    });
  };

  const handleReopen = () => {
    if (!user) return;
    updateStatus.mutate({
      payoutId: payout.id,
      status: "DRAFT",
      userId: user.id,
    });
  };

  const handleSaveKpi = (kpiData: Partial<SdrMonthKpi>) => {
    recalculateWithKpi.mutate({
      sdrId: payout.sdr_id,
      anoMes: payout.ano_mes,
      kpiData,
    });
  };

  const handleAuthorizeUltrameta = () => {
    authorizeUltrameta.mutate({
      payoutId: payout.id,
      authorize: !payout.ifood_ultrameta_autorizado,
    });
  };

  const handleExportIndividual = () => {
    const sdrName = payout.sdr?.name || "SDR";

    // Get employee data from payout (attached by useSdrPayouts hook)
    const employee = (payout as any).employee;

    // Priority: 1) RH cargo_catalogo.nivel, 2) legacy sdr.nivel, 3) fallback 1
    const nivel = employee?.cargo_catalogo?.nivel || payout.sdr?.nivel || 1;

    // Priority: 1) compPlan vigente, 2) RH cargo_catalogo.ote_total, 3) fallback 4000
    const ote = compPlan?.ote_total || employee?.cargo_catalogo?.ote_total || 4000;

    const adjustments = payout.ajustes_json || [];
    const totalAjustes = adjustments.reduce((sum: number, adj: PayoutAdjustment) => sum + (adj.valor || 0), 0);

    const lines = [
      `FECHAMENTO - ${sdrName}`,
      `Período: ${payout.ano_mes}`,
      `Status: ${payout.status}`,
      `Nível: ${nivel}`,
      "",
      "=== RESUMO FINANCEIRO ===",
      `OTE Total;${ote}`,
      `Valor Fixo;${payout.valor_fixo || 0}`,
      `Valor Variável;${payout.valor_variavel_total || 0}`,
      `Total Conta;${payout.total_conta || 0}`,
      `iFood Mensal;${payout.ifood_mensal || 0}`,
      `iFood Ultrameta;${payout.ifood_ultrameta || 0}`,
      `iFood Ultrameta Autorizado;${payout.ifood_ultrameta_autorizado ? "Sim" : "Não"}`,
      `Total iFood;${payout.total_ifood || 0}`,
      "",
      "=== INDICADORES DE META ===",
      "Indicador;Meta;Realizado;%;Faixa;Multiplicador;Valor Base;Valor Final",
      `Agendamento;${compPlan?.meta_reunioes_agendadas || 0};${kpi?.reunioes_agendadas || 0};${(payout.pct_reunioes_agendadas || 0).toFixed(1)}%;${getMultiplierRange(payout.pct_reunioes_agendadas || 0)};${payout.mult_reunioes_agendadas || 0}x;${compPlan?.valor_meta_rpg || 0};${payout.valor_reunioes_agendadas || 0}`,
      `Reuniões Realizadas;${compPlan?.meta_reunioes_realizadas || 0};${kpi?.reunioes_realizadas || 0};${(payout.pct_reunioes_realizadas || 0).toFixed(1)}%;${getMultiplierRange(payout.pct_reunioes_realizadas || 0)};${payout.mult_reunioes_realizadas || 0}x;${compPlan?.valor_docs_reuniao || 0};${payout.valor_reunioes_realizadas || 0}`,
      `Tentativas de Ligações;${compPlan?.meta_tentativas || 0};${kpi?.tentativas_ligacoes || 0};${(payout.pct_tentativas || 0).toFixed(1)}%;${getMultiplierRange(payout.pct_tentativas || 0)};${payout.mult_tentativas || 0}x;${compPlan?.valor_tentativas || 0};${payout.valor_tentativas || 0}`,
      `Organização Clint;${compPlan?.meta_organizacao || 100};${kpi?.score_organizacao || 0};${(payout.pct_organizacao || 0).toFixed(1)}%;${getMultiplierRange(payout.pct_organizacao || 0)};${payout.mult_organizacao || 0}x;${compPlan?.valor_organizacao || 0};${payout.valor_organizacao || 0}`,
      `No-Shows;-;${kpi?.no_shows || 0};Taxa: ${kpi?.taxa_no_show?.toFixed(1) || 0}%;-;-;-;-`,
      "",
    ];

    if (adjustments.length > 0) {
      lines.push("=== AJUSTES MANUAIS ===");
      lines.push("Tipo;Motivo;Valor;Data");
      adjustments.forEach((adj: PayoutAdjustment) => {
        lines.push(`${adj.tipo};${adj.motivo};${adj.valor};${adj.created_at}`);
      });
      lines.push(`Total Ajustes;;${totalAjustes};`);
      lines.push("");
    }

    if (payout.aprovado_em) {
      lines.push("=== APROVAÇÃO ===");
      lines.push(`Aprovado em: ${payout.aprovado_em}`);
    }

    const csvContent = lines.join("\n");
    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `fechamento-${sdrName.replace(/\s+/g, "-").toLowerCase()}-${payout.ano_mes}.csv`;
    link.click();
  };

  const adjustments = payout.ajustes_json || [];
  const intermediacaoCount = intermediacoes?.length || 0;

  // Check if SDR met ultrameta criteria (avg >= 100%)
  const avgPerformance =
    ((payout.pct_reunioes_agendadas || 0) +
      (payout.pct_reunioes_realizadas || 0) +
      (payout.pct_tentativas || 0) +
      (payout.pct_organizacao || 0)) /
    4;
  const metUltrameta = avgPerformance >= 100;

  // Use early-calculated values (computed before early returns for hooks consistency)
  const sdrMetaDiaria = sdrMetaDiariaEarly;
  const diasUteisMes = diasUteisMesEarly;
  const employee = employeeEarly;
  const effectiveOTE = compPlan?.ote_total || employee?.cargo_catalogo?.ote_total || 4000;
  const effectiveFixo = compPlan?.fixo_valor || employee?.cargo_catalogo?.fixo_valor || 2800;
  const effectiveVariavel = effectiveVariavelEarly;
  const oteSource = compPlan?.ote_total ? "plano" : employee?.cargo_catalogo?.ote_total ? "RH" : "fallback";
  const effectiveKpi = effectiveKpiEarly;

  // Closer-specific intermediações count (use agenda data for Closers)
  const effectiveIntermediacao = isCloser && closerMetrics.data 
    ? closerMetrics.data.contratos_pagos 
    : intermediacaoCount;

  // Vendas parceria for Closers
  const vendasParceria = isCloser && closerMetrics.data 
    ? closerMetrics.data.vendas_parceria 
    : 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(fromMonth ? `/fechamento-sdr?month=${fromMonth}${fromBu ? `&bu=${fromBu}` : ''}` : `/fechamento-sdr${fromBu ? `?bu=${fromBu}` : ''}`)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold flex items-center gap-2">
              {payout.sdr?.name || "SDR"}
              <SdrStatusBadge status={payout.status} />
              {isCloser && (
                <Badge variant="secondary" className="text-xs">
                  <User className="h-3 w-3 mr-1" />
                  Closer
                </Badge>
              )}
            </h1>
            <p className="text-sm text-muted-foreground">Fechamento de {payout.ano_mes}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportIndividual}>
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Exportar
          </Button>

          {!isReadOnly && (
            <>
              {canEdit && (
                <>
                  {payout.status === "DRAFT" && (
                    <Button size="sm" onClick={handleApprove} disabled={updateStatus.isPending}>
                      <Check className="h-3.5 w-3.5 mr-1.5" />
                      Aprovar
                    </Button>
                  )}

                  {payout.status === "APPROVED" && (
                    <Button size="sm" onClick={handleLock} disabled={updateStatus.isPending}>
                      <Lock className="h-3.5 w-3.5 mr-1.5" />
                      Travar Mês
                    </Button>
                  )}
                </>
              )}

              {canReopen && (
                <Button variant="outline" size="sm" onClick={handleReopen} disabled={updateStatus.isPending}>
                  <Unlock className="h-3.5 w-3.5 mr-1.5" />
                  Reabrir
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      {/* Using pre-calculated effectiveOTE/effectiveFixo/effectiveVariavel/oteSource from above */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-1.5 text-muted-foreground/70 text-xs">
                  <Target className="h-3.5 w-3.5" />
                  OTE Total
                  {oteSource === "RH" && (
                    <Badge variant="outline" className="text-[9px] h-4 ml-1">
                      RH
                    </Badge>
                  )}
                </div>
                <div className="text-xl font-bold mt-1">{formatCurrency(effectiveOTE)}</div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-1.5 text-muted-foreground/70 text-xs">
                  <Wallet className="h-3.5 w-3.5" />
                  Fixo
                  {oteSource === "RH" && (
                    <Badge variant="outline" className="text-[9px] h-4 ml-1">
                      RH
                    </Badge>
                  )}
                </div>
                <div className="text-xl font-bold mt-1">{formatCurrency(effectiveFixo)}</div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-1.5 text-muted-foreground/70 text-xs">
                  <DollarSign className="h-3.5 w-3.5" />
                  Variável
                  {oteSource === "RH" && (
                    <Badge variant="outline" className="text-[9px] h-4 ml-1">
                      RH
                    </Badge>
                  )}
                  {Math.abs(calculatedVariavel.total - (payout.valor_variavel_total || 0)) > 1 && (
                    <Badge variant="destructive" className="text-[9px] h-4 ml-1">
                      Recalcular
                    </Badge>
                  )}
                </div>
                <div className="text-xl font-bold mt-1 text-primary">
                  {formatCurrency(calculatedVariavel.total)}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-primary/10 border-primary/20">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-1.5 text-primary text-xs">
                  <CreditCard className="h-3.5 w-3.5" />
                  Total Conta
                  {Math.abs((effectiveFixo + calculatedVariavel.total) - (payout.total_conta || 0)) > 1 && (
                    <Badge variant="destructive" className="text-[9px] h-4 ml-1">
                      Recalcular
                    </Badge>
                  )}
                </div>
                <div className="text-xl font-bold mt-1 text-primary">
                  {formatCurrency(effectiveFixo + calculatedVariavel.total)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="text-muted-foreground/70 text-xs">iFood Mensal</div>
                <div className="text-xl font-bold mt-1">{formatCurrency(payout.ifood_mensal || 0)}</div>
              </CardContent>
            </Card>

            <Card className={payout.ifood_ultrameta_autorizado ? "bg-green-500/10 border-green-500/20" : ""}>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-1.5 text-xs">
                  <Gift className="h-3.5 w-3.5" />
                  <span className={payout.ifood_ultrameta_autorizado ? "text-green-500" : "text-muted-foreground/70"}>
                    iFood Ultrameta
                  </span>
                  {payout.ifood_ultrameta_autorizado && <CheckCircle className="h-3.5 w-3.5 text-green-500" />}
                </div>
                <div className={`text-xl font-bold mt-1 ${payout.ifood_ultrameta_autorizado ? "text-green-500" : ""}`}>
                  {formatCurrency(payout.ifood_ultrameta || 0)}
                </div>
                {metUltrameta && isAdmin && !payout.ifood_ultrameta_autorizado && payout.status !== "LOCKED" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-1.5 w-full text-[10px] h-6"
                    onClick={handleAuthorizeUltrameta}
                    disabled={authorizeUltrameta.isPending}
                  >
                    Autorizar
                  </Button>
                )}
                {payout.ifood_ultrameta_autorizado && isAdmin && payout.status !== "LOCKED" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="mt-1.5 w-full text-[10px] h-6 text-muted-foreground"
                    onClick={handleAuthorizeUltrameta}
                    disabled={authorizeUltrameta.isPending}
                  >
                    Remover autorização
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>

      {/* KPI Edit Form (for admin/manager) */}
      {canEdit && (
        <KpiEditForm
          kpi={effectiveKpi}
          compPlan={compPlan || null}
          sdrId={payout.sdr_id}
          anoMes={payout.ano_mes}
          disabled={!canEdit}
          onSave={handleSaveKpi}
          isSaving={recalculateWithKpi.isPending}
          intermediacoes={effectiveIntermediacao}
          sdrMetaDiaria={(payout.sdr as any)?.meta_diaria || 10}
          diasUteisMes={payout.dias_uteis_mes || 19}
          roleType={(payout.sdr as any)?.role_type || "sdr"}
          vendasParceria={vendasParceria}
          metaContratosPercentual={metaContratosPercentual}
        />
      )}

      {/* Dynamic Indicators Grid */}
      <DynamicIndicatorsSection
        sdrId={payout.sdr_id}
        anoMes={payout.ano_mes}
        kpi={effectiveKpi}
        payout={payout}
        compPlan={compPlan || null}
        diasUteisMes={diasUteisMes}
        sdrMetaDiaria={sdrMetaDiaria}
        isCloser={isCloser}
        variavelTotal={effectiveVariavel}
      />

      {/* Intermediações / Vendas Parceria */}
      <IntermediacoesList sdrId={payout.sdr_id} anoMes={payout.ano_mes} disabled={!canEdit} isCloser={isCloser} />

      {/* Adjustments (only for admin/manager) */}
      {!isReadOnly && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm font-semibold">Ajustes Manuais</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <SdrAdjustmentForm payoutId={payout.id} disabled={!canEdit} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm font-semibold">Histórico de Ajustes</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {adjustments.length === 0 ? (
                <p className="text-muted-foreground/70 text-xs">Nenhum ajuste registrado.</p>
              ) : (
                <div className="space-y-2">
                  {adjustments.map((adj: PayoutAdjustment, idx: number) => (
                    <div key={idx} className="flex items-start justify-between p-2.5 rounded-lg bg-muted/50">
                      <div>
                        <div className="text-sm font-medium capitalize">{adj.tipo}</div>
                        <div className="text-xs text-muted-foreground/70">{adj.motivo}</div>
                        <div className="text-[10px] text-muted-foreground/60 mt-0.5">
                          {formatDateTime(adj.created_at)}
                        </div>
                      </div>
                      <div className={`text-sm font-bold ${adj.valor >= 0 ? "text-green-400" : "text-red-400"}`}>
                        {adj.valor >= 0 ? "+" : ""}
                        {formatCurrency(adj.valor)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Approval Info */}
      {payout.aprovado_em && payout.aprovado_por && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Check className="h-4 w-4 text-green-400" />
              Aprovado em {formatDateTime(payout.aprovado_em)}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default FechamentoSDRDetail;
