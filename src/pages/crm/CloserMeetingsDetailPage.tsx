import { useState, useMemo, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfDay, endOfDay, parseISO } from "date-fns";
import { getWeekStartsOn } from "@/lib/businessDays";
import { useActiveBU } from "@/hooks/useActiveBU";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ManualSaleAttributionDialog } from "@/components/closer/ManualSaleAttributionDialog";

import { CloserDetailHeader } from "@/components/closer/CloserDetailHeader";
import { CloserLeadsTable } from "@/components/closer/CloserLeadsTable";
import { CloserRevenueTab } from "@/components/closer/CloserRevenueTab";

import { SdrPerformanceFilters } from "@/components/sdr/SdrPerformanceFilters";
import { SdrAutoSummary } from "@/components/sdr/SdrAutoSummary";
import { SdrDetailKPICards } from "@/components/sdr/SdrDetailKPICards";
import { SdrProjectionCard } from "@/components/sdr/SdrProjectionCard";
import { SdrFunnelPanel } from "@/components/sdr/SdrFunnelPanel";
import { SdrCumulativeChart } from "@/components/sdr/SdrCumulativeChart";
import { SdrTeamComparisonPanel } from "@/components/sdr/SdrTeamComparisonPanel";
import { CloserDailyBreakdownTable } from "@/components/closer/CloserDailyBreakdownTable";

import { useCloserPerformanceData } from "@/hooks/useCloserPerformanceData";
import { ComparisonMode, MetaMode, computeCompDates } from "@/hooks/useSdrPerformanceData";

export default function CloserMeetingsDetailPage() {
  const { closerId } = useParams<{ closerId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const activeBU = useActiveBU();
  const wso = getWeekStartsOn(activeBU);

  const preset = searchParams.get("preset") || "month";
  const monthParam = searchParams.get("month");

  // Initial dates from URL
  const initialDates = useMemo(() => {
    const today = new Date();
    if (preset === "today") return { startDate: startOfDay(today), endDate: endOfDay(today) };
    if (preset === "week") return { startDate: startOfWeek(today, { weekStartsOn: wso }), endDate: endOfWeek(today, { weekStartsOn: wso }) };
    if (preset === "custom") {
      const start = searchParams.get("start");
      const end = searchParams.get("end");
      return {
        startDate: start ? parseISO(start) : startOfMonth(today),
        endDate: end ? parseISO(end) : endOfMonth(today),
      };
    }
    const baseDate = monthParam ? parseISO(monthParam + "-01") : today;
    return { startDate: startOfMonth(baseDate), endDate: endOfMonth(baseDate) };
  }, [preset, monthParam, searchParams, wso]);

  // Filters state
  const [startDate, setStartDate] = useState(initialDates.startDate);
  const [endDate, setEndDate] = useState(initialDates.endDate);
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>("prev_month");
  const [metaMode, setMetaMode] = useState<MetaMode>("monthly_prorated");
  const [customMeta, setCustomMeta] = useState<number | undefined>();

  const { compStartDate, compEndDate } = useMemo(
    () => computeCompDates(startDate, endDate, comparisonMode),
    [startDate, endDate, comparisonMode]
  );

  const handleFiltersChange = useCallback(
    (f: {
      startDate: Date;
      endDate: Date;
      comparisonMode: ComparisonMode;
      metaMode: MetaMode;
      customMeta?: number;
    }) => {
      setStartDate(f.startDate);
      setEndDate(f.endDate);
      setComparisonMode(f.comparisonMode);
      setMetaMode(f.metaMode);
      setCustomMeta(f.customMeta);
    },
    []
  );

  const perfData = useCloserPerformanceData({
    closerId: closerId || "",
    startDate,
    endDate,
    compStartDate,
    compEndDate,
    metaMode,
    customMeta,
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
    <div className="space-y-5 p-6">
      {/* Header */}
      <CloserDetailHeader
        name={perfData.closerInfo?.name || "Carregando..."}
        email={perfData.closerInfo?.email || ""}
        color={perfData.closerInfo?.color}
        meetingType={perfData.closerInfo?.meetingType}
        startDate={startDate}
        endDate={endDate}
        onBack={handleBack}
      />

      {/* Filters */}
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <SdrPerformanceFilters
            startDate={startDate}
            endDate={endDate}
            comparisonMode={comparisonMode}
            metaMode={metaMode}
            customMeta={customMeta}
            onFiltersChange={handleFiltersChange}
            onRefresh={() => perfData.refetch()}
            isLoading={perfData.isLoading}
          />
        </div>
        {closerId && perfData.closerInfo && (
          <ManualSaleAttributionDialog
            closerId={closerId}
            closerName={perfData.closerInfo.name}
            onSuccess={() => perfData.refetch()}
          />
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-5">
        <TabsList>
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="leads">Leads Realizados ({perfData.leads.length})</TabsTrigger>
          <TabsTrigger value="noshows">No-Shows ({perfData.noShowLeads.length})</TabsTrigger>
          <TabsTrigger value="r2">R2 Agendadas ({perfData.r2Leads.length})</TabsTrigger>
          <TabsTrigger value="faturamento">Faturamento</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-5">
          {/* Auto Summary */}
          <SdrAutoSummary text={perfData.summaryText} isLoading={perfData.isLoading} />

          {/* KPI Cards + Projection side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
            <SdrDetailKPICards metrics={perfData.metrics} isLoading={perfData.isLoading} />
            <SdrProjectionCard data={perfData.projection} isLoading={perfData.isLoading} />
          </div>

          {/* Funnel + Daily chart side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <SdrFunnelPanel funnel={perfData.funnel} isLoading={perfData.isLoading} />
            <SdrCumulativeChart dailyRows={perfData.dailyRows} isLoading={perfData.isLoading} />
          </div>

          {/* Team Comparison */}
          <SdrTeamComparisonPanel data={perfData.teamComparison} isLoading={perfData.isLoading} />

          {/* Daily Breakdown Table */}
          <CloserDailyBreakdownTable dailyRows={perfData.dailyRows} isLoading={perfData.isLoading} />
        </TabsContent>

        <TabsContent value="leads">
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <CloserLeadsTable leads={perfData.leads} isLoading={perfData.isLoading} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="noshows">
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <CloserLeadsTable leads={perfData.noShowLeads} isLoading={perfData.isLoading} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="r2">
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <CloserLeadsTable leads={perfData.r2Leads} isLoading={perfData.isLoading} showR1Sdr />
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
