import { useState, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfDay, endOfDay, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import * as XLSX from "xlsx";
import { WEEK_STARTS_ON, contarDiasUteis, getWeekStartsOn } from "@/lib/businessDays";
import { useActiveBU } from "@/hooks/useActiveBU";
import { Calendar, Users, RefreshCw, Download, Building2, Briefcase } from "lucide-react";
import { SetorRow } from "@/components/dashboard/SetorRow";
import { useSetoresDashboard } from "@/hooks/useSetoresDashboard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DatePickerCustom } from "@/components/ui/DatePickerCustom";
import { TeamKPICards } from "@/components/sdr/TeamKPICards";
import { TeamGoalsPanel } from "@/components/sdr/TeamGoalsPanel";
import { SdrSummaryTable } from "@/components/sdr/SdrSummaryTable";
import { CloserSummaryTable } from "@/components/sdr/CloserSummaryTable";
import { SdrActivityMetricsTable } from "@/components/sdr/SdrActivityMetricsTable";

import { useTeamMeetingsData, SdrSummaryRow } from "@/hooks/useTeamMeetingsData";

import { useMeetingSlotsKPIs } from "@/hooks/useMeetingSlotsKPIs";
import { useR2MeetingSlotsKPIs } from "@/hooks/useR2MeetingSlotsKPIs";
import { useR2VendasKPIs } from "@/hooks/useR2VendasKPIs";
import { useR1CloserMetrics } from "@/hooks/useR1CloserMetrics";
import { useMeetingsPendentesHoje } from "@/hooks/useMeetingsPendentesHoje";
import { useSdrOutsideMetrics } from "@/hooks/useSdrOutsideMetrics";

import { useSdrsAll } from "@/hooks/useSdrFechamento";
import { useAuth } from "@/contexts/AuthContext";
import { useSdrsFromSquad } from "@/hooks/useSdrsFromSquad";
import { BURevenueGoalsEditModal } from "@/components/sdr/BURevenueGoalsEditModal";
import { Settings2 } from "lucide-react";

type DatePreset = "today" | "week" | "month" | "custom";

function IncorporadorMetricsCard({ onEditGoals, canEdit }: { onEditGoals?: () => void; canEdit?: boolean }) {
  const { data: setoresData, isLoading: setoresLoading } = useSetoresDashboard();
  const incorporadorSetor = setoresData?.setores.find(s => s.id === 'incorporador');

  if (!incorporadorSetor && !setoresLoading) return null;

  return (
    <div className="relative group">
      <div className="absolute -inset-0.5 bg-gradient-to-r from-primary via-primary/60 to-primary rounded-xl blur opacity-30 group-hover:opacity-50 transition-opacity duration-300" />
      <div className="relative">
        <SetorRow
          titulo="MCF Incorporador"
          icone={Building2}
          semanaLabel={setoresData?.semanaLabel || 'Semana'}
          mesLabel={setoresData?.mesLabel || 'Mês'}
          apuradoSemanal={incorporadorSetor?.apuradoSemanal || 0}
          metaSemanal={incorporadorSetor?.metaSemanal || 0}
          apuradoMensal={incorporadorSetor?.apuradoMensal || 0}
          metaMensal={incorporadorSetor?.metaMensal || 0}
          apuradoAnual={incorporadorSetor?.apuradoAnual || 0}
          metaAnual={incorporadorSetor?.metaAnual || 0}
          isLoading={setoresLoading}
          onEditGoals={onEditGoals}
          canEdit={canEdit}
        />
      </div>
    </div>
  );
}

export default function ReunioesEquipe() {
  const { role } = useAuth();
  const activeBU = useActiveBU();
  const wso = getWeekStartsOn(activeBU);
  const navigate = useNavigate();
  const isRestrictedRole = role === 'sdr' || role === 'closer';
  const canEditGoals = !!role && ['admin', 'manager', 'coordenador'].includes(role);
  const [incorpGoalsOpen, setIncorpGoalsOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  // Initialize state from URL params
  const initialPreset = (searchParams.get("preset") as DatePreset) || "month";
  const initialMonth = searchParams.get("month")
    ? parseISO(searchParams.get("month") + "-01")
    : new Date();
  const initialStart = searchParams.get("start")
    ? parseISO(searchParams.get("start")!)
    : null;
  const initialEnd = searchParams.get("end")
    ? parseISO(searchParams.get("end")!)
    : initialStart; // Fallback to start if end is missing

  const [selectedMonth, setSelectedMonth] = useState(initialMonth);
  const [datePreset, setDatePreset] = useState<DatePreset>(initialPreset);
  const [customStartDate, setCustomStartDate] = useState<Date | null>(initialStart);
  const [customEndDate, setCustomEndDate] = useState<Date | null>(initialEnd || initialStart);
  const [sdrFilter, setSdrFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"sdrs" | "closers">("sdrs");

  // Sync state changes to URL
  const updateUrlParams = (
    preset: DatePreset,
    month?: Date,
    startDate?: Date | null,
    endDate?: Date | null
  ) => {
    const params = new URLSearchParams(searchParams);
    params.set("preset", preset);

    if (preset === "month" && month) {
      params.set("month", format(month, "yyyy-MM"));
      params.delete("start");
      params.delete("end");
    } else if (preset === "custom") {
      params.delete("month");
      if (startDate) params.set("start", format(startDate, "yyyy-MM-dd"));
      if (endDate) params.set("end", format(endDate, "yyyy-MM-dd"));
    } else {
      params.delete("month");
      params.delete("start");
      params.delete("end");
    }

    setSearchParams(params, { replace: true });
  };

  // Calculate date range based on preset
  const getDateRange = () => {
    const today = new Date();
    switch (datePreset) {
      case "today":
        return { start: startOfDay(today), end: endOfDay(today) };
      case "week": {
        const todayNormalized = startOfDay(today);
        return { start: startOfWeek(todayNormalized, { weekStartsOn: wso }), end: endOfWeek(todayNormalized, { weekStartsOn: wso }) };
      }
      case "month":
        return { start: startOfMonth(selectedMonth), end: endOfMonth(selectedMonth) };
      case "custom":
        const startCustom = customStartDate || startOfMonth(today);
        const endCustom = customEndDate || customStartDate || endOfMonth(today);
        // Ensure start <= end
        if (startCustom > endCustom) {
          return { start: endCustom, end: startCustom };
        }
        return { start: startCustom, end: endCustom };
      default:
        return { start: startOfMonth(selectedMonth), end: endOfMonth(selectedMonth) };
    }
  };

  const { start, end } = getDateRange();

  // Today's dates for day metrics
  const today = new Date();
  const dayStart = startOfDay(today);
  const dayEnd = endOfDay(today);
  
  // Week dates for week metrics (sábado a sexta)
  const todayNormalized = startOfDay(today);
  const weekStartDate = startOfWeek(todayNormalized, { weekStartsOn: wso });
  const weekEndDate = endOfWeek(todayNormalized, { weekStartsOn: wso });

  // Month dates for month metrics
  const monthStartDate = startOfMonth(today);
  const monthEndDate = endOfMonth(today);

  // Fetch data with optional SDR filter
  const {
    teamKPIs,
    bySDR,
    allMeetings,
    isLoading,
    refetch,
  } = useTeamMeetingsData({
    startDate: start,
    endDate: end,
    sdrEmailFilter: sdrFilter !== "all" ? sdrFilter : undefined,
  });

  // Fetch day data for goals panel
  const { teamKPIs: dayKPIs } = useTeamMeetingsData({
    startDate: dayStart,
    endDate: dayEnd,
  });

  // Fetch week data for goals panel
  const { teamKPIs: weekKPIs } = useTeamMeetingsData({
    startDate: weekStartDate,
    endDate: weekEndDate,
  });


  // Fetch all SDRs for meta_diaria
  const { data: allSdrsData } = useSdrsAll();
  
  // Fetch active SDRs from squad for dropdown and base dataset
  const { data: activeSdrsList } = useSdrsFromSquad('incorporador');

  // Create sdrMetaMap: email -> meta_diaria
  const sdrMetaMap = useMemo(() => {
    const map = new Map<string, number>();
    if (allSdrsData) {
      allSdrsData.forEach(sdr => {
        if (sdr.email) {
          map.set(sdr.email.toLowerCase(), sdr.meta_diaria || 10);
        }
      });
    }
    return map;
  }, [allSdrsData]);

  // Calculate business days in the selected period
  const diasUteisNoPeriodo = useMemo(() => {
    return contarDiasUteis(start, end);
  }, [start, end]);

  // Fetch meeting_slots KPIs for today (agenda-based)
  const { data: dayAgendaKPIs } = useMeetingSlotsKPIs(dayStart, dayEnd);

  // Fetch meeting_slots KPIs for the week (agenda-based)
  const { data: weekAgendaKPIs } = useMeetingSlotsKPIs(weekStartDate, weekEndDate);

  // Fetch R2 agenda KPIs for today (from meeting_slots where meeting_type='r2')
  const { data: dayR2AgendaKPIs } = useR2MeetingSlotsKPIs(dayStart, dayEnd);

  // Fetch R2 agenda KPIs for the week
  const { data: weekR2AgendaKPIs } = useR2MeetingSlotsKPIs(weekStartDate, weekEndDate);

  // Fetch Vendas KPIs for today
  const { data: dayR2VendasKPIs } = useR2VendasKPIs(dayStart, dayEnd);

  // Fetch Vendas KPIs for the week
  const { data: weekR2VendasKPIs } = useR2VendasKPIs(weekStartDate, weekEndDate);

  // Fetch month data for goals panel
  const { teamKPIs: monthKPIs } = useTeamMeetingsData({
    startDate: monthStartDate,
    endDate: monthEndDate,
  });

  // Fetch meeting_slots KPIs for the month (agenda-based)
  const { data: monthAgendaKPIs } = useMeetingSlotsKPIs(monthStartDate, monthEndDate);

  // Fetch R2 agenda KPIs for the month
  const { data: monthR2AgendaKPIs } = useR2MeetingSlotsKPIs(monthStartDate, monthEndDate);

  // Fetch Vendas KPIs for the month
  const { data: monthR2VendasKPIs } = useR2VendasKPIs(monthStartDate, monthEndDate);

  // Fetch Closer metrics for the selected period
  const { data: closerMetrics, isLoading: closerLoading } = useR1CloserMetrics(start, end);

  // Fetch pending meetings for today (only used when preset is "today")
  const { data: pendentesHoje } = useMeetingsPendentesHoje();

  // Fetch Outside metrics for the selected period
  const { data: outsideData } = useSdrOutsideMetrics(start, end);

  // Calculate outsides from closerMetrics (source of truth)
  const outsideFromClosers = useMemo(() => {
    return closerMetrics?.reduce((sum, c) => sum + c.outside, 0) || 0;
  }, [closerMetrics]);

  // Enrich teamKPIs with Outside data - use closerMetrics as fallback
  const enrichedKPIs = useMemo(() => ({
    ...teamKPIs,
    totalOutside: outsideData?.totalOutside || outsideFromClosers,
  }), [teamKPIs, outsideData, outsideFromClosers]);

  // Create base dataset with all SDRs (zeros) for "today" preset
  const allSdrsWithZeros = useMemo((): SdrSummaryRow[] => {
    const sdrs = activeSdrsList || [];
    return sdrs.map(sdr => ({
      sdrEmail: sdr.email,
      sdrName: sdr.name,
      agendamentos: 0,
      r1Agendada: 0,
      r1Realizada: 0,
      noShows: 0,
      contratos: 0,
    }));
  }, [activeSdrsList]);

  // Merge real data with base dataset for "today" preset
  const mergedBySDR = useMemo((): SdrSummaryRow[] => {
    const dataMap = new Map(allSdrsWithZeros.map(s => [s.sdrEmail, { ...s }]));
    
    // Overwrite with real data where it exists
    bySDR.forEach(realRow => {
      if (dataMap.has(realRow.sdrEmail)) {
        dataMap.set(realRow.sdrEmail, realRow);
      }
    });

    // Sort: agendamentos desc, r1Realizada desc, sdrName asc
    return Array.from(dataMap.values()).sort((a, b) => {
      if (b.agendamentos !== a.agendamentos) return b.agendamentos - a.agendamentos;
      if (b.r1Realizada !== a.r1Realizada) return b.r1Realizada - a.r1Realizada;
      return a.sdrName.localeCompare(b.sdrName);
    });
  }, [allSdrsWithZeros, bySDR]);

  // Filter bySDR based on sdrFilter and datePreset
  const filteredBySDR = useMemo(() => {
    // Use merged data (all SDRs) for "today", otherwise use real data only
    const baseData = datePreset === "today" ? mergedBySDR : bySDR;
    
    if (sdrFilter === "all") return baseData;
    return baseData.filter(s => s.sdrEmail === sdrFilter);
  }, [datePreset, mergedBySDR, bySDR, sdrFilter]);

  // Values for goals panel - UNIFICADO: usa teamKPIs para consistência (filtrado por SDR_LIST)
  // R1 Agendada = Realizadas + NoShows + Pendentes (todas que foram marcadas)
  // Isso garante que GoalsPanel e TeamKPICards mostrem os mesmos números
  const dayPendentes = pendentesHoje ?? 0;
  
  const dayValues = useMemo(() => ({
    agendamento: dayKPIs?.totalAgendamentos || 0,
    r1Agendada: dayKPIs?.totalR1Agendada || 0,
    r1Realizada: dayKPIs?.totalRealizadas || 0,
    noShow: dayKPIs?.totalNoShows || 0,
    contrato: dayKPIs?.totalContratos || 0,
    r2Agendada: dayR2AgendaKPIs?.r2Agendadas || 0,
    r2Realizada: dayR2AgendaKPIs?.r2Realizadas || 0,
    vendaRealizada: dayR2VendasKPIs?.vendasRealizadas || 0,
  }), [dayKPIs, dayPendentes, dayR2AgendaKPIs, dayR2VendasKPIs]);

  const weekValues = useMemo(() => ({
    agendamento: weekKPIs?.totalAgendamentos || 0,
    r1Agendada: weekKPIs?.totalR1Agendada || 0,
    r1Realizada: weekKPIs?.totalRealizadas || 0,
    noShow: weekKPIs?.totalNoShows || 0,
    contrato: weekKPIs?.totalContratos || 0,
    r2Agendada: weekR2AgendaKPIs?.r2Agendadas || 0,
    r2Realizada: weekR2AgendaKPIs?.r2Realizadas || 0,
    vendaRealizada: weekR2VendasKPIs?.vendasRealizadas || 0,
  }), [weekKPIs, weekR2AgendaKPIs, weekR2VendasKPIs]);

  const monthValues = useMemo(() => ({
    agendamento: monthKPIs?.totalAgendamentos || 0,
    r1Agendada: monthKPIs?.totalR1Agendada || 0,
    r1Realizada: monthKPIs?.totalRealizadas || 0,
    noShow: monthKPIs?.totalNoShows || 0,
    contrato: (monthKPIs?.totalContratos || 0) + outsideFromClosers,
    r2Agendada: monthR2AgendaKPIs?.r2Agendadas || 0,
    r2Realizada: monthR2AgendaKPIs?.r2Realizadas || 0,
    vendaRealizada: monthR2VendasKPIs?.vendasRealizadas || 0,
  }), [monthKPIs, monthR2AgendaKPIs, monthR2VendasKPIs, outsideFromClosers]);

  // Handlers that sync with URL
  const handlePresetChange = (preset: DatePreset) => {
    setDatePreset(preset);
    updateUrlParams(preset, selectedMonth, customStartDate, customEndDate);
  };

  // Month navigation
  const handleMonthChange = (increment: number) => {
    const newDate = new Date(selectedMonth);
    newDate.setMonth(newDate.getMonth() + increment);
    setSelectedMonth(newDate);
    updateUrlParams("month", newDate, null, null);
  };

  const handleCustomStartChange = (date: Date | null) => {
    setCustomStartDate(date);
    updateUrlParams("custom", selectedMonth, date, customEndDate);
  };

  const handleCustomEndChange = (date: Date | null) => {
    setCustomEndDate(date);
    updateUrlParams("custom", selectedMonth, customStartDate, date);
  };

  // Export to Excel function - contextual based on active tab
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();

    if (activeTab === "closers" && closerMetrics) {
      // Aba Closers: exportar resumo por Closer
      const closerData = closerMetrics.map(c => ({
        "Closer": c.closer_name,
        "R1 Agendada": c.r1_agendada,
        "R1 Realizada": c.r1_realizada,
        "No-Show": c.noshow,
        "Contrato Pago": c.contrato_pago,
        "Outside": c.outside,
        "R2 Agendada": c.r2_agendada,
        "Taxa Conversão": c.r1_realizada > 0 ? `${((c.contrato_pago / c.r1_realizada) * 100).toFixed(1)}%` : "0%",
        "Taxa No-Show": c.r1_agendada > 0 ? `${((c.noshow / c.r1_agendada) * 100).toFixed(1)}%` : "0%",
      }));
      const wsClosers = XLSX.utils.json_to_sheet(closerData);
      XLSX.utils.book_append_sheet(wb, wsClosers, "Resumo Closers");
      XLSX.writeFile(wb, `painel_closers_${format(start, "yyyyMMdd")}_${format(end, "yyyyMMdd")}.xlsx`);
    } else {
      // Aba SDRs: exportar resumo por SDR + leads detalhados
      const resumoData = filteredBySDR.map(sdr => ({
        "SDR": sdr.sdrName,
        "Agendamento": sdr.agendamentos,
        "R1 Agendada": sdr.r1Agendada,
        "R1 Realizada": sdr.r1Realizada,
        "No-Show": sdr.noShows,
        "Contrato PAGO": sdr.contratos,
      }));

      const leadsData = allMeetings
        .filter(m => sdrFilter === "all" || m.intermediador === sdrFilter)
        .map(m => ({
          "SDR": m.intermediador || "",
          "Data/Hora": m.data_agendamento ? format(new Date(m.data_agendamento), "dd/MM/yyyy HH:mm") : "",
          "Lead": m.contact_name || "",
          "Email": m.contact_email || "",
          "Telefone": m.contact_phone || "",
          "Tipo": m.tipo || "",
          "Status": m.status_atual || "",
          "Origem": m.origin_name || "",
          "Closer": m.closer || "",
          "Probabilidade": m.probability ? `${m.probability}%` : "",
        }));

      const wsResumo = XLSX.utils.json_to_sheet(resumoData);
      const wsLeads = XLSX.utils.json_to_sheet(leadsData);
      XLSX.utils.book_append_sheet(wb, wsResumo, "Resumo SDR");
      XLSX.utils.book_append_sheet(wb, wsLeads, "Leads Detalhados");
      XLSX.writeFile(wb, `painel_sdr_${format(start, "yyyyMMdd")}_${format(end, "yyyyMMdd")}.xlsx`);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 p-3 sm:p-6">
      {/* MCF Incorporador - Métricas Monetárias - PRIMEIRO */}
      <IncorporadorMetricsCard
        onEditGoals={() => setIncorpGoalsOpen(true)}
        canEdit={canEditGoals}
      />

      <BURevenueGoalsEditModal
        open={incorpGoalsOpen}
        onOpenChange={setIncorpGoalsOpen}
        title="MCF Incorporador"
        sections={[{ prefix: "setor_incorporador", label: "Incorporador" }]}
      />

      {/* Goals Panel */}
      <TeamGoalsPanel dayValues={dayValues} weekValues={weekValues} monthValues={monthValues} />

      {/* Filters */}
      <Card className="bg-card border-border">
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3 sm:gap-4">
            {/* Date Preset Buttons */}
            <div className="flex items-center gap-1 bg-muted rounded-lg p-1 w-full sm:w-auto">
              <Button
                variant={datePreset === "today" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => handlePresetChange("today")}
                className="flex-1 sm:flex-initial text-xs sm:text-sm"
              >
                Hoje
              </Button>
              <Button
                variant={datePreset === "week" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => handlePresetChange("week")}
                className="flex-1 sm:flex-initial text-xs sm:text-sm"
              >
                Semana
              </Button>
              <Button
                variant={datePreset === "month" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => handlePresetChange("month")}
                className="flex-1 sm:flex-initial text-xs sm:text-sm"
              >
                Mês
              </Button>
              <Button
                variant={datePreset === "custom" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => handlePresetChange("custom")}
                className="flex-1 sm:flex-initial text-xs sm:text-sm"
              >
                Custom
              </Button>
            </div>

            {/* Month Selector (when month preset) */}
            {datePreset === "month" && (
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={() => handleMonthChange(-1)}>
                  <Calendar className="h-4 w-4" />
                </Button>
                <span className="text-sm font-medium min-w-[120px] text-center">
                  {format(selectedMonth, "MMMM yyyy", { locale: ptBR })}
                </span>
                <Button variant="outline" size="icon" onClick={() => handleMonthChange(1)}>
                  <Calendar className="h-4 w-4" />
                </Button>
              </div>
            )}

            {/* Custom Date Range */}
            {datePreset === "custom" && (
              <div className="flex items-center gap-2">
                <DatePickerCustom
                  selected={customStartDate || undefined}
                  onSelect={(date) => handleCustomStartChange(date as Date | null)}
                  placeholder="Data início"
                />
                <span className="text-muted-foreground">até</span>
                <DatePickerCustom
                  selected={customEndDate || undefined}
                  onSelect={(date) => handleCustomEndChange(date as Date | null)}
                  placeholder="Data fim"
                />
              </div>
            )}

            {/* SDR Filter */}
            <Select value={sdrFilter} onValueChange={setSdrFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Filtrar por SDR" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os SDRs</SelectItem>
                {(activeSdrsList || []).map(sdr => (
                  <SelectItem key={sdr.email} value={sdr.email}>
                    {sdr.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="sm"
              onClick={handleExportExcel}
              disabled={isLoading}
              className="w-full sm:w-auto"
            >
              <Download className="h-4 w-4 mr-1" />
              <span className="sm:inline">Exportar</span>
            </Button>
          </div>

          {/* Active period display */}
          <div className="mt-3 text-xs text-muted-foreground">
            Período: {format(start, "dd/MM/yyyy")} - {format(end, "dd/MM/yyyy")}
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <TeamKPICards 
        kpis={enrichedKPIs} 
        isLoading={isLoading}
        isToday={datePreset === "today"}
        pendentesHoje={pendentesHoje}
      />

      {/* SDR / Closer Summary Table with Tabs */}
      <Card className="bg-card border-border overflow-hidden">
        <CardHeader className="pb-2 sm:pb-3 px-3 sm:px-6">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "sdrs" | "closers")}>
            <TabsList className="bg-muted/50 w-full sm:w-auto">
              <TabsTrigger value="sdrs" className="flex-1 sm:flex-initial flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
                <Users className="h-3 w-3 sm:h-4 sm:w-4" />
                SDRs
                <span className="text-[10px] sm:text-xs text-muted-foreground">
                  ({filteredBySDR.length})
                </span>
              </TabsTrigger>
              <TabsTrigger value="closers" className="flex-1 sm:flex-initial flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
                <Briefcase className="h-3 w-3 sm:h-4 sm:w-4" />
                Closers
                <span className="text-[10px] sm:text-xs text-muted-foreground">
                  ({closerMetrics?.length || 0})
                </span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent className="pt-0 px-0 sm:px-6 pb-3 sm:pb-6 overflow-x-auto">
          {activeTab === "sdrs" ? (
            <SdrSummaryTable
              data={filteredBySDR}
              isLoading={isLoading}
              
              disableNavigation={isRestrictedRole}
              sdrMetaMap={sdrMetaMap}
              diasUteisNoPeriodo={diasUteisNoPeriodo}
            />
          ) : (
            <CloserSummaryTable
              data={closerMetrics}
              isLoading={closerLoading}
              onCloserClick={isRestrictedRole ? undefined : (closerId: string) => {
                const params = new URLSearchParams();
                params.set("preset", datePreset);
                if (datePreset === "month") {
                  params.set("month", format(selectedMonth, "yyyy-MM"));
                } else if (datePreset === "custom" && customStartDate && customEndDate) {
                  params.set("start", format(customStartDate, "yyyy-MM-dd"));
                  params.set("end", format(customEndDate, "yyyy-MM-dd"));
                }
                navigate(`/crm/reunioes-equipe/closer/${closerId}?${params.toString()}`);
              }}
            />
          )}
        </CardContent>
      </Card>

      {/* Tabela de Atividades por SDR */}
      {activeTab === "sdrs" && (
        <SdrActivityMetricsTable
          startDate={start}
          endDate={end}
          originId={undefined}
        />
      )}
    </div>
  );
}
