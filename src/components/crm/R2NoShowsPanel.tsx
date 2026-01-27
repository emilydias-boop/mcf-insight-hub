import { useState } from 'react';
import { format, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Calendar,
  Phone,
  Mail,
  User,
  Clock,
  Target,
  UserCheck,
  CalendarClock,
  FileText,
  Loader2,
  Users,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DateRange } from 'react-day-picker';
import { useR2NoShowLeads, R2NoShowLead, DateFilterType } from '@/hooks/useR2NoShowLeads';
import { R2RescheduleModal } from './R2RescheduleModal';
import { R2MeetingDetailDrawer } from './R2MeetingDetailDrawer';
import { useR2StatusOptions, useR2ThermometerOptions } from '@/hooks/useR2StatusOptions';
import { R2MeetingSlot, R2CloserWithAvailability } from '@/hooks/useR2AgendaData';
import { cn } from '@/lib/utils';
import { LEAD_PROFILE_OPTIONS, R2MeetingRow } from '@/types/r2Agenda';

interface R2NoShowsPanelProps {
  closers: R2CloserWithAvailability[];
}

function NoShowCard({ 
  lead, 
  onReschedule,
  onClick,
}: { 
  lead: R2NoShowLead; 
  onReschedule: () => void;
  onClick: () => void;
}) {
  const profileLabel = LEAD_PROFILE_OPTIONS.find(p => p.value === lead.lead_profile)?.label || lead.lead_profile;
  
  return (
    <Card className="border-l-4 border-l-destructive hover:shadow-md transition-shadow cursor-pointer" onClick={onClick}>
      <CardContent className="p-4">
        {/* Header: Name + Reschedule Button */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-destructive" />
            <h3 className="font-semibold text-base">{lead.name}</h3>
          </div>
          <Button 
            size="sm" 
            className="bg-primary hover:bg-primary/90 gap-1"
            onClick={(e) => {
              e.stopPropagation();
              onReschedule();
            }}
          >
            <CalendarClock className="h-4 w-4" />
            Reagendar R2
          </Button>
        </div>

        {/* Contact Info */}
        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-3">
          {lead.phone && (
            <a 
              href={`tel:${lead.phone}`} 
              className="flex items-center gap-1 hover:text-foreground"
            >
              <Phone className="h-3.5 w-3.5" />
              {lead.phone}
            </a>
          )}
          {lead.email && (
            <a 
              href={`mailto:${lead.email}`} 
              className="flex items-center gap-1 hover:text-foreground"
            >
              <Mail className="h-3.5 w-3.5" />
              {lead.email}
            </a>
          )}
        </div>

        <Separator className="my-3" />

        {/* R2 Original Info */}
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span>R2 era: </span>
            <span className="font-medium">
              {format(new Date(lead.scheduled_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <span>Sócio R2: </span>
            <Badge 
              variant="outline" 
              className="font-normal"
              style={{ borderColor: lead.closer_color || undefined }}
            >
              {lead.closer_name}
            </Badge>
          </div>
        </div>

        <Separator className="my-3" />

        {/* Funnel History */}
        <div className="space-y-2 text-sm">
          {lead.sdr_name && (
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-primary" />
            <span>SDR: </span>
            <span className="font-medium">{lead.sdr_name}</span>
          </div>
        )}
        {lead.r1_closer_name && (
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-warning" />
            <span>Closer R1: </span>
              <span className="font-medium">{lead.r1_closer_name}</span>
              {lead.r1_date && (
                <span className="text-muted-foreground">
                  ({format(new Date(lead.r1_date), 'dd/MM', { locale: ptBR })})
                </span>
              )}
            </div>
          )}
        </div>

        <Separator className="my-3" />

        {/* Qualification Info */}
        <div className="flex flex-wrap gap-2 text-sm">
          {lead.lead_profile && (
            <Badge variant="secondary" className="gap-1">
              💡 {profileLabel}
            </Badge>
          )}
          {lead.already_builds !== null && (
            <Badge variant={lead.already_builds ? "default" : "outline"} className="gap-1">
              🏗️ {lead.already_builds ? 'Já constrói' : 'Não constrói'}
            </Badge>
          )}
          {lead.deal?.custom_fields?.estado && (
            <Badge variant="outline" className="gap-1">
              📍 {String(lead.deal.custom_fields.estado)}
            </Badge>
          )}
        </div>

        {/* R1 Qualification Note */}
        {lead.r1_qualification_note && (
          <div className="mt-3 p-2 bg-muted/50 rounded-md">
            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
              <FileText className="h-3 w-3" />
              Nota SDR/R1
            </div>
            <p className="text-sm line-clamp-2">{lead.r1_qualification_note}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function R2NoShowsPanel({ closers }: R2NoShowsPanelProps) {
  const [dateFilter, setDateFilter] = useState<DateFilterType>('week');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [customRange, setCustomRange] = useState<{ start: Date; end: Date }>({
    start: subDays(new Date(), 7),
    end: new Date(),
  });
  const [closerFilter, setCloserFilter] = useState<string>('all');
  
  // Reschedule modal state
  const [rescheduleModalOpen, setRescheduleModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<R2NoShowLead | null>(null);
  
  // Detail drawer state
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [selectedMeetingForDrawer, setSelectedMeetingForDrawer] = useState<R2MeetingRow | null>(null);

  const { data: leads = [], isLoading } = useR2NoShowLeads({
    dateFilter,
    selectedDate,
    customRange: dateFilter === 'custom' ? customRange : undefined,
    closerFilter,
  });

  const { data: statusOptions = [] } = useR2StatusOptions();
  const { data: thermometerOptions = [] } = useR2ThermometerOptions();

  // Convert R2NoShowLead to R2MeetingRow for the detail drawer
  const convertToMeetingRow = (lead: R2NoShowLead): R2MeetingRow => ({
    id: lead.meeting_id,
    scheduled_at: lead.scheduled_at,
    status: 'no_show',
    notes: null,
    created_at: lead.scheduled_at,
    meeting_type: 'r2',
    closer: {
      id: lead.closer_id,
      name: lead.closer_name,
      color: lead.closer_color,
    },
    attendees: [{
      id: lead.id,
      deal_id: lead.deal_id,
      name: lead.name,
      phone: lead.phone,
      email: lead.email,
      attendee_name: lead.name,
      attendee_phone: lead.phone,
      status: 'no_show',
      already_builds: lead.already_builds,
      lead_profile: lead.lead_profile,
      partner_name: null,
      video_status: null,
      r2_status_id: null,
      thermometer_ids: [],
      r2_confirmation: null,
      r2_observations: null,
      meeting_link: null,
      updated_by: null,
      updated_at: null,
      r1_qualification_note: lead.r1_qualification_note,
      sales_channel: 'LIVE',
      is_decision_maker: null,
      decision_maker_type: null,
      deal: lead.deal ? {
        id: lead.deal_id || '',
        name: lead.deal.name,
        origin_id: null,
        custom_fields: lead.deal.custom_fields,
        contact: {
          name: lead.name,
          phone: lead.phone || '',
          email: lead.email || '',
          tags: [],
        },
      } : undefined,
    }],
    sdr: lead.sdr_name ? { email: '', name: lead.sdr_name } : undefined,
    r1_closer: lead.r1_closer_name ? {
      id: '',
      name: lead.r1_closer_name,
      scheduled_at: lead.r1_date,
    } : undefined,
    booked_by: undefined,
  });

  const handleOpenDrawer = (lead: R2NoShowLead) => {
    setSelectedMeetingForDrawer(convertToMeetingRow(lead));
    setDetailDrawerOpen(true);
  };

  const handleReschedule = (lead: R2NoShowLead) => {
    setSelectedLead(lead);
    setRescheduleModalOpen(true);
  };
  
  const handleRescheduleFromDrawer = (meeting: R2MeetingRow) => {
    // Find the original lead to pass to reschedule modal
    const originalLead = leads.find(l => l.meeting_id === meeting.id);
    if (originalLead) {
      setSelectedLead(originalLead);
      setRescheduleModalOpen(true);
      setDetailDrawerOpen(false);
    }
  };

  // Convert R2NoShowLead to R2MeetingSlot for the modal
  const selectedMeetingSlot: R2MeetingSlot | null = selectedLead ? {
    id: selectedLead.meeting_id,
    scheduled_at: selectedLead.scheduled_at,
    status: 'no_show',
    notes: null,
    created_at: new Date().toISOString(),
    meeting_type: 'r2',
    closer: {
      id: selectedLead.closer_id,
      name: selectedLead.closer_name,
      color: selectedLead.closer_color,
    },
    attendees: [{
      id: selectedLead.id,
      deal_id: selectedLead.deal_id,
      name: selectedLead.name,
      phone: selectedLead.phone,
      email: selectedLead.email,
      status: 'no_show',
      already_builds: selectedLead.already_builds,
      lead_profile: selectedLead.lead_profile,
      deal: selectedLead.deal ? {
        id: selectedLead.deal_id || '',
        name: selectedLead.deal.name,
        contact: {
          name: selectedLead.name,
          phone: selectedLead.phone || '',
          email: selectedLead.email || '',
          tags: [],
        },
      } : undefined,
    }],
  } : null;

  // Date range display
  const getDateRangeLabel = () => {
    switch (dateFilter) {
      case 'day':
        return format(selectedDate, "dd 'de' MMMM", { locale: ptBR });
      case 'week':
        return 'Esta semana';
      case 'month':
        return format(selectedDate, "MMMM 'de' yyyy", { locale: ptBR });
      case 'custom':
        return `${format(customRange.start, 'dd/MM')} - ${format(customRange.end, 'dd/MM')}`;
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 p-4 bg-muted/30 rounded-lg">
        {/* Date Filter Type */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Período:</span>
          <div className="flex items-center border rounded-md">
            {(['day', 'week', 'month'] as DateFilterType[]).map((type) => (
              <Button
                key={type}
                variant={dateFilter === type ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setDateFilter(type)}
                className="rounded-none first:rounded-l-md last:rounded-r-md"
              >
                {type === 'day' ? 'Dia' : type === 'week' ? 'Semana' : 'Mês'}
              </Button>
            ))}
          </div>
        </div>

        {/* Custom Date Range */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={dateFilter === 'custom' ? 'secondary' : 'outline'}
              size="sm"
              className="gap-1"
              onClick={() => setDateFilter('custom')}
            >
              <Calendar className="h-4 w-4" />
              Personalizado
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <CalendarComponent
              mode="range"
              selected={{ from: customRange.start, to: customRange.end }}
              onSelect={(range: DateRange | undefined) => {
                if (range?.from) {
                  setCustomRange({
                    start: range.from,
                    end: range.to || range.from,
                  });
                  setDateFilter('custom');
                }
              }}
              locale={ptBR}
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>

        {/* Closer Filter */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Sócio R2:</span>
          <Select value={closerFilter} onValueChange={setCloserFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Todos os sócios" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os sócios</SelectItem>
              {closers.map((closer) => (
                <SelectItem key={closer.id} value={closer.id}>
                  {closer.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Results Count */}
        <div className="ml-auto text-sm text-muted-foreground">
          Mostrando <span className="font-medium text-foreground">{leads.length}</span> no-shows
          {' '}de {getDateRangeLabel()}
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="border-l-4 border-l-muted">
              <CardContent className="p-4 space-y-3">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && leads.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Users className="h-12 w-12 mb-4 opacity-50" />
          <p className="text-lg font-medium">Nenhum no-show encontrado</p>
          <p className="text-sm">Tente ajustar os filtros de data ou sócio</p>
        </div>
      )}

      {/* No-Show Cards Grid */}
      {!isLoading && leads.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {leads.map((lead) => (
            <NoShowCard
              key={lead.id}
              lead={lead}
              onReschedule={() => handleReschedule(lead)}
              onClick={() => handleOpenDrawer(lead)}
            />
          ))}
        </div>
      )}

      {/* Detail Drawer */}
      <R2MeetingDetailDrawer
        meeting={selectedMeetingForDrawer}
        statusOptions={statusOptions}
        thermometerOptions={thermometerOptions}
        open={detailDrawerOpen}
        onOpenChange={setDetailDrawerOpen}
        onReschedule={handleRescheduleFromDrawer}
      />

      {/* Reschedule Modal */}
      <R2RescheduleModal
        meeting={selectedMeetingSlot}
        open={rescheduleModalOpen}
        onOpenChange={setRescheduleModalOpen}
        closers={closers}
        statusOptions={statusOptions}
        thermometerOptions={thermometerOptions}
      />
    </div>
  );
}
