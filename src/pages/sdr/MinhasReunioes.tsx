import { useState } from "react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, AlertCircle, Filter, Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { useSdrMeetings, useSdrOriginsAndStages, MeetingFilters, Meeting } from "@/hooks/useSdrMeetings";
import { MeetingSummaryCards } from "@/components/sdr/MeetingSummaryCards";
import { MeetingsTable } from "@/components/sdr/MeetingsTable";
import { MeetingDetailsDrawer } from "@/components/sdr/MeetingDetailsDrawer";
import { ReviewRequestModal } from "@/components/sdr/ReviewRequestModal";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type DatePreset = 'today' | 'week' | 'month' | 'custom';

const formatTimeToHuman = (hours: number | null): string => {
  if (hours === null) return 'N/A';
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
};

export default function MinhasReunioes() {
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [datePreset, setDatePreset] = useState<DatePreset>('month');
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>(undefined);
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>(undefined);
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [originFilter, setOriginFilter] = useState<string>('all');
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);

  // Fetch origins/stages separately (not affected by date filter)
  const { data: originsStagesData } = useSdrOriginsAndStages();

  // Calculate date range based on preset or custom
  const getDateRange = (): { startDate?: Date; endDate?: Date } => {
    const now = new Date();
    switch (datePreset) {
      case 'today':
        return { startDate: startOfDay(now), endDate: endOfDay(now) };
      case 'week':
        return { startDate: startOfWeek(now, { locale: ptBR }), endDate: endOfWeek(now, { locale: ptBR }) };
      case 'month':
        const [year, month] = selectedMonth.split('-').map(Number);
        const monthDate = new Date(year, month - 1);
        return { startDate: startOfMonth(monthDate), endDate: endOfMonth(monthDate) };
      case 'custom':
        return { 
          startDate: customStartDate ? startOfDay(customStartDate) : undefined, 
          endDate: customEndDate ? endOfDay(customEndDate) : undefined 
        };
      default:
        return {};
    }
  };

  const filters: MeetingFilters = {
    ...getDateRange(),
    stageFilter: stageFilter === 'all' ? undefined : stageFilter,
    originId: originFilter === 'all' ? undefined : originFilter
  };

  const { data, isLoading } = useSdrMeetings(filters);

  // Use origins/stages from separate hook (not affected by date filter)
  const userOrigins = originsStagesData?.origins || [];
  const uniqueStages = originsStagesData?.stages || [];

  // Generate month options for selector
  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    return {
      value: format(date, 'yyyy-MM'),
      label: format(date, 'MMMM yyyy', { locale: ptBR })
    };
  });

  // Handle preset shortcuts
  const handlePresetClick = (preset: DatePreset) => {
    setDatePreset(preset);
    if (preset !== 'custom') {
      setCustomStartDate(undefined);
      setCustomEndDate(undefined);
    }
  };

  // Handle custom date selection
  const handleCustomStartDate = (date: Date | undefined) => {
    setCustomStartDate(date);
    setDatePreset('custom');
  };

  const handleCustomEndDate = (date: Date | undefined) => {
    setCustomEndDate(date);
    setDatePreset('custom');
  };

  const clearCustomDates = () => {
    setCustomStartDate(undefined);
    setCustomEndDate(undefined);
    setDatePreset('month');
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (!data?.meetings.length) {
      toast.error('Nenhum dado para exportar');
      return;
    }

    const headers = ['Data', 'Lead', 'Email', 'Telefone', 'Origem', 'Estágio', 'Tempo p/ Agendar', 'Tempo p/ Contrato', 'Probabilidade'];
    const rows = data.meetings.map(m => [
      m.scheduledDate ? format(new Date(m.scheduledDate), 'dd/MM/yyyy HH:mm') : '',
      m.contactName,
      m.contactEmail || '',
      m.contactPhone || '',
      m.originName,
      m.currentStage,
      formatTimeToHuman(m.timeToSchedule),
      formatTimeToHuman(m.timeToContract),
      m.probability ? `${m.probability}%` : ''
    ]);

    const csvContent = '\uFEFF' + [headers, ...rows].map(r => r.map(c => `"${c}"`).join(';')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `minhas-reunioes-${selectedMonth}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Arquivo exportado com sucesso');
  };

  return (
    <div className="h-[calc(100vh-56px)] flex flex-col p-6 overflow-hidden">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Calendar className="h-6 w-6" />
            Minhas Reuniões
          </h1>
          <p className="text-muted-foreground mt-1">
            Resumo dos seus agendamentos e resultados
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Month Selector (for month preset) */}
          <Select value={selectedMonth} onValueChange={(v) => { setSelectedMonth(v); setDatePreset('month'); }}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map((month) => (
                <SelectItem key={month.value} value={month.value}>
                  {month.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {/* Review Request Button */}
          <Button 
            variant="outline" 
            onClick={() => setReviewModalOpen(true)}
            className="gap-2"
          >
            <AlertCircle className="h-4 w-4" />
            <span className="hidden sm:inline">Pedir revisão</span>
          </Button>
        </div>
      </div>
      
      {/* Summary Cards */}
      <div className="flex-shrink-0 mt-6">
        <MeetingSummaryCards 
          summary={data?.summary || { reunioesAgendadas: 0, reunioesRealizadas: 0, noShows: 0, taxaConversao: 0 }} 
          isLoading={isLoading} 
        />
      </div>
      
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 p-3 bg-muted/30 rounded-lg mt-6 flex-shrink-0">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Filter className="h-4 w-4" />
          Filtros:
        </div>
        
        {/* Date Preset Shortcuts */}
        <div className="flex items-center gap-1">
          <Button 
            variant={datePreset === 'today' ? 'default' : 'outline'} 
            size="sm" 
            onClick={() => handlePresetClick('today')}
          >
            Hoje
          </Button>
          <Button 
            variant={datePreset === 'week' ? 'default' : 'outline'} 
            size="sm" 
            onClick={() => handlePresetClick('week')}
          >
            Semana
          </Button>
          <Button 
            variant={datePreset === 'month' ? 'default' : 'outline'} 
            size="sm" 
            onClick={() => handlePresetClick('month')}
          >
            Mês
          </Button>
        </div>

        {/* Custom Date Pickers */}
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "w-[130px] justify-start text-left font-normal",
                  !customStartDate && "text-muted-foreground"
                )}
              >
                <Calendar className="mr-2 h-4 w-4" />
                {customStartDate ? format(customStartDate, "dd/MM/yyyy") : "Início"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarComponent
                mode="single"
                selected={customStartDate}
                onSelect={handleCustomStartDate}
                initialFocus
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "w-[130px] justify-start text-left font-normal",
                  !customEndDate && "text-muted-foreground"
                )}
              >
                <Calendar className="mr-2 h-4 w-4" />
                {customEndDate ? format(customEndDate, "dd/MM/yyyy") : "Fim"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarComponent
                mode="single"
                selected={customEndDate}
                onSelect={handleCustomEndDate}
                initialFocus
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>

          {(customStartDate || customEndDate) && (
            <Button variant="ghost" size="sm" onClick={clearCustomDates} className="h-8 w-8 p-0">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        
        {/* Stage Filter with real stage names */}
        <Select value={stageFilter} onValueChange={setStageFilter}>
          <SelectTrigger className="w-[180px] h-9">
            <SelectValue placeholder="Estágio" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Estágios</SelectItem>
            {uniqueStages.map((stage) => (
              <SelectItem key={stage} value={stage}>
                {stage}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        {/* Origin Filter - only user's origins */}
        <Select value={originFilter} onValueChange={setOriginFilter}>
          <SelectTrigger className="w-[160px] h-9">
            <SelectValue placeholder="Origem" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas Origens</SelectItem>
            {userOrigins.map((origin) => (
              <SelectItem key={origin.id} value={origin.id}>
                {origin.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Export Button */}
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleExportCSV}
          className="ml-auto"
        >
          <Download className="h-4 w-4 mr-2" />
          Exportar
        </Button>
      </div>
      
      {/* Meetings Table with internal scroll */}
      <div className="flex-1 min-h-0 mt-6 overflow-hidden">
        <MeetingsTable 
          meetings={data?.meetings || []} 
          isLoading={isLoading}
          onSelectMeeting={setSelectedMeeting}
        />
      </div>
      
      {/* Details Drawer */}
      {selectedMeeting && (
        <MeetingDetailsDrawer 
          meeting={selectedMeeting} 
          onClose={() => setSelectedMeeting(null)} 
        />
      )}
      
      {/* Review Request Modal */}
      <ReviewRequestModal 
        open={reviewModalOpen} 
        onOpenChange={setReviewModalOpen}
        defaultPeriod={selectedMonth}
      />
    </div>
  );
}
