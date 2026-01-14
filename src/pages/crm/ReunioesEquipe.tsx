import { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfDay, endOfDay, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import * as XLSX from "xlsx";
import { WEEK_STARTS_ON } from "@/lib/businessDays";
import { Calendar, Users, RefreshCw, Download, Building2 } from "lucide-react";
import { SetorRow } from "@/components/dashboard/SetorRow";
import { useSetoresDashboard } from "@/hooks/useSetoresDashboard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

import { useTeamMeetingsData } from "@/hooks/useTeamMeetingsData";
import { useGhostCountBySdr } from "@/hooks/useGhostCountBySdr";
import { useMeetingSlotsKPIs } from "@/hooks/useMeetingSlotsKPIs";
import { useR2VendasKPIs } from "@/hooks/useR2VendasKPIs";
import { useAgendamentosCreatedToday } from "@/hooks/useAgendamentosCreatedToday";
import { useAuth } from "@/contexts/AuthContext";
import { SDR_LIST } from "@/constants/team";

type DatePreset = "today" | "week" | "month" | "custom";

function IncorporadorMetricsCard() {
  const { data: setoresData, isLoading: setoresLoading } = useSetoresDashboard();
  const incorporadorSetor = setoresData?.setores.find(s => s.id === 'incorporador');

  if (!incorporadorSetor && !setoresLoading) return null;

  return (
    <div className="relative group">
      {/* Animated glow border */}
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
        />
      </div>
    </div>
  );
}

export default function ReunioesEquipe() {
  const { role } = useAuth();
  const isSdr = role === 'sdr';
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
        return { start: startOfWeek(todayNormalized, { weekStartsOn: WEEK_STARTS_ON }), end: endOfWeek(todayNormalized, { weekStartsOn: WEEK_STARTS_ON }) };
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
  const weekStartDate = startOfWeek(todayNormalized, { weekStartsOn: WEEK_STARTS_ON });
  const weekEndDate = endOfWeek(todayNormalized, { weekStartsOn: WEEK_STARTS_ON });

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

  // Ghost appointments data
  const { data: ghostCountBySdr } = useGhostCountBySdr();

  // Fetch meeting_slots KPIs for today (agenda-based)
  const { data: dayAgendaKPIs } = useMeetingSlotsKPIs(dayStart, dayEnd);

  // Fetch meeting_slots KPIs for the week (agenda-based)
  const { data: weekAgendaKPIs } = useMeetingSlotsKPIs(weekStartDate, weekEndDate);

  // Fetch R2 and Vendas KPIs for today
  const { data: dayR2VendasKPIs } = useR2VendasKPIs(dayStart, dayEnd);

  // Fetch R2 and Vendas KPIs for the week
  const { data: weekR2VendasKPIs } = useR2VendasKPIs(weekStartDate, weekEndDate);

  // Fetch month data for goals panel
  const { teamKPIs: monthKPIs } = useTeamMeetingsData({
    startDate: monthStartDate,
    endDate: monthEndDate,
  });

  // Fetch meeting_slots KPIs for the month (agenda-based)
  const { data: monthAgendaKPIs } = useMeetingSlotsKPIs(monthStartDate, monthEndDate);

  // Fetch R2 and Vendas KPIs for the month
  const { data: monthR2VendasKPIs } = useR2VendasKPIs(monthStartDate, monthEndDate);

  // Fetch agendamentos CRIADOS (ação de agendar) - por data de criação
  const { data: dayAgendamentosCriados } = useAgendamentosCreatedToday(dayStart, dayEnd);
  const { data: weekAgendamentosCriados } = useAgendamentosCreatedToday(weekStartDate, weekEndDate);
  const { data: monthAgendamentosCriados } = useAgendamentosCreatedToday(monthStartDate, monthEndDate);

  // Create base dataset with all SDRs (zeros) for "today" preset
  const allSdrsWithZeros = useMemo(() => {
    return SDR_LIST.map(sdr => ({
      sdrEmail: sdr.email,
      sdrName: sdr.nome,
      primeiroAgendamento: 0,
      reagendamento: 0,
      totalAgendamentos: 0,
      realizadas: 0,
      noShows: 0,
      contratos: 0,
      taxaConversao: 0,
      taxaNoShow: 0,
    }));
  }, []);

  // Merge real data with base dataset for "today" preset
  const mergedBySDR = useMemo(() => {
    const dataMap = new Map(allSdrsWithZeros.map(s => [s.sdrEmail, { ...s }]));
    
    // Overwrite with real data where it exists
    bySDR.forEach(realRow => {
      if (dataMap.has(realRow.sdrEmail)) {
        dataMap.set(realRow.sdrEmail, realRow);
      }
    });

    // Sort: totalAgendamentos desc, realizadas desc, sdrName asc
    return Array.from(dataMap.values()).sort((a, b) => {
      if (b.totalAgendamentos !== a.totalAgendamentos) return b.totalAgendamentos - a.totalAgendamentos;
      if (b.realizadas !== a.realizadas) return b.realizadas - a.realizadas;
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

  // Values for goals panel - using meeting_slots for R1 metrics
  // AGENDAMENTO: conta por data de CRIAÇÃO (ação de agendar)
  // R1 AGENDADA: conta por data da REUNIÃO (scheduled_at)
  const dayValues = useMemo(() => ({
    agendamento: dayAgendamentosCriados?.totalAgendamentos || 0, // CRIADOS hoje
    r1Agendada: dayAgendaKPIs?.totalAgendadas || 0, // MARCADAS para hoje
    r1Realizada: dayAgendaKPIs?.totalRealizadas || 0,
    noShow: dayAgendaKPIs?.totalNoShows || 0,
    contrato: dayKPIs.totalContratos,
    r2Agendada: dayR2VendasKPIs?.r2Agendadas || 0,
    r2Realizada: dayR2VendasKPIs?.r2Realizadas || 0,
    vendaRealizada: dayR2VendasKPIs?.vendasRealizadas || 0,
  }), [dayKPIs, dayAgendaKPIs, dayAgendamentosCriados, dayR2VendasKPIs]);

  const weekValues = useMemo(() => ({
    agendamento: weekAgendamentosCriados?.totalAgendamentos || 0, // CRIADOS na semana
    r1Agendada: weekAgendaKPIs?.totalAgendadas || 0, // MARCADAS para a semana
    r1Realizada: weekAgendaKPIs?.totalRealizadas || 0,
    noShow: weekAgendaKPIs?.totalNoShows || 0,
    contrato: weekKPIs.totalContratos,
    r2Agendada: weekR2VendasKPIs?.r2Agendadas || 0,
    r2Realizada: weekR2VendasKPIs?.r2Realizadas || 0,
    vendaRealizada: weekR2VendasKPIs?.vendasRealizadas || 0,
  }), [weekKPIs, weekAgendaKPIs, weekAgendamentosCriados, weekR2VendasKPIs]);

  const monthValues = useMemo(() => ({
    agendamento: monthAgendamentosCriados?.totalAgendamentos || 0, // CRIADOS no mês
    r1Agendada: monthAgendaKPIs?.totalAgendadas || 0, // MARCADAS para o mês
    r1Realizada: monthAgendaKPIs?.totalRealizadas || 0,
    noShow: monthAgendaKPIs?.totalNoShows || 0,
    contrato: monthKPIs.totalContratos,
    r2Agendada: monthR2VendasKPIs?.r2Agendadas || 0,
    r2Realizada: monthR2VendasKPIs?.r2Realizadas || 0,
    vendaRealizada: monthR2VendasKPIs?.vendasRealizadas || 0,
  }), [monthKPIs, monthAgendaKPIs, monthAgendamentosCriados, monthR2VendasKPIs]);

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

  // Export to Excel function
  const handleExportExcel = () => {
    // Aba 1: Resumo por SDR
    const resumoData = filteredBySDR.map(sdr => ({
      "SDR": sdr.sdrName,
      "1º Agendamento": sdr.primeiroAgendamento,
      "Reagendamento": sdr.reagendamento,
      "Total Agendamentos": sdr.totalAgendamentos,
      "Realizadas": sdr.realizadas,
      "No-Show": sdr.noShows,
      "Contratos": sdr.contratos,
      "Taxa Conversão (%)": sdr.taxaConversao.toFixed(1),
      "Taxa No-Show (%)": sdr.taxaNoShow.toFixed(1),
    }));

    // Aba 2: Leads detalhados (filtrados pelos SDRs selecionados)
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

    // Criar workbook com 2 abas
    const wb = XLSX.utils.book_new();
    const wsResumo = XLSX.utils.json_to_sheet(resumoData);
    const wsLeads = XLSX.utils.json_to_sheet(leadsData);
    
    XLSX.utils.book_append_sheet(wb, wsResumo, "Resumo SDR");
    XLSX.utils.book_append_sheet(wb, wsLeads, "Leads Detalhados");
    
    // Download
    XLSX.writeFile(wb, `painel_sdr_${format(start, "yyyyMMdd")}_${format(end, "yyyyMMdd")}.xlsx`);
  };

  return (
    <div className="space-y-6 p-6">
      {/* MCF Incorporador - Métricas Monetárias - PRIMEIRO */}
      <IncorporadorMetricsCard />

      {/* Goals Panel */}
      <TeamGoalsPanel dayValues={dayValues} weekValues={weekValues} monthValues={monthValues} />

      {/* Filters */}
      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            {/* Date Preset Buttons */}
            <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
              <Button
                variant={datePreset === "today" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => handlePresetChange("today")}
              >
                Hoje
              </Button>
              <Button
                variant={datePreset === "week" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => handlePresetChange("week")}
              >
                Semana
              </Button>
              <Button
                variant={datePreset === "month" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => handlePresetChange("month")}
              >
                Mês
              </Button>
              <Button
                variant={datePreset === "custom" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => handlePresetChange("custom")}
              >
                Personalizado
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
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filtrar por SDR" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os SDRs</SelectItem>
                {SDR_LIST.map(sdr => (
                  <SelectItem key={sdr.email} value={sdr.email}>
                    {sdr.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="sm"
              onClick={handleExportExcel}
              disabled={isLoading}
            >
              <Download className="h-4 w-4 mr-1" />
              Exportar Excel
            </Button>
          </div>

          {/* Active period display */}
          <div className="mt-3 text-xs text-muted-foreground">
            Período: {format(start, "dd/MM/yyyy")} - {format(end, "dd/MM/yyyy")}
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <TeamKPICards kpis={teamKPIs} isLoading={isLoading} />

      {/* SDR Summary Table */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Resumo por SDR
            {filteredBySDR.length > 0 && (
              <span className="text-sm font-normal text-muted-foreground">
                ({filteredBySDR.length} SDRs)
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <SdrSummaryTable
            data={filteredBySDR}
            isLoading={isLoading}
            ghostCountBySdr={ghostCountBySdr}
            disableNavigation={isSdr}
          />
        </CardContent>
      </Card>
    </div>
  );
}
