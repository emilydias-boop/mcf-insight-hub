import { useState, useMemo, useEffect, useCallback } from 'react';
import { format, addDays, addWeeks, subWeeks, addMonths, subMonths, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { WEEK_STARTS_ON } from '@/lib/businessDays';
import { CalendarDays, ChevronLeft, ChevronRight, Settings, Users, RefreshCw, Plus, Columns3, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Skeleton } from '@/components/ui/skeleton';
import { AgendaCalendar, ViewMode } from '@/components/crm/AgendaCalendar';
import { MeetingsList } from '@/components/crm/MeetingsList';
import { CloserAvailabilityConfig } from '@/components/crm/CloserAvailabilityConfig';
import { CloserColumnCalendar } from '@/components/crm/CloserColumnCalendar';
import { AgendaMeetingDrawer } from '@/components/crm/AgendaMeetingDrawer';
import { QuickScheduleModal } from '@/components/crm/QuickScheduleModal';
import { RescheduleModal } from '@/components/crm/RescheduleModal';
import { UpcomingMeetingsPanel } from '@/components/crm/UpcomingMeetingsPanel';
import { AgendaEncaixePanel } from '@/components/crm/AgendaEncaixePanel';
import { useAgendaMeetings, useClosersWithAvailability, useBlockedDates, MeetingSlot } from '@/hooks/useAgendaData';
import { useMeetingReminders } from '@/hooks/useMeetingReminders';
import { EncaixeQueueItem } from '@/hooks/useEncaixeQueue';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useMyCloser } from '@/hooks/useMyCloser';

export default function Agenda() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const { data: myCloser } = useMyCloser();
  
  const isCloser = role === 'closer';
  
  useMeetingReminders(); // Automatic 15-min reminders
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [closerFilter, setCloserFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [configOpen, setConfigOpen] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<MeetingSlot | null>(null);
  const [quickScheduleOpen, setQuickScheduleOpen] = useState(false);
  const [rescheduleModalOpen, setRescheduleModalOpen] = useState(false);
  const [meetingToReschedule, setMeetingToReschedule] = useState<MeetingSlot | null>(null);
  const [preselectedCloserId, setPreselectedCloserId] = useState<string | undefined>();
  const [preselectedDate, setPreselectedDate] = useState<Date | undefined>();
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Calculate date range based on viewMode
  const { rangeStart, rangeEnd } = useMemo(() => {
    if (viewMode === 'day') {
      // Usar startOfDay para garantir que todas as reuniões do dia sejam buscadas
      return { rangeStart: startOfDay(selectedDate), rangeEnd: endOfDay(selectedDate) };
    } else if (viewMode === 'month') {
      return { rangeStart: startOfMonth(selectedDate), rangeEnd: endOfMonth(selectedDate) };
    }
    // week (sábado a sexta)
    const weekStart = startOfWeek(selectedDate, { weekStartsOn: WEEK_STARTS_ON });
    const weekEnd = endOfWeek(selectedDate, { weekStartsOn: WEEK_STARTS_ON });
    return { rangeStart: weekStart, rangeEnd: weekEnd };
  }, [selectedDate, viewMode]);

  const { data: meetings = [], isLoading: meetingsLoading, refetch } = useAgendaMeetings(rangeStart, rangeEnd);
  const { data: closers = [], isLoading: closersLoading } = useClosersWithAvailability();
  const { data: blockedDates = [] } = useBlockedDates();

  // Fail-closed: se é closer mas não tem vínculo, não mostra nada
  const closerHasNoLink = isCloser && !myCloser?.id;

  // Filtrar closers: closer só vê sua própria coluna
  const filteredClosers = useMemo(() => {
    if (isCloser) {
      if (!myCloser?.id) return []; // Fail-closed
      return closers.filter(c => c.id === myCloser.id);
    }
    return closers;
  }, [closers, isCloser, myCloser?.id]);

  const filteredMeetings = useMemo(() => {
    // Fail-closed: closer sem vínculo não vê nenhuma reunião
    if (isCloser && !myCloser?.id) {
      return [];
    }
    
    let result = meetings;
    
    // Closer só vê suas próprias reuniões
    if (isCloser && myCloser?.id) {
      result = result.filter(m => m.closer_id === myCloser.id);
    }
    
    if (closerFilter) {
      result = result.filter(m => m.closer_id === closerFilter);
    }
    if (statusFilter) {
      result = result.filter(m => m.status === statusFilter);
    }
    return result;
  }, [meetings, closerFilter, statusFilter, isCloser, myCloser?.id]);

  const handlePrev = () => {
    if (viewMode === 'day') {
      setSelectedDate(addDays(selectedDate, -1));
    } else if (viewMode === 'week') {
      setSelectedDate(subWeeks(selectedDate, 1));
    } else {
      setSelectedDate(subMonths(selectedDate, 1));
    }
  };

  const handleNext = () => {
    if (viewMode === 'day') {
      setSelectedDate(addDays(selectedDate, 1));
    } else if (viewMode === 'week') {
      setSelectedDate(addWeeks(selectedDate, 1));
    } else {
      setSelectedDate(addMonths(selectedDate, 1));
    }
  };

  const handleToday = useCallback(() => setSelectedDate(new Date()), []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore if typing in input/textarea
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        (event.target as HTMLElement).isContentEditable
      ) {
        return;
      }
      
      // Ignore if modal/drawer is open
      if (selectedMeeting || quickScheduleOpen || rescheduleModalOpen || configOpen || calendarOpen) {
        return;
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        handlePrev();
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        handleNext();
      } else if (event.key === 't' || event.key === 'T') {
        event.preventDefault();
        handleToday();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedDate, viewMode, selectedMeeting, quickScheduleOpen, rescheduleModalOpen, configOpen, calendarOpen, handleToday]);

  const handleViewDeal = (dealId: string) => {
    navigate(`/crm/negocios?deal=${dealId}`);
  };

  const handleMeetingUpdate = () => {
    refetch();
    setSelectedMeeting(null);
  };

  const handleReschedule = (meeting: MeetingSlot) => {
    setMeetingToReschedule(meeting);
    setSelectedMeeting(null);
    setRescheduleModalOpen(true);
  };

  const handleSelectSlot = (closerId: string, date: Date) => {
    setPreselectedCloserId(closerId);
    setPreselectedDate(date);
    setQuickScheduleOpen(true);
  };

  const handleQuickScheduleClose = (open: boolean) => {
    setQuickScheduleOpen(open);
    if (!open) {
      setPreselectedCloserId(undefined);
      setPreselectedDate(undefined);
      refetch();
    }
  };

  // Handle scheduling from encaixe queue
  const handleScheduleFromQueue = useCallback((item: EncaixeQueueItem) => {
    // Pre-fill the quick schedule modal with queue item data
    setPreselectedCloserId(item.closer_id);
    if (item.preferred_date) {
      const prefDate = new Date(item.preferred_date);
      // If preferred time is set, add it to the date
      if (item.preferred_time_start && item.preferred_time_start !== 'any') {
        const [hours, minutes] = item.preferred_time_start.split(':').map(Number);
        prefDate.setHours(hours, minutes, 0, 0);
      }
      setPreselectedDate(prefDate);
    } else {
      setPreselectedDate(selectedDate);
    }
    setQuickScheduleOpen(true);
  }, [selectedDate]);

  // Format date range label based on viewMode
  const dateRangeLabel = useMemo(() => {
    if (viewMode === 'day') {
      return format(selectedDate, "EEEE, dd 'de' MMMM yyyy", { locale: ptBR });
    } else if (viewMode === 'month') {
      return format(selectedDate, "MMMM 'de' yyyy", { locale: ptBR });
    }
    return `${format(rangeStart, "dd MMM", { locale: ptBR })} - ${format(rangeEnd, "dd MMM yyyy", { locale: ptBR })}`;
  }, [selectedDate, viewMode, rangeStart, rangeEnd]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CalendarDays className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">
              {isCloser ? 'Minha Agenda' : 'Agenda dos Closers'}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isCloser ? 'Suas reuniões agendadas' : 'Gerencie reuniões e disponibilidade'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          {!isCloser && (
            <>
              <Button variant="outline" onClick={() => navigate('/crm/agenda/metricas')}>
                <BarChart3 className="h-4 w-4 mr-2" />
                Métricas
              </Button>
              <Button variant="outline" onClick={() => setConfigOpen(true)}>
                <Settings className="h-4 w-4 mr-2" />
                Configurar
              </Button>
            </>
          )}
          <Button onClick={() => setQuickScheduleOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Agendar
          </Button>
        </div>
      </div>

      {/* Navigation and Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2">
        <div className="flex items-center gap-2">
          {/* View Mode Toggle - also resets to current date */}
          <ToggleGroup 
            type="single" 
            value={viewMode} 
            onValueChange={(v) => {
              if (v) {
                setViewMode(v as ViewMode);
                setSelectedDate(new Date());
              }
            }}
          >
            <ToggleGroupItem value="day" className="text-xs px-3">Dia</ToggleGroupItem>
            <ToggleGroupItem value="week" className="text-xs px-3">Semana</ToggleGroupItem>
            <ToggleGroupItem value="month" className="text-xs px-3">Mês</ToggleGroupItem>
          </ToggleGroup>

          {/* Date navigation with integrated arrows and mini-calendar */}
          <div className="flex items-center gap-1 border rounded-md px-1 py-0.5 bg-muted/30">
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handlePrev} title="Período anterior (←)">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  className="text-sm font-medium px-2 min-w-[140px] text-center capitalize h-7 hover:bg-muted"
                  title="Clique para selecionar data"
                >
                  {dateRangeLabel}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="center">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => {
                    if (date) {
                      setSelectedDate(date);
                      setCalendarOpen(false);
                    }
                  }}
                  locale={ptBR}
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleNext} title="Próximo período (→)">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isCloser && (
            <Select value={closerFilter || 'all'} onValueChange={(v) => setCloserFilter(v === 'all' ? null : v)}>
              <SelectTrigger className="w-[180px]">
                <Users className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Todos os closers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os closers</SelectItem>
                {closers.map(closer => (
                  <SelectItem key={closer.id} value={closer.id}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: closer.color || '#6B7280' }}
                      />
                      {closer.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Select value={statusFilter || 'all'} onValueChange={(v) => setStatusFilter(v === 'all' ? null : v)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Todos status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              <SelectItem value="scheduled">Agendadas</SelectItem>
              <SelectItem value="rescheduled">Reagendadas</SelectItem>
              <SelectItem value="completed">Realizadas</SelectItem>
              <SelectItem value="no_show">No-show</SelectItem>
              <SelectItem value="canceled">Canceladas</SelectItem>
              <SelectItem value="contract_paid">Contrato Pago</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Aviso se closer não tem vínculo */}
      {closerHasNoLink && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 text-center">
          <p className="text-destructive font-medium">
            Seu usuário não está vinculado a um closer.
          </p>
          <p className="text-sm text-muted-foreground">
            Fale com o administrador para corrigir seu cadastro.
          </p>
        </div>
      )}

      {/* Quick access panel for closers - show upcoming meetings */}
      {isCloser && myCloser?.id && (
        <UpcomingMeetingsPanel
          meetings={filteredMeetings}
          onSelectMeeting={setSelectedMeeting}
          maxItems={5}
        />
      )}

      {/* Main Content with side panel */}
      <div className="flex gap-4 flex-col lg:flex-row">
        {/* Main Content Tabs */}
        <Tabs defaultValue="calendar" className="flex-1">
          <TabsList>
            <TabsTrigger value="calendar" className="flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4" />
              Calendário
            </TabsTrigger>
            <TabsTrigger value="closers" className="flex items-center gap-1.5">
              <Columns3 className="h-4 w-4" />
              Por Closer
            </TabsTrigger>
            <TabsTrigger value="list">Lista</TabsTrigger>
          </TabsList>

          <TabsContent value="calendar" className="mt-4">
            {meetingsLoading ? (
              <Skeleton className="h-[600px] w-full" />
            ) : (
              <AgendaCalendar
                meetings={filteredMeetings}
                selectedDate={selectedDate}
                onSelectMeeting={setSelectedMeeting}
                closerFilter={closerFilter}
                closers={filteredClosers}
                viewMode={viewMode}
                onEditHours={() => setConfigOpen(true)}
                onSelectSlot={(day, hour, minute, closerId) => {
                  const selectedDateTime = new Date(day);
                  selectedDateTime.setHours(hour, minute, 0, 0);
                  setPreselectedDate(selectedDateTime);
                  if (closerId) {
                    setPreselectedCloserId(closerId);
                  }
                  setQuickScheduleOpen(true);
                }}
              />
            )}
          </TabsContent>

          <TabsContent value="closers" className="mt-4">
            {meetingsLoading || closersLoading ? (
              <Skeleton className="h-[600px] w-full" />
            ) : (
              <CloserColumnCalendar
                meetings={filteredMeetings}
                closers={filteredClosers}
                blockedDates={blockedDates}
                selectedDate={selectedDate}
                onSelectMeeting={setSelectedMeeting}
                onSelectSlot={handleSelectSlot}
                onEditHours={() => setConfigOpen(true)}
              />
            )}
          </TabsContent>

          <TabsContent value="list" className="mt-4">
            <MeetingsList
              meetings={filteredMeetings}
              isLoading={meetingsLoading}
              onViewDeal={handleViewDeal}
            />
          </TabsContent>
        </Tabs>

        {/* Encaixe Queue Panel - Available for all users */}
        <div className="w-full lg:w-80 flex-shrink-0">
          <AgendaEncaixePanel
            closers={isCloser && myCloser ? [{ id: myCloser.id, name: myCloser.name, color: null }] : filteredClosers}
            selectedDate={selectedDate}
            onScheduleFromQueue={handleScheduleFromQueue}
          />
        </div>
      </div>

      {/* Config Dialog */}
      <CloserAvailabilityConfig
        open={configOpen}
        onOpenChange={setConfigOpen}
        closers={closers}
        isLoading={closersLoading}
      />

      {/* Meeting Details Drawer */}
      <AgendaMeetingDrawer
        meeting={selectedMeeting}
        relatedMeetings={selectedMeeting ? filteredMeetings.filter(m => 
          m.id !== selectedMeeting.id && 
          m.scheduled_at === selectedMeeting.scheduled_at &&
          m.closer_id === selectedMeeting.closer_id
        ) : []}
        open={!!selectedMeeting}
        onOpenChange={(open) => !open && setSelectedMeeting(null)}
        onReschedule={handleReschedule}
      />

      {/* Quick Schedule Modal */}
      <QuickScheduleModal
        open={quickScheduleOpen}
        onOpenChange={handleQuickScheduleClose}
        closers={filteredClosers}
        preselectedCloserId={preselectedCloserId}
        preselectedDate={preselectedDate}
      />

      {/* Reschedule Modal */}
      {meetingToReschedule && (
        <RescheduleModal
          meeting={meetingToReschedule}
          open={rescheduleModalOpen}
          onOpenChange={(open) => {
            setRescheduleModalOpen(open);
            if (!open) {
              setMeetingToReschedule(null);
              refetch();
            }
          }}
          closers={filteredClosers}
        />
      )}
    </div>
  );
}
