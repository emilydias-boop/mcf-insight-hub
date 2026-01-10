import { useState } from "react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { WEEK_STARTS_ON } from "@/lib/businessDays";
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
import { useSdrOriginsAndStages } from "@/hooks/useSdrMeetings";
import { useMinhasReunioesV2, MeetingV2 } from "@/hooks/useSdrMetricsV2";
import { MeetingSummaryCards } from "@/components/sdr/MeetingSummaryCards";
import { MeetingsTable } from "@/components/sdr/MeetingsTable";
import { MeetingDetailsDrawer } from "@/components/sdr/MeetingDetailsDrawer";
import { ReviewRequestModal } from "@/components/sdr/ReviewRequestModal";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type DatePreset = 'today' | 'week' | 'month' | 'custom';

export default function MinhasReunioes() {
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [datePreset, setDatePreset] = useState<DatePreset>('month');
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>(undefined);
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [originFilter, setOriginFilter] = useState<string>('all');
  const [selectedMeeting, setSelectedMeeting] = useState<MeetingV2 | null>(null);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);

  // Fetch origins/stages separately (not affected by date filter)
  const { data: originsStagesData } = useSdrOriginsAndStages();

  // Calculate date range based on preset or custom
  const getDateRange = (): { startDate: Date | null; endDate: Date | null } => {
    const now = new Date();
    switch (datePreset) {
      case 'today':
        return { startDate: startOfDay(now), endDate: endOfDay(now) };
      case 'week':
        return { startDate: startOfWeek(now, { weekStartsOn: WEEK_STARTS_ON }), endDate: endOfWeek(now, { weekStartsOn: WEEK_STARTS_ON }) };
      case 'month':
        const [year, month] = selectedMonth.split('-').map(Number);
        const monthDate = new Date(year, month - 1);
        return { startDate: startOfMonth(monthDate), endDate: endOfMonth(monthDate) };
      case 'custom':
        return { 
          startDate: customStartDate ? startOfDay(customStartDate) : null, 
          endDate: customEndDate ? endOfDay(customEndDate) : null 
        };
      default:
        return { startDate: null, endDate: null };
    }
  };

  const { startDate, endDate } = getDateRange();
  
  // Usar nova hook V2 com lógica corrigida
  const { meetings, summary, isLoading } = useMinhasReunioesV2(startDate, endDate);

  // Filtrar reuniões localmente
  const filteredMeetings = meetings.filter(m => {
    if (statusFilter !== 'all' && m.status_atual !== statusFilter) return false;
    // Origin filter seria implementado se necessário
    return true;
  });

  // Use origins/stages from separate hook (not affected by date filter)
  const userOrigins = originsStagesData?.origins || [];
  
  // Status únicos das reuniões
  const uniqueStatuses = [...new Set(meetings.map(m => m.status_atual))];

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
    if (!filteredMeetings.length) {
      toast.error('Nenhum dado para exportar');
      return;
    }

    const headers = ['Data', 'Tipo', 'Lead', 'Email', 'Telefone', 'Origem', 'Status', 'Closer', 'Probabilidade'];
    const rows = filteredMeetings.map(m => [
      m.data_agendamento ? format(new Date(m.data_agendamento), 'dd/MM/yyyy HH:mm') : '',
      m.tipo,
      m.contact_name,
      m.contact_email || '',
      m.contact_phone || '',
      m.origin_name || '',
      m.status_atual,
      m.closer || '',
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
            Resumo dos seus agendamentos e resultados (nova lógica de contagem)
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
          summary={summary} 
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
        
        {/* Status Filter */}
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px] h-9">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Status</SelectItem>
            {uniqueStatuses.map((status) => (
              <SelectItem key={status} value={status}>
                {status}
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
          meetings={filteredMeetings} 
          isLoading={isLoading}
          onSelectMeeting={(m) => setSelectedMeeting(m as MeetingV2)}
        />
      </div>
      
      {/* Details Drawer - adaptar para MeetingV2 */}
      {selectedMeeting && (
        <MeetingDetailsDrawer 
          meeting={{
            id: selectedMeeting.deal_id,
            dealId: selectedMeeting.deal_id,
            dealName: selectedMeeting.deal_name,
            contactName: selectedMeeting.contact_name,
            contactEmail: selectedMeeting.contact_email,
            contactPhone: selectedMeeting.contact_phone,
            originId: null,
            originName: selectedMeeting.origin_name || 'Desconhecida',
            currentStage: selectedMeeting.status_atual,
            currentStageClassification: 'other',
            scheduledDate: selectedMeeting.data_agendamento,
            probability: selectedMeeting.probability,
            timeToSchedule: null,
            timeToContract: null,
            createdAt: ''
          }} 
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
