import { useState, useMemo, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfDay, endOfDay, parseISO } from "date-fns";
import { getWeekStartsOn } from "@/lib/businessDays";
import { useActiveBU } from "@/hooks/useActiveBU";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { SdrDetailHeader } from "@/components/sdr/SdrDetailHeader";
import { SdrPerformanceFilters } from "@/components/sdr/SdrPerformanceFilters";
import { SdrAutoSummary } from "@/components/sdr/SdrAutoSummary";
import { SdrDetailKPICards } from "@/components/sdr/SdrDetailKPICards";
import { SdrProjectionCard } from "@/components/sdr/SdrProjectionCard";

import { SdrFunnelPanel } from "@/components/sdr/SdrFunnelPanel";

import { SdrCumulativeChart } from "@/components/sdr/SdrCumulativeChart";
import { SdrTeamComparisonPanel } from "@/components/sdr/SdrTeamComparisonPanel";
import { SdrDailyBreakdownTable } from "@/components/sdr/SdrDailyBreakdownTable";
import { SdrLeadsTable } from "@/components/sdr/SdrLeadsTable";
import { SdrMeetingActionsDrawer } from "@/components/sdr/SdrMeetingActionsDrawer";

import {
  useSdrPerformanceData,
  computeCompDates,
  ComparisonMode,
  MetaMode,
} from "@/hooks/useSdrPerformanceData";
import { MeetingV2 } from "@/hooks/useSdrMetricsV2";

export default function SdrMeetingsDetailPage() {
  const { sdrEmail } = useParams<{ sdrEmail: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const activeBU = useActiveBU();
  const wso = getWeekStartsOn(activeBU);

  const preset = searchParams.get("preset") || "month";
  const monthParam = searchParams.get("month");

  const [selectedMeeting, setSelectedMeeting] = useState<MeetingV2 | null>(null);
  const [activeTab, setActiveTab] = useState("overview");

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

  const perfData = useSdrPerformanceData({
    sdrEmail: sdrEmail || "",
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

  const handleSelectMeeting = (m: MeetingV2) => {
    setSelectedMeeting(m);
  };

  if (!sdrEmail) {
    return (
      <div className="p-6 text-center text-muted-foreground">SDR não encontrado</div>
    );
  }

  return (
    <div className="space-y-5 p-6">
      {/* Header */}
      <SdrDetailHeader
        name={perfData.sdrInfo?.name || sdrEmail.split("@")[0]}
        email={sdrEmail}
        cargo={perfData.sdrInfo?.cargo}
        squad={perfData.sdrInfo?.squad}
        status={perfData.sdrInfo?.status}
        onBack={handleBack}
      />

      {/* Filters - hidden on leads tab */}
      {activeTab !== "leads" && <SdrPerformanceFilters
        startDate={startDate}
        endDate={endDate}
        comparisonMode={comparisonMode}
        metaMode={metaMode}
        customMeta={customMeta}
        onFiltersChange={handleFiltersChange}
        onRefresh={() => perfData.refetch()}
        isLoading={perfData.isLoading}
      />}

      <Tabs defaultValue="overview" className="space-y-5" onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="leads">Reuniões ({perfData.meetings.length})</TabsTrigger>
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
          <SdrDailyBreakdownTable dailyRows={perfData.dailyRows} isLoading={perfData.isLoading} />
        </TabsContent>

        <TabsContent value="leads">
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <SdrLeadsTable
                meetings={perfData.meetings}
                isLoading={perfData.isLoading}
                onSelectMeeting={handleSelectMeeting}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <SdrMeetingActionsDrawer meeting={selectedMeeting} onClose={() => setSelectedMeeting(null)} onRefresh={() => perfData.refetch()} />
    </div>
  );
}
