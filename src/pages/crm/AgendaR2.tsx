import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  addDays,
  subDays,
  addWeeks,
  subWeeks,
  addMonths,
  subMonths,
  isSameDay,
} from "date-fns";
import { getWeekStartsOn } from "@/lib/businessDays";
import { ptBR } from "date-fns/locale";
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
  Sliders,
  AlertCircle,
  FileText,
  Download,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useR2MeetingsExtended } from "@/hooks/useR2MeetingsExtended";
import { useActiveR2Closers, useR2ClosersList } from "@/hooks/useR2Closers";
import { useGestorClosers } from "@/hooks/useGestorClosers";
import { useR2StatusOptions, useR2ThermometerOptions } from "@/hooks/useR2StatusOptions";
import { R2CloserColumnCalendar } from "@/components/crm/R2CloserColumnCalendar";
import { AgendaCalendar } from "@/components/crm/AgendaCalendar";
import { MeetingSlot, CloserWithAvailability } from "@/hooks/useAgendaData";
import { R2MeetingDetailDrawer } from "@/components/crm/R2MeetingDetailDrawer";
import { R2QuickScheduleModal } from "@/components/crm/R2QuickScheduleModal";
import { R2CloserAvailabilityConfig } from "@/components/crm/R2CloserAvailabilityConfig";
import { R2PendingLeadsPanel } from "@/components/crm/R2PendingLeadsPanel";
import { R2NoShowsPanel } from "@/components/crm/R2NoShowsPanel";
import { R2ListViewTable } from "@/components/crm/R2ListViewTable";
import { R2StatusConfigModal } from "@/components/crm/R2StatusConfigModal";
import { R2QualificationReportPanel } from "@/components/crm/R2QualificationReportPanel";
import { useR2PendingLeadsCount } from "@/hooks/useR2PendingLeads";
import { useR2NoShowsCount } from "@/hooks/useR2NoShowLeads";
import { R2RescheduleModal } from "@/components/crm/R2RescheduleModal";
import { R2MeetingRow } from "@/types/r2Agenda";
import { R2Meeting } from "@/hooks/useR2AgendaMeetings";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useR2DailySlotsForView } from "@/hooks/useR2DailySlotsForView";
import { R2CloserWithAvailability } from "@/hooks/useR2AgendaData";
import { useMyR2Closer } from "@/hooks/useMyR2Closer";
import { useAuth } from "@/contexts/AuthContext";
import { useActiveBU } from "@/hooks/useActiveBU";

type ViewMode = "day" | "week" | "month";

export default function AgendaR2() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("day");
  const [closerFilter, setCloserFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [r1CloserFilter, setR1CloserFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Determine initial tab from URL
  const urlTab = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(urlTab === 'noshows' ? 'noshows' : 'calendar');

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

  // Auth e closer R2 do usuário logado
  const { role, allRoles } = useAuth();
  const { data: myR2Closer, isLoading: isLoadingMyR2Closer } = useMyR2Closer();
  const activeBU = useActiveBU();
  
  // Verifica se usuário é closer R2 puro (não tem outras roles privilegiadas)
  const isR2Closer = !!myR2Closer?.id && role === 'closer' && !allRoles.includes('sdr') && !allRoles.includes('admin') && !allRoles.includes('manager') && !allRoles.includes('coordenador');

  // Handle URL param changes
  useEffect(() => {
    if (urlTab === 'noshows') {
      setActiveTab('noshows');
    }
  }, [urlTab]);

  // Calculate date range based on view mode
  const { rangeStart, rangeEnd } = useMemo(() => {
    switch (viewMode) {
      case "day":
        return { rangeStart: selectedDate, rangeEnd: selectedDate };
      case "week": {
        const wso = getWeekStartsOn(activeBU);
        return {
          rangeStart: startOfWeek(selectedDate, { weekStartsOn: wso }),
          rangeEnd: endOfWeek(selectedDate, { weekStartsOn: wso }),
        };
      }
      case "month":
        return {
          rangeStart: startOfMonth(selectedDate),
          rangeEnd: endOfMonth(selectedDate),
        };
    }
  }, [selectedDate, viewMode]);

  // Fetch data - passar filtro de BU para closers
  const { data: closers = [], isLoading: isLoadingClosers } = useActiveR2Closers(activeBU);
  const { data: allClosers = [], isLoading: isLoadingAllClosers } = useR2ClosersList(activeBU);
  const {
    data: meetings = [],
    isLoading: isLoadingMeetings,
    refetch: refetchMeetings,
  } = useR2MeetingsExtended(rangeStart, rangeEnd);
  const { data: statusOptions = [] } = useR2StatusOptions();
  const { data: thermometerOptions = [] } = useR2ThermometerOptions();
  const { data: r1Closers = [] } = useGestorClosers('r1');
  const pendingCount = useR2PendingLeadsCount();
  const { data: noShowCount = 0 } = useR2NoShowsCount();

  // Fetch R2 configured slots for the "Por Closer" view
  const closerIds = useMemo(() => closers.map((c) => c.id), [closers]);
  const { data: r2ConfiguredSlotsMap } = useR2DailySlotsForView(rangeStart, rangeEnd, closerIds);

  // Filter meetings by closer and status, then consolidate meetings with same closer+time
  const filteredMeetings = useMemo(() => {
    let filtered = meetings;
    
    // Se é closer R2, mostrar apenas suas próprias reuniões ("Minha Agenda")
    if (isR2Closer && myR2Closer?.id) {
      filtered = filtered.filter((m) => m.closer?.id === myR2Closer.id);
    } else if (closerFilter !== "all") {
      // Filtro manual de closer (para admins/managers)
      filtered = filtered.filter((m) => m.closer?.id === closerFilter);
    }
    
    if (statusFilter !== "all") {
      filtered = filtered.filter((m) => m.status === statusFilter);
    }

    // Filtro por closer R1
    if (r1CloserFilter !== "all") {
      filtered = filtered.filter((m) => m.r1_closer?.id === r1CloserFilter);
    }

    // Filtro por nome/email/telefone
    if (searchTerm.length >= 2) {
      const search = searchTerm.toLowerCase();
      const searchDigits = searchTerm.replace(/\D/g, '');
      
      filtered = filtered.filter((m) => 
        m.attendees?.some(att => {
          const name = (att.name || att.deal?.contact?.name || att.deal?.name || '').toLowerCase();
          const phone = (att.phone || att.deal?.contact?.phone || '').replace(/\D/g, '');
          const email = (att.deal?.contact?.email || '').toLowerCase();
          
          return name.includes(search) || 
                 email.includes(search) ||
                 (searchDigits.length > 0 && phone.includes(searchDigits));
        })
      );
    }

    // Group meetings by closer_id + scheduled_at to consolidate attendees
    const groups: Record<string, typeof filtered> = {};
    filtered.forEach((m) => {
      const key = `${m.closer?.id}|${m.scheduled_at}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(m);
    });
    
    // Consolidate each group into a single meeting with all attendees
    return Object.values(groups).map((group) => ({
      ...group[0],
      attendees: group.flatMap((m) => m.attendees || []),
    }));
  }, [meetings, closerFilter, statusFilter, r1CloserFilter, isR2Closer, myR2Closer?.id, searchTerm]);

  // Filter closers based on filter (ou mostrar apenas o próprio closer se for R2 closer)
  const displayClosers = useMemo(() => {
    if (isR2Closer && myR2Closer?.id) {
      return closers.filter((c) => c.id === myR2Closer.id);
    }
    if (closerFilter === "all") return closers;
    return closers.filter((c) => c.id === closerFilter);
  }, [closers, closerFilter, isR2Closer, myR2Closer?.id]);

  // Convert R2Meeting to MeetingSlot for AgendaCalendar compatibility
  const meetingsAsMeetingSlots: MeetingSlot[] = useMemo(() => {
    return filteredMeetings.map(
      (m): MeetingSlot => ({
        id: m.id,
        closer_id: m.closer?.id || "",
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
        created_at: m.created_at || "",
        closer: m.closer
          ? {
              id: m.closer.id,
              name: m.closer.name,
              email: "",
              color: m.closer.color || undefined,
            }
          : undefined,
        deal: m.attendees?.[0]?.deal
          ? {
              id: m.attendees[0].deal.id,
              name: m.attendees[0].deal.name || "",
              contact: m.attendees[0].deal.contact
                ? {
                    id: "",
                    name: m.attendees[0].deal.contact.name,
                    phone: m.attendees[0].deal.contact.phone || null,
                    email: m.attendees[0].deal.contact.email || null,
                  }
                : undefined,
            }
          : undefined,
        attendees: m.attendees?.map((a) => ({
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
      }),
    );
  }, [filteredMeetings]);

  // Convert R2Closer to CloserWithAvailability for AgendaCalendar
  const closersWithAvailability: CloserWithAvailability[] = useMemo(() => {
    return displayClosers.map((c) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      color: c.color || "#8B5CF6",
      is_active: c.is_active ?? true,
      meeting_duration_minutes: 45,
      max_leads_per_slot: 4,
      availability: [],
    }));
  }, [displayClosers]);

  // Convert closers for R2NoShowsPanel (uses R2CloserWithAvailability type)
  const closersAsR2CloserWithAvailability: R2CloserWithAvailability[] = useMemo(() => {
    return closers.map((c) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      color: c.color || "#8B5CF6",
      is_active: c.is_active ?? true,
    }));
  }, [closers]);

  // Navigation handlers
  const handlePrev = () => {
    switch (viewMode) {
      case "day":
        setSelectedDate(subDays(selectedDate, 1));
        break;
      case "week":
        setSelectedDate(subWeeks(selectedDate, 1));
        break;
      case "month":
        setSelectedDate(subMonths(selectedDate, 1));
        break;
    }
  };

  const handleNext = () => {
    switch (viewMode) {
      case "day":
        setSelectedDate(addDays(selectedDate, 1));
        break;
      case "week":
        setSelectedDate(addWeeks(selectedDate, 1));
        break;
      case "month":
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

  // Export list handler for Bruna (names + phones)
  const handleExportList = () => {
    const headers = ['Nome', 'Telefone', 'Closer', 'Data/Hora', 'Status'];
    const rows = filteredMeetings.flatMap(m => {
      return (m.attendees || []).map(att => [
        att.name || att.deal?.contact?.name || 'Sem nome',
        att.phone || att.deal?.contact?.phone || '-',
        m.closer?.name || '-',
        format(new Date(m.scheduled_at), 'dd/MM HH:mm', { locale: ptBR }),
        att.status === 'completed' ? 'Realizada' :
        att.status === 'no_show' ? 'No-show' :
        att.status === 'invited' ? 'Agendada' : att.status
      ]);
    });

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `agenda-r2-${format(rangeStart, 'dd-MM-yyyy', { locale: ptBR })}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  // Convert R2MeetingRow to R2Meeting for child components (use filteredMeetings for consolidation)
  const meetingsAsR2Meeting = useMemo(() => {
    return filteredMeetings.map((m) => ({
      ...m,
      attendees: m.attendees.map((a) => ({
        ...a,
        deal: a.deal ? { ...a.deal } : null,
      })),
    })) as unknown as R2Meeting[];
  }, [filteredMeetings]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" && !e.ctrlKey) handlePrev();
      if (e.key === "ArrowRight" && !e.ctrlKey) handleNext();
      if (e.key === "Escape") {
        setMeetingDrawerOpen(false);
        setQuickScheduleOpen(false);
        setRescheduleModalOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedDate, viewMode]);

  // Format date range display
  const dateRangeDisplay = useMemo(() => {
    switch (viewMode) {
      case "day":
        return format(selectedDate, "EEEE, d 'de' MMMM", { locale: ptBR });
      case "week":
        return `${format(rangeStart, "d 'de' MMM", { locale: ptBR })} - ${format(rangeEnd, "d 'de' MMM", { locale: ptBR })}`;
      case "month":
        return format(selectedDate, "MMMM 'de' yyyy", { locale: ptBR });
    }
  }, [selectedDate, viewMode, rangeStart, rangeEnd]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">
            {isR2Closer ? 'Minha Agenda R2' : 'Agenda R2'}
          </h1>
          <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-500/20">
            {isR2Closer ? myR2Closer?.name : 'Reunião 02'}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {/* Mostrar botões de config apenas para não-closers */}
          {!isR2Closer && (
            <>
              <Button variant="outline" size="sm" onClick={() => setStatusConfigOpen(true)}>
                <Sliders className="h-4 w-4 mr-2" />
                Status/Tags
              </Button>
              <Button variant="outline" size="sm" onClick={() => setAvailabilityConfigOpen(true)}>
                <Settings className="h-4 w-4 mr-2" />
                Closers
              </Button>
            </>
          )}
          <Button variant="outline" size="sm" onClick={() => handleExportList()}>
            <Download className="h-4 w-4 mr-2" />
            Exportar Lista
          </Button>
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
          {!isR2Closer && (
            <Button size="sm" onClick={() => setQuickScheduleOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Agendar R2
            </Button>
          )}
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
        <div className="flex items-center gap-2 flex-wrap">
          {/* View Mode Toggle */}
          <div className="flex items-center border rounded-md">
            {(["day", "week", "month"] as ViewMode[]).map((mode) => (
              <Button
                key={mode}
                variant={viewMode === mode ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode(mode)}
                className="rounded-none first:rounded-l-md last:rounded-r-md"
              >
                {mode === "day" ? "Dia" : mode === "week" ? "Semana" : "Mês"}
              </Button>
            ))}
          </div>

          {/* Search Filter */}
          <div className="relative w-[200px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar lead..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9"
            />
          </div>

          {/* Closer Filter - escondido para closers R2 (eles veem apenas sua agenda) */}
          {!isR2Closer && (
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
          )}

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

          {/* R1 Closer Filter - escondido para closers R2 */}
          {!isR2Closer && (
            <Select value={r1CloserFilter} onValueChange={setR1CloserFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Closer R1" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Closers R1</SelectItem>
                {r1Closers.map((closer) => (
                  <SelectItem key={closer.id} value={closer.id}>
                    {closer.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Main Content with Tabs */}
      <Card>
        <CardContent className="pt-4">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
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
                  Por Sócio
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
                <TabsTrigger value="noshows" className="gap-2">
                  <AlertCircle className="h-4 w-4" />
                  No-Shows
                  {noShowCount > 0 && (
                    <Badge variant="outline" className="h-5 min-w-[20px] px-1.5 text-xs bg-destructive/10 text-destructive border-destructive/20">
                      {noShowCount}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="report" className="gap-2">
                  <FileText className="h-4 w-4" />
                  Relatório
                </TabsTrigger>
              </TabsList>
              <div className="text-sm text-muted-foreground">{meetings.length} reunião(ões)</div>
            </div>

            {/* List View - Primary */}
            <TabsContent value="list" className="mt-0">
              <R2ListViewTable
                meetings={filteredMeetings}
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

            {/* No-Shows Tab */}
            <TabsContent value="noshows" className="mt-0">
              <R2NoShowsPanel closers={closersAsR2CloserWithAvailability} />
            </TabsContent>

            {/* Report Tab */}
            <TabsContent value="report" className="mt-0">
              <R2QualificationReportPanel />
            </TabsContent>
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
                  closerFilter={closerFilter === "all" ? null : closerFilter}
                  viewMode={viewMode}
                  meetingType="r2"
                onSelectMeeting={(meeting) => {
                    // Buscar no array consolidado por closer+horário
                    const consolidatedMeeting = filteredMeetings.find(
                      (m) => m.closer?.id === meeting.closer_id && m.scheduled_at === meeting.scheduled_at
                    );
                    if (consolidatedMeeting) handleSelectMeeting(consolidatedMeeting);
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
                <div className="text-center py-8 text-muted-foreground">Nenhum closer R2 ativo encontrado.</div>
              ) : (
                <R2CloserColumnCalendar
                  meetings={meetingsAsR2Meeting}
                  closers={displayClosers}
                  selectedDate={selectedDate}
                  configuredSlotsMap={r2ConfiguredSlotsMap}
                  onSelectMeeting={(m) => {
                    // Buscar no array consolidado por closer+horário
                    const consolidatedMeeting = filteredMeetings.find(
                      (mt) => mt.closer?.id === m.closer?.id && mt.scheduled_at === m.scheduled_at
                    );
                    if (consolidatedMeeting) handleSelectMeeting(consolidatedMeeting);
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
                    const attendeesCount = meeting.attendees?.length || 0;
                    const firstAttendee = meeting.attendees?.[0];
                    return (
                      <div
                        key={`${meeting.id}-${meeting.scheduled_at}`}
                        onClick={() => handleSelectMeeting(meeting)}
                        className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-1 h-12 rounded-full bg-primary" />
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium">
                                {firstAttendee?.name || firstAttendee?.deal?.contact?.name || "Sem participante"}
                              </p>
                              {attendeesCount > 1 && (
                                <Badge variant="secondary" className="text-xs">
                                  +{attendeesCount - 1}
                                </Badge>
                              )}
                            </div>
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
                                meeting.status === "completed" && "bg-green-500/10 text-green-600 border-green-500/20",
                                meeting.status === "no_show" && "bg-red-500/10 text-red-600 border-red-500/20",
                                meeting.status === "scheduled" &&
                                  "bg-purple-500/10 text-purple-600 border-purple-500/20",
                                meeting.status === "rescheduled" &&
                                  "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
                                meeting.status === "contract_paid" &&
                                  "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
                                meeting.status === "canceled" && "bg-gray-500/10 text-gray-600 border-gray-500/20",
                              )}
                            >
                              {meeting.status === "completed"
                                ? "Realizada"
                                : meeting.status === "no_show"
                                  ? "No-show"
                                  : meeting.status === "scheduled"
                                    ? "Agendada"
                                    : meeting.status === "rescheduled"
                                      ? "Reagendada"
                                      : meeting.status === "contract_paid"
                                        ? "Contrato Pago"
                                        : meeting.status === "canceled"
                                          ? "Cancelada"
                                          : meeting.status}
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
      <R2StatusConfigModal open={statusConfigOpen} onOpenChange={setStatusConfigOpen} />
    </div>
  );
}
