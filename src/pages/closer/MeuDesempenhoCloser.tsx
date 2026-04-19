import { useMemo, useState } from "react";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { RefreshCw, TrendingUp, ChevronLeft, ChevronRight, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useMyCloser } from "@/hooks/useMyCloser";
import { useCloserDetailData } from "@/hooks/useCloserDetailData";
import { useCloserR2Metrics } from "@/hooks/useCloserR2Metrics";
import { useR1CloserMetrics } from "@/hooks/useR1CloserMetrics";
import { useConsorcioPipelineMetricsByCloser } from "@/hooks/useConsorcioPipelineMetricsByCloser";
import { useConsorcioProdutosFechadosByCloser } from "@/hooks/useConsorcioProdutosFechadosByCloser";
import { CloserDetailKPICards } from "@/components/closer/CloserDetailKPICards";
import { CloserRankingBlock } from "@/components/closer/CloserRankingBlock";
import { CloserLeadsTable } from "@/components/closer/CloserLeadsTable";
import {
  CloserConsorcioDetailKPICards,
  ConsorcioCloserMetrics,
  ConsorcioTeamAverages,
} from "@/components/closer/CloserConsorcioDetailKPICards";
import {
  CloserConsorcioRankingBlock,
  ConsorcioRanking,
} from "@/components/closer/CloserConsorcioRankingBlock";

type DatePreset = "today" | "week" | "month";

export default function MeuDesempenhoCloser() {
  const [datePreset, setDatePreset] = useState<DatePreset>("week");
  const [selectedMonth, setSelectedMonth] = useState(new Date());

  const { data: myCloser, isLoading: isLoadingCloser } = useMyCloser();
  const isConsorcio = (myCloser as any)?.bu === "consorcio";

  const { startDate, endDate } = useMemo(() => {
    const now = new Date();
    switch (datePreset) {
      case "today":
        return { startDate: startOfDay(now), endDate: endOfDay(now) };
      case "week":
        return {
          startDate: startOfWeek(now, { weekStartsOn: 6 }),
          endDate: endOfWeek(now, { weekStartsOn: 6 }),
        };
      case "month":
        return {
          startDate: startOfMonth(selectedMonth),
          endDate: endOfMonth(selectedMonth),
        };
      default:
        return { startDate: startOfDay(now), endDate: endOfDay(now) };
    }
  }, [datePreset, selectedMonth]);

  // ========== Incorporador (default) ==========
  const {
    closerInfo,
    closerMetrics,
    teamAverages,
    ranking,
    allLeads,
    isLoading: isLoadingData,
    refetch,
  } = useCloserDetailData({
    closerId: myCloser?.id || "",
    startDate,
    endDate,
  });

  // R2 Carrinho — só Incorporador
  const { data: r2Metrics, isLoading: isLoadingR2 } = useCloserR2Metrics(
    !isConsorcio ? myCloser?.id || null : null,
    startDate,
    endDate
  );

  // ========== Consórcio ==========
  const { data: r1ConsorcioMetrics, isLoading: isLoadingR1Cons } = useR1CloserMetrics(
    startDate,
    endDate,
    "consorcio"
  );
  const { data: propostasMap, isLoading: isLoadingProp } =
    useConsorcioPipelineMetricsByCloser(startDate, endDate);
  const { data: produtosMap, isLoading: isLoadingProd } =
    useConsorcioProdutosFechadosByCloser(startDate, endDate);

  const consorcioData = useMemo(() => {
    if (!isConsorcio || !myCloser?.id || !r1ConsorcioMetrics) {
      return null;
    }

    const myR1 = r1ConsorcioMetrics.find((m) => m.closer_id === myCloser.id);
    const myMetrics: ConsorcioCloserMetrics = {
      r1_agendada: myR1?.r1_agendada || 0,
      r1_realizada: myR1?.r1_realizada || 0,
      noshow: myR1?.noshow || 0,
      propostas_enviadas: propostasMap?.get(myCloser.id) || 0,
      produtos_fechados: produtosMap?.get(myCloser.id) || 0,
    };

    // Team aggregates
    const team = r1ConsorcioMetrics.map((m) => ({
      closer_id: m.closer_id,
      r1_agendada: m.r1_agendada,
      r1_realizada: m.r1_realizada,
      noshow: m.noshow,
      taxa_noshow: m.r1_agendada > 0 ? (m.noshow / m.r1_agendada) * 100 : 0,
      propostas: propostasMap?.get(m.closer_id) || 0,
      produtos: produtosMap?.get(m.closer_id) || 0,
      taxa_conversao: m.r1_realizada > 0 ? ((produtosMap?.get(m.closer_id) || 0) / m.r1_realizada) * 100 : 0,
    }));

    const total = team.length || 1;
    const sum = (key: keyof (typeof team)[number]) =>
      team.reduce((acc, t) => acc + (t[key] as number), 0);

    const teamAvg: ConsorcioTeamAverages = {
      avgR1Agendada: sum("r1_agendada") / total,
      avgR1Realizada: sum("r1_realizada") / total,
      avgNoShow: sum("noshow") / total,
      avgTaxaNoShow: sum("taxa_noshow") / total,
      avgPropostas: sum("propostas") / total,
      avgProdutos: sum("produtos") / total,
      avgTaxaConversao: sum("taxa_conversao") / total,
    };

    // Rankings
    const rankBy = (key: keyof (typeof team)[number], asc = false) => {
      const sorted = [...team].sort((a, b) =>
        asc ? (a[key] as number) - (b[key] as number) : (b[key] as number) - (a[key] as number)
      );
      const idx = sorted.findIndex((t) => t.closer_id === myCloser.id);
      return idx === -1 ? 0 : idx + 1;
    };

    const myTaxaNoShow = myMetrics.r1_agendada > 0 ? (myMetrics.noshow / myMetrics.r1_agendada) * 100 : 0;

    const rank: ConsorcioRanking = {
      r1Realizada: rankBy("r1_realizada"),
      produtosFechados: rankBy("produtos"),
      propostasEnviadas: rankBy("propostas"),
      // Taxa No-Show: menor é melhor, mas quem tem 0 agendadas fica fora
      taxaNoShow:
        myMetrics.r1_agendada === 0
          ? 0
          : (() => {
              const eligible = team.filter((t) => t.r1_agendada > 0);
              const sorted = [...eligible].sort((a, b) => a.taxa_noshow - b.taxa_noshow);
              const idx = sorted.findIndex((t) => t.closer_id === myCloser.id);
              return idx === -1 ? 0 : idx + 1;
            })(),
      total,
    };

    return { myMetrics, teamAvg, rank };
  }, [isConsorcio, myCloser?.id, r1ConsorcioMetrics, propostasMap, produtosMap]);

  const isLoadingConsorcio = isLoadingR1Cons || isLoadingProp || isLoadingProd;
  const isLoading = isLoadingCloser || (isConsorcio ? isLoadingConsorcio : isLoadingData);

  const handlePrevMonth = () => {
    setSelectedMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setSelectedMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const periodLabel = useMemo(() => {
    if (datePreset === "today") return format(startDate, "dd/MM/yyyy", { locale: ptBR });
    if (datePreset === "week") {
      return `${format(startDate, "dd/MM", { locale: ptBR })} - ${format(endDate, "dd/MM/yyyy", { locale: ptBR })}`;
    }
    return format(selectedMonth, "MMMM yyyy", { locale: ptBR });
  }, [datePreset, startDate, endDate, selectedMonth]);

  if (isLoadingCloser) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  if (!myCloser) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <TrendingUp className="h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Perfil de Closer não encontrado</h2>
            <p className="text-muted-foreground text-center max-w-md">
              Não foi possível encontrar seu perfil de closer. Verifique se seu cadastro está correto.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold text-lg"
            style={{ backgroundColor: closerInfo?.color || "#3B82F6" }}
          >
            {myCloser.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
              Meu Desempenho
              <Badge variant="outline" className="text-xs">
                <TrendingUp className="h-3 w-3 mr-1" />
                Closer{isConsorcio ? " Consórcio" : ""}
              </Badge>
            </h1>
            <p className="text-sm text-muted-foreground">{myCloser.email}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Date Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
          <Button
            variant={datePreset === "today" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setDatePreset("today")}
          >
            Dia
          </Button>
          <Button
            variant={datePreset === "week" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setDatePreset("week")}
          >
            Sem
          </Button>
          <Button
            variant={datePreset === "month" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setDatePreset("month")}
          >
            Mês
          </Button>
        </div>

        {datePreset === "month" && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={handlePrevMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium min-w-[120px] text-center capitalize">
              {format(selectedMonth, "MMMM yyyy", { locale: ptBR })}
            </span>
            <Button variant="outline" size="icon" onClick={handleNextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        <Badge variant="secondary" className="text-xs">
          {periodLabel}
        </Badge>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="leads">
            Meus Leads ({allLeads.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {isConsorcio ? (
            <CloserConsorcioDetailKPICards
              metrics={consorcioData?.myMetrics || null}
              teamAverages={
                consorcioData?.teamAvg || {
                  avgR1Agendada: 0,
                  avgR1Realizada: 0,
                  avgNoShow: 0,
                  avgTaxaNoShow: 0,
                  avgPropostas: 0,
                  avgProdutos: 0,
                  avgTaxaConversao: 0,
                }
              }
              isLoading={isLoading}
            />
          ) : (
            <CloserDetailKPICards
              metrics={closerMetrics}
              teamAverages={teamAverages}
              isLoading={isLoading}
            />
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {isConsorcio ? (
              <CloserConsorcioRankingBlock
                ranking={
                  consorcioData?.rank || {
                    r1Realizada: 0,
                    produtosFechados: 0,
                    propostasEnviadas: 0,
                    taxaNoShow: 0,
                    total: 0,
                  }
                }
                isLoading={isLoading}
              />
            ) : (
              <CloserRankingBlock
                closerMetrics={closerMetrics}
                ranking={ranking}
                teamAverages={teamAverages}
                isLoading={isLoading}
              />
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Resumo do Período</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {isLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3, 4].map((i) => (
                      <Skeleton key={i} className="h-6 w-full" />
                    ))}
                  </div>
                ) : isConsorcio ? (
                  <>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Total Realizadas</span>
                      <span className="font-semibold">{consorcioData?.myMetrics.r1_realizada || 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Propostas Enviadas</span>
                      <span className="font-semibold">{consorcioData?.myMetrics.propostas_enviadas || 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Produtos Fechados</span>
                      <span className="font-semibold text-primary">
                        {consorcioData?.myMetrics.produtos_fechados || 0}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Taxa de Fechamento</span>
                      <span className="font-semibold">
                        {consorcioData?.myMetrics.r1_realizada
                          ? (
                              ((consorcioData.myMetrics.produtos_fechados) /
                                consorcioData.myMetrics.r1_realizada) *
                              100
                            ).toFixed(1)
                          : 0}
                        %
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Total Leads Realizados</span>
                      <span className="font-semibold">{closerMetrics?.r1_realizada || 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Contratos Fechados</span>
                      <span className="font-semibold text-primary">
                        {closerMetrics?.contrato_pago || 0}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Taxa de Conversão</span>
                      <span className="font-semibold">
                        {closerMetrics?.r1_realizada
                          ? (
                              ((closerMetrics.contrato_pago + closerMetrics.outside) /
                                closerMetrics.r1_realizada) *
                              100
                            ).toFixed(1)
                          : 0}
                        %
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">R2 Agendadas</span>
                      <span className="font-semibold">{closerMetrics?.r2_agendada || 0}</span>
                    </div>

                    {/* R2 Carrinho Section */}
                    <Separator className="my-3" />
                    <div className="flex items-center gap-2 mb-2">
                      <ShoppingCart className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">R2 Carrinho</span>
                    </div>
                    {isLoadingR2 ? (
                      <div className="space-y-2">
                        {[1, 2, 3].map((i) => (
                          <Skeleton key={i} className="h-5 w-full" />
                        ))}
                      </div>
                    ) : (
                      <>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Leads Aprovados</span>
                          <span className="font-semibold">{r2Metrics?.aprovados || 0}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Vendas Parceria</span>
                          <span className="font-semibold text-green-500">{r2Metrics?.vendas || 0}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Taxa Carrinho → Venda</span>
                          <Badge
                            variant="secondary"
                            className={(r2Metrics?.taxaConversao || 0) >= 50 ? 'bg-green-500/20 text-green-500' : ''}
                          >
                            {(r2Metrics?.taxaConversao || 0).toFixed(1)}%
                          </Badge>
                        </div>
                      </>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="leads">
          <CloserLeadsTable leads={allLeads} isLoading={isLoading} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
