import { useState, useMemo } from 'react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addDays, subDays, addWeeks, subWeeks, addMonths, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  RefreshCw, 
  Plus,
  Users,
  Settings,
  BarChart3
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useR2CloserMetrics } from '@/hooks/useR2CloserMetrics';
import { useR2AgendaMeetings } from '@/hooks/useR2AgendaMeetings';
import { useActiveR2Closers } from '@/hooks/useR2Closers';
import { R2CloserSummaryTable } from '@/components/crm/R2CloserSummaryTable';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

type ViewMode = 'day' | 'week' | 'month';

export default function AgendaR2() {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [closerFilter, setCloserFilter] = useState<string>('all');

  // Calculate date range based on view mode
  const { rangeStart, rangeEnd } = useMemo(() => {
    switch (viewMode) {
      case 'day':
        return { rangeStart: selectedDate, rangeEnd: selectedDate };
      case 'week':
        return {
          rangeStart: startOfWeek(selectedDate, { locale: ptBR, weekStartsOn: 1 }),
          rangeEnd: endOfWeek(selectedDate, { locale: ptBR, weekStartsOn: 1 })
        };
      case 'month':
        return {
          rangeStart: startOfMonth(selectedDate),
          rangeEnd: endOfMonth(selectedDate)
        };
    }
  }, [selectedDate, viewMode]);

  // Fetch data
  const { data: closers, isLoading: isLoadingClosers } = useActiveR2Closers();
  const { data: metrics, isLoading: isLoadingMetrics, refetch: refetchMetrics } = useR2CloserMetrics(rangeStart, rangeEnd);
  const { data: meetings, isLoading: isLoadingMeetings, refetch: refetchMeetings } = useR2AgendaMeetings(rangeStart, rangeEnd);

  // Filter meetings by closer
  const filteredMeetings = useMemo(() => {
    if (!meetings) return [];
    if (closerFilter === 'all') return meetings;
    return meetings.filter(m => m.closer?.id === closerFilter);
  }, [meetings, closerFilter]);

  // Navigation handlers
  const handlePrev = () => {
    switch (viewMode) {
      case 'day':
        setSelectedDate(subDays(selectedDate, 1));
        break;
      case 'week':
        setSelectedDate(subWeeks(selectedDate, 1));
        break;
      case 'month':
        setSelectedDate(subMonths(selectedDate, 1));
        break;
    }
  };

  const handleNext = () => {
    switch (viewMode) {
      case 'day':
        setSelectedDate(addDays(selectedDate, 1));
        break;
      case 'week':
        setSelectedDate(addWeeks(selectedDate, 1));
        break;
      case 'month':
        setSelectedDate(addMonths(selectedDate, 1));
        break;
    }
  };

  const handleToday = () => {
    setSelectedDate(new Date());
  };

  const handleRefresh = () => {
    refetchMetrics();
    refetchMeetings();
  };

  // Format date range display
  const dateRangeDisplay = useMemo(() => {
    switch (viewMode) {
      case 'day':
        return format(selectedDate, "EEEE, d 'de' MMMM", { locale: ptBR });
      case 'week':
        return `${format(rangeStart, "d 'de' MMM", { locale: ptBR })} - ${format(rangeEnd, "d 'de' MMM", { locale: ptBR })}`;
      case 'month':
        return format(selectedDate, "MMMM 'de' yyyy", { locale: ptBR });
    }
  }, [selectedDate, viewMode, rangeStart, rangeEnd]);

  // Calculate summary stats
  const summaryStats = useMemo(() => {
    if (!metrics) return { total: 0, realizadas: 0, noshow: 0, contratos: 0 };
    return metrics.reduce(
      (acc, m) => ({
        total: acc.total + m.r2_agendada,
        realizadas: acc.realizadas + m.r1_realizada,
        noshow: acc.noshow + m.noshow,
        contratos: acc.contratos + m.contrato_pago
      }),
      { total: 0, realizadas: 0, noshow: 0, contratos: 0 }
    );
  }, [metrics]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Agenda R2</h1>
          <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-500/20">
            Reunião 02
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate('/crm/configurar-closers-r2')}>
            <Settings className="h-4 w-4 mr-2" />
            Configurar Closers
          </Button>
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Agendar R2
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">R2 Agendadas</p>
                <p className="text-2xl font-bold">{summaryStats.total}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-purple-500/10 flex items-center justify-center">
                <CalendarIcon className="h-5 w-5 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Realizadas</p>
                <p className="text-2xl font-bold">{summaryStats.realizadas}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">No-show</p>
                <p className="text-2xl font-bold">{summaryStats.noshow}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-red-500/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Contratos Pagos</p>
                <p className="text-2xl font-bold">{summaryStats.contratos}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <BarChart3 className="h-5 w-5 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Metrics Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Performance por Closer R2</CardTitle>
            <div className="flex items-center gap-2">
              {/* Date Navigation */}
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" onClick={handlePrev}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="min-w-[200px]">
                      <CalendarIcon className="h-4 w-4 mr-2" />
                      {dateRangeDisplay}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="center">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={(date) => date && setSelectedDate(date)}
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>
                <Button variant="outline" size="icon" onClick={handleNext}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={handleToday}>
                  Hoje
                </Button>
              </div>

              {/* View Mode Toggle */}
              <div className="flex items-center border rounded-md">
                {(['day', 'week', 'month'] as ViewMode[]).map((mode) => (
                  <Button
                    key={mode}
                    variant={viewMode === mode ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode(mode)}
                    className="rounded-none first:rounded-l-md last:rounded-r-md"
                  >
                    {mode === 'day' ? 'Dia' : mode === 'week' ? 'Semana' : 'Mês'}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <R2CloserSummaryTable 
            data={metrics} 
            isLoading={isLoadingMetrics}
            onCloserClick={(closerId) => setCloserFilter(closerId)}
          />
        </CardContent>
      </Card>

      {/* Calendar/List View */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Reuniões R2</CardTitle>
            <Select value={closerFilter} onValueChange={setCloserFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filtrar por closer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os closers</SelectItem>
                {closers?.map((closer) => (
                  <SelectItem key={closer.id} value={closer.id}>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-2 h-2 rounded-full" 
                        style={{ backgroundColor: closer.color || '#6B7280' }}
                      />
                      {closer.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="list">
            <TabsList>
              <TabsTrigger value="list">Lista</TabsTrigger>
              <TabsTrigger value="calendar">Calendário</TabsTrigger>
            </TabsList>
            <TabsContent value="list" className="mt-4">
              {isLoadingMeetings ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : filteredMeetings.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhuma reunião R2 encontrada no período selecionado.
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredMeetings.map((meeting) => {
                    const attendee = meeting.attendees?.[0];
                    return (
                      <div 
                        key={meeting.id}
                        className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-1 h-12 rounded-full"
                            style={{ backgroundColor: meeting.closer?.color || '#6B7280' }}
                          />
                          <div>
                            <p className="font-medium">
                              {attendee?.name || 'Sem participante'}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {format(new Date(meeting.scheduled_at), "EEEE, d 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="text-sm font-medium">{meeting.closer?.name}</p>
                            <Badge 
                              variant="outline"
                              className={cn(
                                meeting.status === 'completed' && 'bg-green-500/10 text-green-600 border-green-500/20',
                                meeting.status === 'no_show' && 'bg-red-500/10 text-red-600 border-red-500/20',
                                meeting.status === 'scheduled' && 'bg-blue-500/10 text-blue-600 border-blue-500/20',
                                meeting.status === 'cancelled' && 'bg-gray-500/10 text-gray-600 border-gray-500/20'
                              )}
                            >
                              {meeting.status === 'completed' ? 'Realizada' :
                               meeting.status === 'no_show' ? 'No-show' :
                               meeting.status === 'scheduled' ? 'Agendada' :
                               meeting.status === 'cancelled' ? 'Cancelada' :
                               meeting.status}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>
            <TabsContent value="calendar" className="mt-4">
              <div className="text-center py-8 text-muted-foreground">
                Calendário visual em desenvolvimento...
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
