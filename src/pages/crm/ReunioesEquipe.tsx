import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfDay, endOfDay, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, Users, RefreshCw } from "lucide-react";
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
import { SdrSummaryTable } from "@/components/sdr/SdrSummaryTable";
import { GhostAppointmentsAlert } from "@/components/sdr/GhostAppointmentsAlert";
import { useTeamMeetingsData } from "@/hooks/useTeamMeetingsData";
import { useGhostCountBySdr } from "@/hooks/useGhostCountBySdr";
import { SDR_LIST } from "@/constants/team";

type DatePreset = "today" | "week" | "month" | "custom";

export default function ReunioesEquipe() {
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
    : null;

  const [selectedMonth, setSelectedMonth] = useState(initialMonth);
  const [datePreset, setDatePreset] = useState<DatePreset>(initialPreset);
  const [customStartDate, setCustomStartDate] = useState<Date | null>(initialStart);
  const [customEndDate, setCustomEndDate] = useState<Date | null>(initialEnd);
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
      case "week":
        return { start: startOfWeek(today, { locale: ptBR }), end: endOfWeek(today, { locale: ptBR }) };
      case "month":
        return { start: startOfMonth(selectedMonth), end: endOfMonth(selectedMonth) };
      case "custom":
        return { 
          start: customStartDate || startOfMonth(today), 
          end: customEndDate || endOfMonth(today) 
        };
      default:
        return { start: startOfMonth(selectedMonth), end: endOfMonth(selectedMonth) };
    }
  };

  const { start, end } = getDateRange();

  // Fetch data with optional SDR filter
  const {
    teamKPIs,
    bySDR,
    isLoading,
    refetch,
  } = useTeamMeetingsData({
    startDate: start,
    endDate: end,
    sdrEmailFilter: sdrFilter !== "all" ? sdrFilter : undefined,
  });

  // Ghost appointments data
  const { data: ghostCountBySdr } = useGhostCountBySdr();

  // Filter bySDR based on sdrFilter (if we need local filtering)
  const filteredBySDR = useMemo(() => {
    if (sdrFilter === "all") return bySDR;
    return bySDR.filter(s => s.sdrEmail === sdrFilter);
  }, [bySDR, sdrFilter]);

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

  return (
    <div className="space-y-6 p-6">
      {/* Ghost Appointments Alert */}
      <GhostAppointmentsAlert />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            Reuniões da Equipe
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Visão consolidada das reuniões de todos os SDRs
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </div>

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
          />
        </CardContent>
      </Card>
    </div>
  );
}
