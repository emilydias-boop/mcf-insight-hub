import { useState, useMemo, useEffect } from 'react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addDays, subDays, addWeeks, subWeeks, addMonths, subMonths, isSameDay } from 'date-fns';
import { WEEK_STARTS_ON } from '@/lib/businessDays';
import { ptBR } from 'date-fns/locale';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  RefreshCw, 
  Plus,
  Settings,
  List,
  LayoutGrid,
  Clock,
  Sliders
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useR2MeetingsExtended } from '@/hooks/useR2MeetingsExtended';
import { useActiveR2Closers, useR2ClosersList } from '@/hooks/useR2Closers';
import { useR2StatusOptions, useR2ThermometerOptions } from '@/hooks/useR2StatusOptions';
import { R2CloserColumnCalendar } from '@/components/crm/R2CloserColumnCalendar';
import { AgendaCalendar } from '@/components/crm/AgendaCalendar';
import { MeetingSlot, CloserWithAvailability } from '@/hooks/useAgendaData';
import { R2MeetingDetailDrawer } from '@/components/crm/R2MeetingDetailDrawer';
import { R2QuickScheduleModal } from '@/components/crm/R2QuickScheduleModal';
import { R2CloserAvailabilityConfig } from '@/components/crm/R2CloserAvailabilityConfig';
import { R2PendingLeadsPanel } from '@/components/crm/R2PendingLeadsPanel';
import { R2ListViewTable } from '@/components/crm/R2ListViewTable';
import { R2StatusConfigModal } from '@/components/crm/R2StatusConfigModal';
import { useR2PendingLeadsCount } from '@/hooks/useR2PendingLeads';
import { R2RescheduleModal } from '@/components/crm/R2RescheduleModal';
import { R2MeetingRow } from '@/types/r2Agenda';
import { R2Meeting } from '@/hooks/useR2AgendaMeetings';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

type ViewMode = 'day' | 'week' | 'month';

export default function AgendaR2() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [closerFilter, setCloserFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  // Modal/Drawer states
  const [selectedMeeting, setSelectedMeeting] = useState<R2MeetingRow | null>(null);
  const [meetingDrawerOpen, setMeetingDrawerOpen] = useState(false);
  const [quickScheduleOpen, setQuickScheduleOpen] = useState(false);
  const [rescheduleModalOpen, setRescheduleModalOpen] = useState(false);
  const [meetingToReschedule, setMeetingToReschedule] = useState<R2MeetingRow | null>(null);
  const [preselectedCloserId, setPreselectedCloserId] = useState<string | undefined>();
  const [preselectedDate, setPreselectedDate] = useState<Date | undefined>();
  const [availabilityConfigOpen, setAvailabilityConfigOpen] = useState(false);
  const [statusConfigOpen, setStatusConfigOpen] = useState(false);

  // Calculate date range based on view mode
  const { rangeStart, rangeEnd } = useMemo(() => {
    switch (viewMode) {
      case 'day':
        return { rangeStart: selectedDate, rangeEnd: selectedDate };
      case 'week':
        return {
          rangeStart: startOfWeek(selectedDate, { weekStartsOn: WEEK_STARTS_ON }),
          rangeEnd: endOfWeek(selectedDate, { weekStartsOn: WEEK_STARTS_ON })
        };
      case 'month':
        return {
          rangeStart: startOfMonth(selectedDate),
          rangeEnd: endOfMonth(selectedDate)
        };
    }
  }, [selectedDate, viewMode]);

  // Fetch data
  const { data: closers = [], isLoading: isLoadingClosers } = useActiveR2Closers();
  const { data: allClosers = [], isLoading: isLoadingAllClosers } = useR2ClosersList();
  const { data: meetings = [], isLoading: isLoadingMeetings, refetch: refetchMeetings } = useR2MeetingsExtended(rangeStart, rangeEnd);
  const { data: statusOptions = [] } = useR2StatusOptions();
  const { data: thermometerOptions = [] } = useR2ThermometerOptions();
  const pendingCount = useR2PendingLeadsCount();

  // Filter meetings by closer and status
  const filteredMeetings = useMemo(() => {
    let filtered = meetings;
    if (closerFilter !== 'all') {
      filtered = filtered.filter(m => m.closer?.id === closerFilter);
    }
    if (statusFilter !== 'all') {
      filtered = filtered.filter(m => m.status === statusFilter);
    }
    return filtered;
  }, [meetings, closerFilter, statusFilter]);

  // Filter closers based on filter
  const displayClosers = useMemo(() => {
    if (closerFilter === 'all') return closers;
    return closers.filter(c => c.id === closerFilter);
  }, [closers, closerFilter]);

  // Convert R2Meeting to MeetingSlot for AgendaCalendar compatibility
  const meetingsAsMeetingSlots: MeetingSlot[] = useMemo(() => {
    return filteredMeetings.map((m): MeetingSlot => ({
      id: m.id,
      closer_id: m.closer?.id || '',
      deal_id: m.attendees?.[0]?.deal_id || null,
      contact_id: null,
      scheduled_at: m.scheduled_at,
      duration_minutes: 40,
      status: m.status,
      booked_by: null,
      notes: m.notes,
      closer_notes: null,
      meeting_link: null,
      video_conference_link: null,
      google_event_id: null,
      created_at: m.created_at || '',
      closer: m.closer ? {
        id: m.closer.id,
        name: m.closer.name,
        email: '',
        color: m.closer.color || undefined,
      } : undefined,
      deal: m.attendees?.[0]?.deal ? {
        id: m.attendees[0].deal.id,
        name: m.attendees[0].deal.name || '',
        contact: m.attendees[0].deal.contact ? {
          id: '',
          name: m.attendees[0].deal.contact.name,
          phone: m.attendees[0].deal.contact.phone || null,
          email: m.attendees[0].deal.contact.email || null,
        } : undefined,
      } : undefined,
      attendees: m.attendees?.map(a => ({
        id: a.id,
        deal_id: a.deal_id || null,
        contact_id: null,
        attendee_name: a.name,
        attendee_phone: a.phone || null,
        is_partner: false,
        status: a.status,
        notified_at: null,
        booked_by: null,
        notes: null,
        closer_notes: null,
        already_builds: a.already_builds,
      })),
    }));
  }, [filteredMeetings]);

  // Convert R2Closer to CloserWithAvailability for AgendaCalendar
  const closersWithAvailability: CloserWithAvailability[] = useMemo(() => {
    return displayClosers.map(c => ({
      id: c.id,
      name: c.name,
      email: c.email,
      color: c.color || '#8B5CF6',
      is_active: c.is_active ?? true,
      availability: [],
    }));
  }, [displayClosers]);

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
    refetchMeetings();
  };

  // Meeting handlers
  const handleSelectMeeting = (meeting: R2MeetingRow) => {
    setSelectedMeeting(meeting);
    setMeetingDrawerOpen(true);
  };

  const handleSelectSlot = (closerId: string, date: Date) => {
    setPreselectedCloserId(closerId);
    setPreselectedDate(date);
    setQuickScheduleOpen(true);
  };

  const handleReschedule = (meeting: R2MeetingRow) => {
    setMeetingToReschedule(meeting);
    setMeetingDrawerOpen(false);
    setRescheduleModalOpen(true);
  };

  // Convert R2MeetingRow to R2Meeting for child components
  const meetingsAsR2Meeting = useMemo(() => {
    return meetings.map(m => ({
      ...m,
      attendees: m.attendees.map(a => ({
        ...a,
        deal: a.deal ? { ...a.deal } : null
      }))
    })) as unknown as R2Meeting[];
  }, [meetings]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && !e.ctrlKey) handlePrev();
      if (e.key === 'ArrowRight' && !e.ctrlKey) handleNext();
      if (e.key === 'Escape') {
        setMeetingDrawerOpen(false);
        setQuickScheduleOpen(false);
        setRescheduleModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedDate, viewMode]);

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
          <Button variant="outline" size="sm" onClick={() => setStatusConfigOpen(true)}>
            <Sliders className="h-4 w-4 mr-2" />
            Status/Tags
          </Button>
          <Button variant="outline" size="sm" onClick={() => setAvailabilityConfigOpen(true)}>
            <Settings className="h-4 w-4 mr-2" />
            Closers
          </Button>
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
          <Button size="sm" onClick={() => setQuickScheduleOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Agendar R2
          </Button>
        </div>
      </div>

      {/* Navigation Bar */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        {/* Date Navigation */}
        <div className="flex items-center gap-2">
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

        {/* View Mode & Filters */}
        <div className="flex items-center gap-2">
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

          {/* Closer Filter */}
          <Select value={closerFilter} onValueChange={setCloserFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filtrar closer" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os closers</SelectItem>
              {closers.map((closer) => (
                <SelectItem key={closer.id} value={closer.id}>
                  {closer.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Status Filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="scheduled">Agendadas</SelectItem>
              <SelectItem value="completed">Realizadas</SelectItem>
              <SelectItem value="no_show">No-show</SelectItem>
              <SelectItem value="rescheduled">Reagendadas</SelectItem>
              <SelectItem value="contract_paid">Contrato Pago</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Main Content with Tabs */}
      <Card>
        <CardContent className="pt-4">
          <Tabs defaultValue="calendar">
            <div className="flex items-center justify-between mb-4">
              <TabsList>
                <TabsTrigger value="list" className="gap-2">
                  <List className="h-4 w-4" />
                  Lista
                </TabsTrigger>
                <TabsTrigger value="calendar" className="gap-2">
                  <CalendarIcon className="h-4 w-4" />
                  Calendário
                </TabsTrigger>
                <TabsTrigger value="closer" className="gap-2">
                  <LayoutGrid className="h-4 w-4" />
                  Por Closer
                </TabsTrigger>
                <TabsTrigger value="pending" className="gap-2">
                  <Clock className="h-4 w-4" />
                  Pendentes
                  {pendingCount > 0 && (
                    <Badge variant="destructive" className="h-5 min-w-[20px] px-1.5 text-xs">
                      {pendingCount}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>
              <div className="text-sm text-muted-foreground">
                {meetings.length} reunião(ões)
              </div>
            </div>

            {/* List View - Primary */}
            <TabsContent value="list" className="mt-0">
              <R2ListViewTable
                meetings={meetings}
                statusOptions={statusOptions}
                thermometerOptions={thermometerOptions}
                onSelectMeeting={handleSelectMeeting}
                isLoading={isLoadingMeetings}
              />
            </TabsContent>


            {/* Pending Leads Tab */}
            <TabsContent value="pending" className="mt-0">
              <R2PendingLeadsPanel closers={closersWithAvailability} />
            </TabsContent>

            {/* Calendar View */}
            <TabsContent value="calendar" className="mt-0">
              {isLoadingMeetings || isLoadingClosers ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : (
                <AgendaCalendar
                  meetings={meetingsAsMeetingSlots}
                  selectedDate={selectedDate}
                  closers={closersWithAvailability}
                  closerFilter={closerFilter === 'all' ? null : closerFilter}
                  viewMode={viewMode}
                  meetingType="r2"
                  onSelectMeeting={(meeting) => {
                    const originalMeeting = meetings.find(m => m.id === meeting.id);
                    if (originalMeeting) handleSelectMeeting(originalMeeting);
                  }}
                  onSelectSlot={(day, hour, minute, closerId) => {
                    const selectedDateTime = new Date(day);
                    selectedDateTime.setHours(hour, minute, 0, 0);
                    setPreselectedDate(selectedDateTime);
                    if (closerId) setPreselectedCloserId(closerId);
                    setQuickScheduleOpen(true);
                  }}
                />
              )}
            </TabsContent>

            {/* By Closer View */}
            <TabsContent value="closer" className="mt-0">
              {isLoadingMeetings || isLoadingClosers ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : displayClosers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum closer R2 ativo encontrado.
                </div>
              ) : (
                <R2CloserColumnCalendar
                  meetings={meetingsAsR2Meeting}
                  closers={displayClosers}
                  selectedDate={selectedDate}
                  onSelectMeeting={(m) => {
                    const meeting = meetings.find(mt => mt.id === m.id);
                    if (meeting) handleSelectMeeting(meeting);
                  }}
                  onSelectSlot={handleSelectSlot}
                />
              )}
            </TabsContent>

            {/* List View */}
            <TabsContent value="list" className="mt-0">
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
                        onClick={() => handleSelectMeeting(meeting)}
                        className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-1 h-12 rounded-full bg-purple-500"
                          />
                          <div>
                            <p className="font-medium">
                              {attendee?.name || attendee?.deal?.contact?.name || 'Sem participante'}
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
                                meeting.status === 'scheduled' && 'bg-purple-500/10 text-purple-600 border-purple-500/20',
                                meeting.status === 'rescheduled' && 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
                                meeting.status === 'contract_paid' && 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
                                meeting.status === 'canceled' && 'bg-gray-500/10 text-gray-600 border-gray-500/20'
                              )}
                            >
                              {meeting.status === 'completed' ? 'Realizada' :
                               meeting.status === 'no_show' ? 'No-show' :
                               meeting.status === 'scheduled' ? 'Agendada' :
                               meeting.status === 'rescheduled' ? 'Reagendada' :
                               meeting.status === 'contract_paid' ? 'Contrato Pago' :
                               meeting.status === 'canceled' ? 'Cancelada' :
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
          </Tabs>
        </CardContent>
      </Card>

      {/* Meeting Detail Drawer */}
      <R2MeetingDetailDrawer
        meeting={selectedMeeting}
        statusOptions={statusOptions}
        thermometerOptions={thermometerOptions}
        open={meetingDrawerOpen}
        onOpenChange={setMeetingDrawerOpen}
        onReschedule={handleReschedule}
      />

      {/* Quick Schedule Modal */}
      <R2QuickScheduleModal
        open={quickScheduleOpen}
        onOpenChange={(open) => {
          setQuickScheduleOpen(open);
          if (!open) {
            setPreselectedCloserId(undefined);
            setPreselectedDate(undefined);
          }
        }}
        closers={closers}
        statusOptions={statusOptions}
        thermometerOptions={thermometerOptions}
        preselectedCloserId={preselectedCloserId}
        preselectedDate={preselectedDate}
      />

      {/* Reschedule Modal */}
      <R2RescheduleModal
        meeting={meetingToReschedule as unknown as R2Meeting}
        open={rescheduleModalOpen}
        onOpenChange={setRescheduleModalOpen}
        closers={closers}
        statusOptions={statusOptions}
        thermometerOptions={thermometerOptions}
      />

      {/* R2 Closer Availability Config Modal */}
      <R2CloserAvailabilityConfig
        open={availabilityConfigOpen}
        onOpenChange={setAvailabilityConfigOpen}
        closers={allClosers}
        isLoading={isLoadingAllClosers}
      />

      {/* Status Config Modal */}
      <R2StatusConfigModal
        open={statusConfigOpen}
        onOpenChange={setStatusConfigOpen}
      />
    </div>
  );
}
