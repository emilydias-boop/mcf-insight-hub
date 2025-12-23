import { useState, useMemo } from 'react';
import { format, addWeeks, subWeeks, startOfWeek, endOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarDays, ChevronLeft, ChevronRight, Settings, Users, CheckCircle, XCircle, AlertTriangle, RefreshCw, Plus, Columns3, Percent } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { AgendaCalendar } from '@/components/crm/AgendaCalendar';
import { MeetingsList } from '@/components/crm/MeetingsList';
import { CloserAvailabilityConfig } from '@/components/crm/CloserAvailabilityConfig';
import { CloserColumnCalendar } from '@/components/crm/CloserColumnCalendar';
import { UpcomingMeetingsSidebar } from '@/components/crm/UpcomingMeetingsSidebar';
import { AgendaMeetingDrawer } from '@/components/crm/AgendaMeetingDrawer';
import { QuickScheduleModal } from '@/components/crm/QuickScheduleModal';
import { RescheduleModal } from '@/components/crm/RescheduleModal';
import { useAgendaMeetings, useAgendaStats, useClosersWithAvailability, useBlockedDates, useCloserMetrics, MeetingSlot } from '@/hooks/useAgendaData';
import { useNavigate } from 'react-router-dom';

export default function Agenda() {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [closerFilter, setCloserFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [configOpen, setConfigOpen] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<MeetingSlot | null>(null);
  const [quickScheduleOpen, setQuickScheduleOpen] = useState(false);
  const [rescheduleModalOpen, setRescheduleModalOpen] = useState(false);
  const [meetingToReschedule, setMeetingToReschedule] = useState<MeetingSlot | null>(null);
  const [preselectedCloserId, setPreselectedCloserId] = useState<string | undefined>();
  const [preselectedDate, setPreselectedDate] = useState<Date | undefined>();

  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 });

  const { data: meetings = [], isLoading: meetingsLoading, refetch } = useAgendaMeetings(weekStart, weekEnd);
  const { data: stats, isLoading: statsLoading } = useAgendaStats(selectedDate);
  const { data: closers = [], isLoading: closersLoading } = useClosersWithAvailability();
  const { data: blockedDates = [] } = useBlockedDates();
  const { data: closerMetrics = [], isLoading: metricsLoading } = useCloserMetrics(selectedDate);

  const filteredMeetings = useMemo(() => {
    let result = meetings;
    if (closerFilter) {
      result = result.filter(m => m.closer_id === closerFilter);
    }
    if (statusFilter) {
      result = result.filter(m => m.status === statusFilter);
    }
    return result;
  }, [meetings, closerFilter, statusFilter]);

  // Calculate occupancy per closer
  const closerOccupancy = useMemo(() => {
    return closers.map(closer => {
      const closerMeetings = meetings.filter(m => m.closer_id === closer.id && ['scheduled', 'rescheduled'].includes(m.status));
      const totalSlots = 20; // 10 hours x 2 slots per hour
      const occupancy = Math.round((closerMeetings.length / totalSlots) * 100);
      return { ...closer, meetingsCount: closerMeetings.length, occupancy: Math.min(occupancy, 100) };
    });
  }, [closers, meetings]);

  const handlePrevWeek = () => setSelectedDate(subWeeks(selectedDate, 1));
  const handleNextWeek = () => setSelectedDate(addWeeks(selectedDate, 1));
  const handleToday = () => setSelectedDate(new Date());

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

  return (
    <div className="flex gap-6">
      {/* Main Content */}
      <div className="flex-1 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CalendarDays className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Agenda dos Closers</h1>
              <p className="text-sm text-muted-foreground">
                Gerencie reuniões e disponibilidade
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button variant="outline" onClick={() => setConfigOpen(true)}>
              <Settings className="h-4 w-4 mr-2" />
              Configurar
            </Button>
            <Button onClick={() => setQuickScheduleOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Agendar
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Hoje</CardTitle>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold">{stats?.totalMeetingsToday || 0}</div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Semana</CardTitle>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold">{stats?.totalMeetingsWeek || 0}</div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-1">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Realizadas
              </CardTitle>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold text-green-600">{stats?.completedMeetings || 0}</div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-1">
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                No-show
              </CardTitle>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold text-yellow-600">{stats?.noShowMeetings || 0}</div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-1">
                <XCircle className="h-4 w-4 text-red-500" />
                Canceladas
              </CardTitle>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold text-red-600">{stats?.canceledMeetings || 0}</div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-1">
                <Percent className="h-4 w-4 text-primary" />
                Ocupação
              </CardTitle>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold text-primary">
                  {closerOccupancy.length > 0
                    ? Math.round(closerOccupancy.reduce((acc, c) => acc + c.occupancy, 0) / closerOccupancy.length)
                    : 0}%
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Filters and Navigation */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={handlePrevWeek}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" onClick={handleToday}>
              Hoje
            </Button>
            <Button variant="outline" size="icon" onClick={handleNextWeek}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium ml-2">
              {format(weekStart, "dd MMM", { locale: ptBR })} - {format(weekEnd, "dd MMM yyyy", { locale: ptBR })}
            </span>
          </div>

          <div className="flex items-center gap-2">
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
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="calendar" className="w-full">
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
              <Skeleton className="h-[500px] w-full" />
            ) : (
              <AgendaCalendar
                meetings={filteredMeetings}
                selectedDate={selectedDate}
                onSelectMeeting={setSelectedMeeting}
                closerFilter={closerFilter}
                closers={closers}
              />
            )}
          </TabsContent>

          <TabsContent value="closers" className="mt-4">
            {meetingsLoading || closersLoading ? (
              <Skeleton className="h-[500px] w-full" />
            ) : (
              <CloserColumnCalendar
                meetings={filteredMeetings}
                closers={closers}
                blockedDates={blockedDates}
                selectedDate={selectedDate}
                onSelectMeeting={setSelectedMeeting}
                onSelectSlot={handleSelectSlot}
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
      </div>

      {/* Sidebar */}
      <div className="hidden xl:block w-80 space-y-4">
        <UpcomingMeetingsSidebar
          selectedDate={selectedDate}
          metrics={closerMetrics}
          metricsLoading={metricsLoading}
          onSelectMeeting={setSelectedMeeting}
        />

        {/* Occupancy by Closer */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Ocupação por Closer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {closersLoading ? (
              <>
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </>
            ) : (
              closerOccupancy.map(closer => (
                <div key={closer.id} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: closer.color || '#6B7280' }}
                      />
                      <span>{closer.name}</span>
                    </div>
                    <span className="text-muted-foreground">{closer.occupancy}%</span>
                  </div>
                  <Progress value={closer.occupancy} className="h-1.5" />
                </div>
              ))
            )}
          </CardContent>
        </Card>
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
        open={!!selectedMeeting}
        onOpenChange={(open) => !open && setSelectedMeeting(null)}
        onReschedule={handleReschedule}
      />

      {/* Quick Schedule Modal */}
      <QuickScheduleModal
        open={quickScheduleOpen}
        onOpenChange={handleQuickScheduleClose}
        closers={closers}
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
          closers={closers}
        />
      )}
    </div>
  );
}
