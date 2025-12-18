import { useState, useMemo } from "react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, Users, Download, RefreshCw } from "lucide-react";
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
import { SdrSummaryTable } from "@/components/sdr/SdrSummaryTable";
import { useTeamMeetingsData } from "@/hooks/useTeamMeetingsData";
import { SDR_LIST } from "@/constants/team";

type DatePreset = "today" | "week" | "month" | "custom";

export default function ReunioesEquipe() {
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [datePreset, setDatePreset] = useState<DatePreset>("month");
  const [customStartDate, setCustomStartDate] = useState<Date | null>(null);
  const [customEndDate, setCustomEndDate] = useState<Date | null>(null);
  const [sdrFilter, setSdrFilter] = useState<string>("all");

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
    getMeetingsForSDR,
    isLoading,
    refetch,
  } = useTeamMeetingsData({
    startDate: start,
    endDate: end,
    sdrEmailFilter: sdrFilter !== "all" ? sdrFilter : undefined,
  });

  // Filter bySDR based on sdrFilter (if we need local filtering)
  const filteredBySDR = useMemo(() => {
    if (sdrFilter === "all") return bySDR;
    return bySDR.filter(s => s.sdrEmail === sdrFilter);
  }, [bySDR, sdrFilter]);

  // Get selected SDR meetings
  const selectedSdrMeetings = useMemo(() => {
    if (!selectedSdr) return [];
    return getMeetingsForSDR(selectedSdr.sdrEmail);
  }, [selectedSdr, getMeetingsForSDR]);

  // Handle SDR selection from table
  const handleSelectSdr = (sdrEmail: string) => {
    const sdr = bySDR.find(s => s.sdrEmail === sdrEmail);
    if (sdr) {
      // Toggle selection
      if (selectedSdr?.sdrEmail === sdrEmail) {
        setSelectedSdr(null);
      } else {
        setSelectedSdr(sdr);
      }
    }
  };

  // Month navigation
  const handleMonthChange = (increment: number) => {
    const newDate = new Date(selectedMonth);
    newDate.setMonth(newDate.getMonth() + increment);
    setSelectedMonth(newDate);
  };

  return (
    <div className="space-y-6 p-6">
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
                onClick={() => setDatePreset("today")}
              >
                Hoje
              </Button>
              <Button
                variant={datePreset === "week" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setDatePreset("week")}
              >
                Semana
              </Button>
              <Button
                variant={datePreset === "month" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setDatePreset("month")}
              >
                Mês
              </Button>
              <Button
                variant={datePreset === "custom" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setDatePreset("custom")}
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
                  onSelect={(date) => setCustomStartDate(date as Date | null)}
                  placeholder="Data início"
                />
                <span className="text-muted-foreground">até</span>
                <DatePickerCustom
                  selected={customEndDate || undefined}
                  onSelect={(date) => setCustomEndDate(date as Date | null)}
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
            selectedSdrEmail={selectedSdr?.sdrEmail}
            onSelectSdr={handleSelectSdr}
          />
        </CardContent>
      </Card>

      {/* Selected SDR Leads Panel */}
      {selectedSdr && (
        <SelectedSdrLeadsPanel
          sdrName={selectedSdr.sdrName}
          sdrEmail={selectedSdr.sdrEmail}
          meetings={selectedSdrMeetings}
          onClose={() => setSelectedSdr(null)}
        />
      )}
    </div>
  );
}
