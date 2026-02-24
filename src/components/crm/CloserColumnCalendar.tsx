import { useMemo, useRef, useEffect } from "react";
import { format, parseISO, isSameDay, setHours, setMinutes, isAfter } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Settings, Plus, ArrowRightLeft, DollarSign, UserCircle, UserPlus } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { MeetingSlot, CloserWithAvailability, BlockedDate } from "@/hooks/useAgendaData";
import { cn } from "@/lib/utils";
import { useCloserDaySlots } from "@/hooks/useCloserMeetingLinks";
import { useOutsideDetectionBatch } from "@/hooks/useOutsideDetection";
import { usePartnerProductDetectionBatch } from "@/hooks/usePartnerProductDetection";
import { useBUContext } from "@/contexts/BUContext";

interface CloserColumnCalendarProps {
  meetings: MeetingSlot[];
  closers: CloserWithAvailability[];
  blockedDates: BlockedDate[];
  selectedDate: Date;
  onSelectMeeting: (meeting: MeetingSlot) => void;
  onSelectSlot: (closerId: string, date: Date) => void;
  onAddToMeeting?: (closerId: string, date: Date) => void;
  onEditHours?: () => void;
}

const STATUS_STYLES: Record<string, string> = {
  scheduled: "bg-primary/70 hover:bg-primary/80",
  rescheduled: "bg-yellow-500/90 hover:bg-yellow-500",
  completed: "bg-green-500/80 hover:bg-green-500",
  no_show: "bg-red-500/80 hover:bg-red-500",
  canceled: "bg-muted/60 line-through",
  contract_paid: "bg-emerald-600/90 hover:bg-emerald-600",
};

const ATTENDEE_STATUS_CONFIG: Record<
  string,
  {
    label: string;
    shortLabel: string;
    bgClass: string;
    variant: "default" | "destructive" | "outline" | "secondary";
  }
> = {
  invited: {
    label: "Agendado",
    shortLabel: "Agend.",
    bgClass: "bg-blue-600/80",
    variant: "outline",
  },
  completed: {
    label: "Compareceu",
    shortLabel: "OK",
    bgClass: "bg-green-600/80",
    variant: "default",
  },
  no_show: {
    label: "No-show",
    shortLabel: "NS",
    bgClass: "bg-red-600/80",
    variant: "destructive",
  },
  contract_paid: {
    label: "Contrato Pago",
    shortLabel: "Contrato",
    bgClass: "bg-emerald-600/80",
    variant: "default",
  },
  rescheduled: {
    label: "Reagendado",
    shortLabel: "Reag.",
    bgClass: "bg-yellow-600/80",
    variant: "secondary",
  },
};

// Helper to get initials from full name
const getInitials = (name: string): string => {
  return name
    .split(' ')
    .filter(word => word.length > 0)
    .slice(0, 2)
    .map(word => word[0].toUpperCase())
    .join('');
};

export function CloserColumnCalendar({
  meetings,
  closers,
  blockedDates,
  selectedDate,
  onSelectMeeting,
  onSelectSlot,
  onAddToMeeting,
  onEditHours,
}: CloserColumnCalendarProps) {
  const dayOfWeek = selectedDate.getDay();

  const { activeBU } = useBUContext();

  // Buscar horários reais configurados em closer_meeting_links (apenas R1)
  const { data: daySlots = [] } = useCloserDaySlots(dayOfWeek, 'r1');

  // Filtrar closers que têm slot configurado ou reunião agendada neste dia
  const visibleClosers = useMemo(() => {
    return closers.filter(closer => {
      const hasConfiguredSlot = daySlots.some(s => s.closer_id === closer.id);
      const hasMeeting = meetings.some(m => m.closer_id === closer.id);
      return hasConfiguredSlot || hasMeeting;
    });
  }, [closers, daySlots, meetings]);

  // Coletar todos os attendees para detecção batch de Outside
  const attendeesForOutsideCheck = useMemo(() => {
    return meetings.flatMap(m => 
      m.attendees?.map(att => ({
        id: att.id,
        email: att.contact?.email || null,
        meetingDate: m.scheduled_at
      })) || []
    );
  }, [meetings]);

  // Hook para detectar leads Outside (compraram contrato antes da reunião)
  const { data: outsideData = {} } = useOutsideDetectionBatch(attendeesForOutsideCheck);

  // Hook para detectar produtos de parceiro (BU Consórcio)
  const attendeesForPartnerCheck = useMemo(() => {
    if (activeBU !== 'consorcio') return [];
    return meetings.flatMap(m => 
      m.attendees?.map(att => ({
        id: att.id,
        email: att.contact?.email || null,
      })) || []
    );
  }, [meetings, activeBU]);

  const { data: partnerData = {} } = usePartnerProductDetectionBatch(attendeesForPartnerCheck);
  const timeSlots = useMemo(() => {
    // Horários dos slots configurados
    const configuredTimes = daySlots.map((s) => s.start_time.slice(0, 5));

    // Horários de reuniões existentes (podem estar em slots removidos)
    const meetingTimes = meetings
      .map((m) => {
        const d = parseISO(m.scheduled_at);
        if (!isSameDay(d, selectedDate)) return null;
        return format(d, "HH:mm");
      })
      .filter(Boolean) as string[];

    // Unir e ordenar
    const uniqueTimes = [...new Set([...configuredTimes, ...meetingTimes])].sort();
    return uniqueTimes.map((timeStr) => {
      const [hour, minute] = timeStr.split(":").map(Number);
      return setMinutes(setHours(selectedDate, hour), minute);
    });
  }, [daySlots, meetings, selectedDate]);

  // Verificar se um closer tem horário configurado para este slot
  const isSlotConfigured = (closerId: string, slotTime: Date) => {
    // Normalize to HH:mm for comparison (start_time comes as HH:mm:ss from DB)
    const timeStr = format(slotTime, "HH:mm");
    return daySlots.some((s) => s.closer_id === closerId && s.start_time.slice(0, 5) === timeStr);
  };

  const isSlotBlockedByTime = (closerId: string, slotTime: Date) => {
    const slotTimeStr = format(slotTime, 'HH:mm');
    const closerBlocks = blockedDates.filter(
      (bd) => bd.closer_id === closerId && isSameDay(parseISO(bd.blocked_date), selectedDate),
    );
    return closerBlocks.some((bd) => {
      if (!bd.blocked_start_time || !bd.blocked_end_time) return true; // full day
      const start = bd.blocked_start_time.slice(0, 5);
      const end = bd.blocked_end_time.slice(0, 5);
      return slotTimeStr >= start && slotTimeStr < end;
    });
  };

  const isSlotAvailable = (closerId: string, slotTime: Date) => {
    // Check if date/time is blocked
    if (isSlotBlockedByTime(closerId, slotTime)) return false;

    // Verificar se o closer tem este horário configurado
    if (!isSlotConfigured(closerId, slotTime)) return false;

    // Buscar max_leads_per_slot do closer
    const closer = closers.find(c => c.id === closerId);
    const maxLeads = closer?.max_leads_per_slot || 4;

    // Contar total de attendees no slot
    const slotMeetings = getMeetingsForSlot(closerId, slotTime);
    const totalAttendees = slotMeetings.reduce(
      (sum, m) => sum + (m.attendees?.length || 0),
      0
    );

    return totalAttendees < maxLeads;
  };

  const getMeetingsForSlot = (closerId: string, slotTime: Date) => {
    return meetings.filter((m) => {
      if (m.closer_id !== closerId) return false;
      const meetingTime = parseISO(m.scheduled_at);
      const timeMatch =
        isSameDay(meetingTime, slotTime) &&
        meetingTime.getHours() === slotTime.getHours() &&
        meetingTime.getMinutes() === slotTime.getMinutes();
      if (!timeMatch) return false;
      // Exclude orphan canceled slots (no attendees)
      if (m.status === 'canceled' && (!m.attendees || m.attendees.length === 0)) return false;
      return true;
    });
  };

  // Meta de leads por closer por dia
  const CLOSER_META = 18;

  // Contador de leads (attendees) agendados por closer no dia
  const dailyLeadCounts = useMemo(() => {
    const counts: Record<string, number> = {};

    meetings.forEach((meeting) => {
      const closerId = meeting.closer_id;
      const attendeesCount = meeting.attendees?.length || 0;
      counts[closerId] = (counts[closerId] || 0) + attendeesCount;
    });

    return counts;
  }, [meetings]);

  const now = new Date();
  const isToday = isSameDay(selectedDate, now);

  // Ref for scroll container
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to first meeting or current time
  useEffect(() => {
    if (!scrollContainerRef.current || timeSlots.length === 0) return;

    // Find first upcoming meeting for today, or first meeting for other days
    const targetMeeting = meetings
      .filter((m) => {
        const meetingDate = parseISO(m.scheduled_at);
        if (!isSameDay(meetingDate, selectedDate)) return false;
        // For today, only consider future meetings
        if (isToday) return isAfter(meetingDate, now);
        return true;
      })
      .sort((a, b) => parseISO(a.scheduled_at).getTime() - parseISO(b.scheduled_at).getTime())[0];

    let targetSlotIndex = -1;

    if (targetMeeting) {
      // Scroll to first meeting
      const meetingTime = parseISO(targetMeeting.scheduled_at);
      const meetingTimeStr = format(meetingTime, "HH:mm");
      targetSlotIndex = timeSlots.findIndex((slot) => format(slot, "HH:mm") === meetingTimeStr);
    } else if (isToday) {
      // For today without upcoming meetings, scroll to current time
      const currentTimeStr = `${now.getHours().toString().padStart(2, "0")}:${(Math.floor(now.getMinutes() / 30) * 30).toString().padStart(2, "0")}`;
      targetSlotIndex = timeSlots.findIndex((slot) => format(slot, "HH:mm") >= currentTimeStr);
    }

    if (targetSlotIndex > 0) {
      // Scroll with some margin (2 slots above)
      const scrollPosition = Math.max(0, (targetSlotIndex - 2) * 40);
      scrollContainerRef.current.scrollTop = scrollPosition;
    }
  }, [meetings, timeSlots, selectedDate, isToday]);

  return (
    <div className="border rounded-lg overflow-hidden bg-card">
      {/* Header with closer names */}
      <div
        className="grid border-b bg-muted/50 sticky top-0 z-10"
        style={{ gridTemplateColumns: `80px repeat(${visibleClosers.length}, 1fr)` }}
      >
        <div className="p-3 text-center text-xs font-medium text-muted-foreground border-r flex items-center justify-center gap-1">
          <span>{format(selectedDate, "EEE dd/MM", { locale: ptBR })}</span>
          {onEditHours && (
            <button
              onClick={onEditHours}
              className="hover:bg-muted rounded p-0.5 transition-colors"
              title="Editar horários"
            >
              <Settings className="h-3 w-3" />
            </button>
          )}
        </div>
        {visibleClosers.map((closer) => {
          const leadCount = dailyLeadCounts[closer.id] || 0;
          return (
            <div key={closer.id} className="p-2 text-center border-l">
              <div className="flex items-center justify-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: closer.color }} />
                <span className="font-medium text-sm">{closer.name}</span>
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                <span className={cn("font-medium", leadCount >= CLOSER_META ? "text-green-500" : "text-yellow-500")}>
                  {leadCount}
                </span>
                <span> / {CLOSER_META} leads</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Time slots grid */}
      <div ref={scrollContainerRef} className="max-h-[500px] overflow-y-auto">
        {timeSlots.map((slot, idx) => {
          const timeStr = format(slot, "HH:mm");
          const isCurrentSlot =
            isToday &&
            now.getHours() === slot.getHours() &&
            now.getMinutes() >= slot.getMinutes() &&
            now.getMinutes() < slot.getMinutes() + 30;

          return (
            <div
              key={idx}
              className={cn("grid border-b last:border-b-0", isCurrentSlot && "bg-primary/10")}
              style={{ gridTemplateColumns: `80px repeat(${visibleClosers.length}, 1fr)` }}
            >
              <div
                className={cn(
                  "p-2 text-xs text-muted-foreground text-center border-r bg-muted/30",
                  isCurrentSlot && "font-bold text-primary",
                )}
              >
                {timeStr}
              </div>

              {visibleClosers.map((closer) => {
                const slotMeetings = getMeetingsForSlot(closer.id, slot);
                const hasMeetings = slotMeetings.length > 0;
                // Combinar attendees de todos os meetings no mesmo slot
                const allAttendees = slotMeetings.flatMap(m => m.attendees || []);
                // Prioritize active slots over canceled ones
                const sortedMeetings = [...slotMeetings].sort((a, b) => {
                  if (a.status === 'canceled' && b.status !== 'canceled') return 1;
                  if (a.status !== 'canceled' && b.status === 'canceled') return -1;
                  return 0;
                });
                const firstMeeting = sortedMeetings[0];
                const available = isSlotAvailable(closer.id, slot);
                const isBlocked = isSlotBlockedByTime(closer.id, slot);

                return (
                  <div
                    key={`${closer.id}-${idx}`}
                    className={cn("min-h-[40px] p-0.5 border-l relative", isCurrentSlot && "bg-primary/5")}
                  >
                    {hasMeetings && firstMeeting ? (
                      <div className="relative group h-full">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => onSelectMeeting(firstMeeting)}
                                className={cn(
                                  "w-full h-full px-2 py-1 rounded text-xs text-white text-left transition-colors",
                                  STATUS_STYLES[firstMeeting.status] || STATUS_STYLES.scheduled,
                                )}
                              >
                              <div className="space-y-0.5">
                                {allAttendees.length ? (
                                  allAttendees.slice(0, 3).map((att) => {
                                    const sdrName = att.booked_by_profile?.full_name || firstMeeting.booked_by_profile?.full_name;
                                    const leadFirstName = (att.attendee_name || att.contact?.name || "Lead").split(' ')[0];
                                    return (
                                      <div key={att.id} className="flex items-center justify-between gap-1">
                                        <div className="flex items-center gap-1 truncate">
                                          {sdrName && (
                                            <>
                                              <span className="text-white/70 font-semibold flex-shrink-0">
                                                {getInitials(sdrName)}
                                              </span>
                                              <span className="text-white/50">•</span>
                                            </>
                                          )}
                                          <span className="truncate font-medium">
                                            {leadFirstName}
                                          </span>
                                          {activeBU === 'consorcio' ? (
                                            partnerData[att.id]?.isPartner && (
                                              <span className="flex items-center bg-blue-500/40 rounded px-0.5" title={`Parceiro ${partnerData[att.id]?.productLabel}`}>
                                                <UserCircle className="h-2.5 w-2.5 text-white flex-shrink-0" />
                                              </span>
                                            )
                                          ) : (
                                            outsideData[att.id]?.isOutside && (
                                              <span className="flex items-center bg-yellow-500/40 rounded px-0.5">
                                                <DollarSign className="h-2.5 w-2.5 text-white flex-shrink-0" />
                                              </span>
                                            )
                                          )}
                                          {!att.is_partner && att.parent_attendee_id && 
                                           !['contract_paid', 'completed', 'refunded', 'approved', 'rejected'].includes(att.status) && (
                                            <span className="flex items-center bg-orange-500/40 rounded px-0.5">
                                              <ArrowRightLeft className="h-2.5 w-2.5 text-white flex-shrink-0" />
                                            </span>
                                          )}
                                        </div>
                                        <Badge
                                          variant="outline"
                                          className={cn(
                                            "text-[9px] px-1 py-0 border-white/30",
                                            ATTENDEE_STATUS_CONFIG[att.status]?.bgClass || "bg-white/20",
                                          )}
                                        >
                                          {ATTENDEE_STATUS_CONFIG[att.status]?.shortLabel || att.status}
                                        </Badge>
                                      </div>
                                    );
                                  })
                                ) : (
                                  <div className="font-medium truncate">
                                    {firstMeeting.deal?.contact?.name || firstMeeting.deal?.name || "Lead"}
                                  </div>
                                )}
                                {allAttendees.length > 3 && (
                                  <div className="text-[10px] opacity-80">+{allAttendees.length - 3} mais</div>
                                )}
                              </div>
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="right" className="max-w-xs">
                            <div className="space-y-1">
                              <div className="font-semibold text-xs mb-1">Participantes:</div>
                              {allAttendees.length ? (
                                allAttendees.map((att) => (
                                  <div key={att.id} className="text-xs flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-1 flex-wrap">
                                      <span>• {att.attendee_name || att.contact?.name || "Lead"}</span>
                                      {att.is_partner && (
                                        <Badge variant="outline" className="text-[9px] px-1 py-0">
                                          Sócio
                                        </Badge>
                                      )}
                                      {activeBU === 'consorcio' ? (
                                        partnerData[att.id]?.isPartner && (
                                          <Badge variant="outline" className="text-[9px] px-1 py-0 bg-blue-100 text-blue-700 border-blue-300 gap-0.5">
                                            <UserCircle className="h-2.5 w-2.5" />
                                            Parceiro {partnerData[att.id]?.productLabel}
                                          </Badge>
                                        )
                                      ) : (
                                        outsideData[att.id]?.isOutside && (
                                          <Badge variant="outline" className="text-[9px] px-1 py-0 bg-yellow-100 text-yellow-700 border-yellow-300 gap-0.5">
                                            <DollarSign className="h-2.5 w-2.5" />
                                            Outside
                                          </Badge>
                                        )
                                      )}
                                      {!att.is_partner && att.parent_attendee_id && 
                                       !['contract_paid', 'completed', 'refunded', 'approved', 'rejected'].includes(att.status) && (
                                        <Badge variant="outline" className="text-[9px] px-1 py-0 bg-orange-100 text-orange-700 border-orange-300 gap-0.5">
                                          <ArrowRightLeft className="h-2.5 w-2.5" />
                                          Remanejado
                                        </Badge>
                                      )}
                                    </div>
                                    <Badge
                                      variant={ATTENDEE_STATUS_CONFIG[att.status]?.variant || "outline"}
                                      className="text-[9px] px-1 py-0"
                                    >
                                      {ATTENDEE_STATUS_CONFIG[att.status]?.label || att.status}
                                    </Badge>
                                  </div>
                                ))
                              ) : (
                                <div className="text-xs">{firstMeeting.deal?.contact?.name || firstMeeting.deal?.name}</div>
                              )}
                              <div className="text-xs text-muted-foreground pt-1">
                                {format(parseISO(firstMeeting.scheduled_at), "HH:mm")} - {firstMeeting.duration_minutes}min
                              </div>
                              <Badge variant="outline" className="text-xs">
                                {firstMeeting.status === "scheduled" && "Agendada"}
                                {firstMeeting.status === "rescheduled" && "Reagendada"}
                                {firstMeeting.status === "completed" && "Realizada"}
                                {firstMeeting.status === "no_show" && "No-show"}
                                {firstMeeting.status === "canceled" && "Cancelada"}
                                {firstMeeting.status === "contract_paid" && "Contrato Pago"}
                              </Badge>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                        {onAddToMeeting && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onAddToMeeting(closer.id, slot);
                            }}
                            className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 bg-white/90 rounded-full p-0.5 shadow hover:bg-green-100 transition-opacity z-10"
                            title="Adicionar lead a esta reunião"
                          >
                            <UserPlus className="h-3.5 w-3.5 text-green-600" />
                          </button>
                        )}
                      </div>
                    ) : isBlocked ? (
                      <div className="w-full h-full bg-muted/50 rounded flex items-center justify-center">
                        <span className="text-xs text-muted-foreground">Bloqueado</span>
                      </div>
                    ) : available ? (
                      <button
                        onClick={() => onSelectSlot(closer.id, slot)}
                        className="w-full h-full min-h-[36px] flex items-center justify-center rounded bg-green-100 dark:bg-green-500/30 border-2 border-dashed border-green-500 hover:bg-green-200 dark:hover:bg-green-500/40 transition-all group shadow-md"
                      >
                        <Plus className="h-5 w-5 text-green-700 dark:text-green-300 group-hover:text-green-800 dark:group-hover:text-green-200 transition-colors" />
                        <span className="text-[10px] font-medium text-green-700 dark:text-green-300 ml-0.5">Livre</span>
                      </button>
                    ) : (
                      <div className="w-full min-h-[36px]" />
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
