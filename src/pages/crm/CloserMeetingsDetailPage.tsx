import { useMemo } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfDay, endOfDay, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getWeekStartsOn } from "@/lib/businessDays";
import { useActiveBU } from "@/hooks/useActiveBU";
import { RefreshCw } from "lucide-react";
import { ManualSaleAttributionDialog } from "@/components/closer/ManualSaleAttributionDialog";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CloserDetailHeader } from "@/components/closer/CloserDetailHeader";
import { CloserDetailKPICards } from "@/components/closer/CloserDetailKPICards";
import { CloserLeadsTable } from "@/components/closer/CloserLeadsTable";

import { CloserRankingBlock } from "@/components/closer/CloserRankingBlock";
import { CloserRevenueTab } from "@/components/closer/CloserRevenueTab";
import { useCloserDetailData } from "@/hooks/useCloserDetailData";

export default function CloserMeetingsDetailPage() {
  const { closerId } = useParams<{ closerId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const activeBU = useActiveBU();
  const wso = getWeekStartsOn(activeBU);



  // Parse date range from query params
  const preset = searchParams.get("preset") || "month";
  const monthParam = searchParams.get("month");

  // Calculate date range
  const { startDate, endDate } = useMemo(() => {
    const today = new Date();

    if (preset === "today") {
      return { startDate: startOfDay(today), endDate: endOfDay(today) };
    }
    if (preset === "week") {
      return {
        startDate: startOfWeek(today, { weekStartsOn: wso }),
        endDate: endOfWeek(today, { weekStartsOn: wso }),
      };
    }
    if (preset === "custom") {
      const start = searchParams.get("start");
      const end = searchParams.get("end");
      return {
        startDate: start ? parseISO(start) : startOfMonth(today),
        endDate: end ? parseISO(end) : endOfMonth(today),
      };
    }
    // Default: month
    const baseDate = monthParam ? parseISO(monthParam + "-01") : today;
    return { startDate: startOfMonth(baseDate), endDate: endOfMonth(baseDate) };
  }, [preset, monthParam, searchParams]);

  const {
    closerInfo,
    closerMetrics,
    teamAverages,
    ranking,
    leads,
    noShowLeads,
    r2Leads,
    isLoading,
    refetch,
  } = useCloserDetailData({
    closerId: closerId || "",
    startDate,
    endDate,
  });

  const handleBack = () => {
    const params = new URLSearchParams();
    params.set("preset", preset);
    if (monthParam) params.set("month", monthParam);
    navigate(`/crm/reunioes-equipe?${params.toString()}`);
  };



  if (!closerId) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        Closer não encontrado
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <CloserDetailHeader
        name={closerInfo?.name || "Carregando..."}
        email={closerInfo?.email || ""}
        color={closerInfo?.color}
        meetingType={closerInfo?.meetingType}
        startDate={startDate}
        endDate={endDate}
        onBack={handleBack}
      />

      {/* Refresh button */}
      <div className="flex justify-end gap-2">
        {closerId && closerInfo && (
          <ManualSaleAttributionDialog
            closerId={closerId}
            closerName={closerInfo.name}
            onSuccess={() => refetch()}
          />
        )}
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="leads">Leads Realizados ({leads.length})</TabsTrigger>
          <TabsTrigger value="noshows">No-Shows ({noShowLeads.length})</TabsTrigger>
          <TabsTrigger value="r2">R2 Agendadas ({r2Leads.length})</TabsTrigger>
          <TabsTrigger value="faturamento">Faturamento</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* KPI Cards */}
          <CloserDetailKPICards
            metrics={closerMetrics}
            teamAverages={teamAverages}
            isLoading={isLoading}
          />

          {/* Ranking Block */}
          <CloserRankingBlock
            closerMetrics={closerMetrics}
            ranking={ranking}
            teamAverages={teamAverages}
            isLoading={isLoading}
          />
        </TabsContent>

        <TabsContent value="leads">
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <CloserLeadsTable leads={leads} isLoading={isLoading} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="noshows">
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <CloserLeadsTable leads={noShowLeads} isLoading={isLoading} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="r2">
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <CloserLeadsTable leads={r2Leads} isLoading={isLoading} showR1Sdr />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="faturamento">
          <CloserRevenueTab
            closerId={closerId}
            startDate={startDate}
            endDate={endDate}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
