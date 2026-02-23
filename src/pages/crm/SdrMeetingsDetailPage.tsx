import { useState, useMemo } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfDay, endOfDay, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getWeekStartsOn } from "@/lib/businessDays";
import { useActiveBU } from "@/hooks/useActiveBU";
import { RefreshCw, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SdrDetailHeader } from "@/components/sdr/SdrDetailHeader";
import { SdrDetailKPICards } from "@/components/sdr/SdrDetailKPICards";
import { SdrMeetingsChart } from "@/components/sdr/SdrMeetingsChart";
import { SdrRankingBlock } from "@/components/sdr/SdrRankingBlock";
import { SdrLeadsTable } from "@/components/sdr/SdrLeadsTable";
import { SdrDealsTable } from "@/components/sdr/SdrDealsTable";
import { MeetingDetailsDrawer } from "@/components/sdr/MeetingDetailsDrawer";

import { useSdrDetailData } from "@/hooks/useSdrDetailData";
import { useSdrDeals } from "@/hooks/useSdrDeals";
import { MeetingV2 } from "@/hooks/useSdrMetricsV2";
import { Meeting } from "@/hooks/useSdrMeetings";

export default function SdrMeetingsDetailPage() {
  const { sdrEmail } = useParams<{ sdrEmail: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const activeBU = useActiveBU();
  const wso = getWeekStartsOn(activeBU);
  
  // Parse date range from query params
  const preset = searchParams.get("preset") || "month";
  const monthParam = searchParams.get("month");
  
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);

  // Calculate date range
  const { startDate, endDate } = useMemo(() => {
    const today = new Date();
    
    if (preset === "today") {
      return { startDate: startOfDay(today), endDate: endOfDay(today) };
    }
    if (preset === "week") {
      return { startDate: startOfWeek(today, { weekStartsOn: wso }), endDate: endOfWeek(today, { weekStartsOn: wso }) };
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
    sdrInfo,
    sdrMetrics,
    teamAverages,
    ranking,
    meetings,
    isLoading,
    refetch,
  } = useSdrDetailData({
    sdrEmail: sdrEmail || "",
    startDate,
    endDate,
  });

  // Buscar todos os deals do SDR (independente de reunião)
  const { data: sdrDeals = [], isLoading: isLoadingDeals } = useSdrDeals(sdrEmail);

  const handleBack = () => {
    // Navigate back preserving filters
    const params = new URLSearchParams();
    params.set("preset", preset);
    if (monthParam) params.set("month", monthParam);
    navigate(`/crm/reunioes-equipe?${params.toString()}`);
  };

  // Convert MeetingV2 to Meeting for the drawer
  const handleSelectMeeting = (m: MeetingV2) => {
    const converted: Meeting = {
      id: m.deal_id,
      dealId: m.deal_id,
      dealName: m.deal_name,
      contactName: m.contact_name || '',
      contactEmail: m.contact_email,
      contactPhone: m.contact_phone,
      scheduledDate: m.data_agendamento,
      currentStage: m.status_atual || '',
      currentStageClassification: m.status_atual?.toLowerCase().includes('realizada') ? 'realizada' :
                                   m.status_atual?.toLowerCase().includes('no-show') ? 'noShow' :
                                   m.status_atual?.toLowerCase().includes('contrato') ? 'contratoPago' : 'agendada',
      originId: null,
      originName: m.origin_name || '',
      probability: m.probability,
      timeToSchedule: null,
      timeToContract: null,
      createdAt: '',
    };
    setSelectedMeeting(converted);
  };

  if (!sdrEmail) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        SDR não encontrado
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <SdrDetailHeader
        name={sdrInfo?.name || sdrEmail.split("@")[0]}
        email={sdrEmail}
        cargo={sdrInfo?.cargo}
        squad={sdrInfo?.squad}
        status={sdrInfo?.status}
        startDate={startDate}
        endDate={endDate}
        onBack={handleBack}
      />

      {/* Refresh button */}
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="leads">Reuniões ({meetings.length})</TabsTrigger>
          <TabsTrigger value="deals">Todos os Negócios ({sdrDeals.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* KPI Cards */}
          <SdrDetailKPICards
            metrics={sdrMetrics}
            teamAverages={teamAverages}
            isLoading={isLoading}
          />

          {/* Charts and Ranking */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SdrMeetingsChart
              meetings={meetings}
              startDate={startDate}
              endDate={endDate}
              isLoading={isLoading}
            />
            <SdrRankingBlock
              sdrMetrics={sdrMetrics}
              ranking={ranking}
              teamAverages={teamAverages}
              isLoading={isLoading}
            />
          </div>
        </TabsContent>

        <TabsContent value="leads">
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              {meetings.length === 0 && !isLoading && (
                <Alert className="mb-4">
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    Esta aba lista apenas leads que tiveram movimento para "Reunião 01 Agendada / R1 Agendada" no período selecionado. 
                    Leads em estágios anteriores (Novo Lead, Lead Qualificado) aparecem na aba "Todos os Negócios".
                  </AlertDescription>
                </Alert>
              )}
              <SdrLeadsTable
                meetings={meetings}
                isLoading={isLoading}
                onSelectMeeting={handleSelectMeeting}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="deals">
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <SdrDealsTable
                deals={sdrDeals}
                isLoading={isLoadingDeals}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Meeting Details Drawer */}
      <MeetingDetailsDrawer meeting={selectedMeeting} onClose={() => setSelectedMeeting(null)} />
    </div>
  );
}
