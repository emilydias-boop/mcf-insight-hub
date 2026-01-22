import { useMemo, useState } from "react";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { RefreshCw, TrendingUp, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useMyCloser } from "@/hooks/useMyCloser";
import { useCloserDetailData } from "@/hooks/useCloserDetailData";
import { CloserDetailKPICards } from "@/components/closer/CloserDetailKPICards";
import { CloserRankingBlock } from "@/components/closer/CloserRankingBlock";
import { CloserLeadsTable } from "@/components/closer/CloserLeadsTable";

type DatePreset = "today" | "week" | "month";

export default function MeuDesempenhoCloser() {
  const [datePreset, setDatePreset] = useState<DatePreset>("week");
  const [selectedMonth, setSelectedMonth] = useState(new Date());

  const { data: myCloser, isLoading: isLoadingCloser } = useMyCloser();

  const { startDate, endDate } = useMemo(() => {
    const now = new Date();
    switch (datePreset) {
      case "today":
        return { startDate: startOfDay(now), endDate: endOfDay(now) };
      case "week":
        // Semana começa no sábado
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

  const {
    closerInfo,
    closerMetrics,
    teamAverages,
    ranking,
    leads,
    isLoading: isLoadingData,
    refetch,
  } = useCloserDetailData({
    closerId: myCloser?.id || "",
    startDate,
    endDate,
  });

  const isLoading = isLoadingCloser || isLoadingData;

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
                Closer
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
            Leads Realizados ({leads.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <CloserDetailKPICards
            metrics={closerMetrics}
            teamAverages={teamAverages}
            isLoading={isLoading}
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <CloserRankingBlock
              closerMetrics={closerMetrics}
              ranking={ranking}
              teamAverages={teamAverages}
              isLoading={isLoading}
            />

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
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="leads">
          <CloserLeadsTable leads={leads} isLoading={isLoading} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
