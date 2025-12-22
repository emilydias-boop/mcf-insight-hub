import { useState, useMemo } from 'react';
import { format, addWeeks, subWeeks, startOfWeek, endOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarDays, ChevronLeft, ChevronRight, Settings, Users, CheckCircle, XCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { AgendaCalendar } from '@/components/crm/AgendaCalendar';
import { MeetingsList } from '@/components/crm/MeetingsList';
import { CloserAvailabilityConfig } from '@/components/crm/CloserAvailabilityConfig';
import { useAgendaMeetings, useAgendaStats, useClosersWithAvailability, MeetingSlot } from '@/hooks/useAgendaData';
import { useNavigate } from 'react-router-dom';

export default function Agenda() {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [closerFilter, setCloserFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [configOpen, setConfigOpen] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<MeetingSlot | null>(null);

  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 });

  const { data: meetings = [], isLoading: meetingsLoading, refetch } = useAgendaMeetings(weekStart, weekEnd);
  const { data: stats, isLoading: statsLoading } = useAgendaStats(selectedDate);
  const { data: closers = [], isLoading: closersLoading } = useClosersWithAvailability();

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

  const handlePrevWeek = () => setSelectedDate(subWeeks(selectedDate, 1));
  const handleNextWeek = () => setSelectedDate(addWeeks(selectedDate, 1));
  const handleToday = () => setSelectedDate(new Date());

  const handleViewDeal = (dealId: string) => {
    navigate(`/crm/negocios?deal=${dealId}`);
  };

  return (
    <div className="space-y-6">
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
            Configurar Disponibilidade
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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
                  {closer.name}
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

      {/* Main Content */}
      <Tabs defaultValue="calendar" className="w-full">
        <TabsList>
          <TabsTrigger value="calendar">Calendário</TabsTrigger>
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

      {/* Config Dialog */}
      <CloserAvailabilityConfig
        open={configOpen}
        onOpenChange={setConfigOpen}
        closers={closers}
        isLoading={closersLoading}
      />
    </div>
  );
}
