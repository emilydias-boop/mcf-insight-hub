import { useState } from "react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, AlertCircle, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSdrMeetings, MeetingFilters, Meeting } from "@/hooks/useSdrMeetings";
import { useCRMOrigins } from "@/hooks/useCRMData";
import { MeetingSummaryCards } from "@/components/sdr/MeetingSummaryCards";
import { MeetingsTable } from "@/components/sdr/MeetingsTable";
import { MeetingDetailsDrawer } from "@/components/sdr/MeetingDetailsDrawer";
import { ReviewRequestModal } from "@/components/sdr/ReviewRequestModal";

type DatePreset = 'today' | 'week' | 'month' | 'custom';
type ResultFilter = 'all' | 'pendente' | 'realizada' | 'no_show' | 'reagendada';

export default function MinhasReunioes() {
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [datePreset, setDatePreset] = useState<DatePreset>('month');
  const [resultFilter, setResultFilter] = useState<ResultFilter>('all');
  const [originFilter, setOriginFilter] = useState<string>('all');
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);

  // Calculate date range based on preset
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
      default:
        return {};
    }
  };

  const filters: MeetingFilters = {
    ...getDateRange(),
    resultado: resultFilter === 'all' ? undefined : resultFilter,
    originId: originFilter === 'all' ? undefined : originFilter
  };

  const { data, isLoading } = useSdrMeetings(filters);
  const { data: originsData } = useCRMOrigins();

  // Flatten origins for dropdown
  const flatOrigins = originsData?.flatMap(group => group.children || []) || [];

  // Generate month options for selector
  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    return {
      value: format(date, 'yyyy-MM'),
      label: format(date, 'MMMM yyyy', { locale: ptBR })
    };
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
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
          {/* Month Selector */}
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
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
      <MeetingSummaryCards 
        summary={data?.summary || { reunioesAgendadas: 0, reunioesRealizadas: 0, noShows: 0, taxaConversao: 0 }} 
        isLoading={isLoading} 
      />
      
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 p-3 bg-muted/30 rounded-lg">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Filter className="h-4 w-4" />
          Filtros:
        </div>
        
        {/* Date Preset */}
        <Select value={datePreset} onValueChange={(v: DatePreset) => setDatePreset(v)}>
          <SelectTrigger className="w-[130px] h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Hoje</SelectItem>
            <SelectItem value="week">Esta Semana</SelectItem>
            <SelectItem value="month">Mês Inteiro</SelectItem>
          </SelectContent>
        </Select>
        
        {/* Result Filter */}
        <Select value={resultFilter} onValueChange={(v: ResultFilter) => setResultFilter(v)}>
          <SelectTrigger className="w-[140px] h-9">
            <SelectValue placeholder="Resultado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pendente">Pendente</SelectItem>
            <SelectItem value="realizada">Realizada</SelectItem>
            <SelectItem value="no_show">No-show</SelectItem>
          </SelectContent>
        </Select>
        
        {/* Origin Filter */}
        <Select value={originFilter} onValueChange={setOriginFilter}>
          <SelectTrigger className="w-[160px] h-9">
            <SelectValue placeholder="Origem" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas Origens</SelectItem>
            {flatOrigins.map((origin) => (
              <SelectItem key={origin.id} value={origin.id}>
                {origin.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      {/* Meetings Table */}
      <MeetingsTable 
        meetings={data?.meetings || []} 
        isLoading={isLoading}
        onSelectMeeting={setSelectedMeeting}
      />
      
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
