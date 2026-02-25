import { useMemo, useRef, useEffect } from "react";
import { format, parseISO, isSameDay, setHours, setMinutes, isAfter } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, ArrowRightLeft } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { R2Meeting } from "@/hooks/useR2AgendaMeetings";
import { R2Closer } from "@/hooks/useR2Closers";
import { R2DailySlotsMap } from "@/hooks/useR2DailySlotsForView";
import { cn } from "@/lib/utils";

interface R2CloserColumnCalendarProps {
  meetings: R2Meeting[];
  closers: R2Closer[];
  selectedDate: Date;
  configuredSlotsMap?: R2DailySlotsMap;
  onSelectMeeting: (meeting: R2Meeting) => void;
  onSelectSlot: (closerId: string, date: Date) => void;
}

const STATUS_STYLES: Record<string, string> = {
  scheduled: "bg-purple-500/70 hover:bg-purple-500/80",
  rescheduled: "bg-yellow-500/90 hover:bg-yellow-500",
  completed: "bg-green-500/80 hover:bg-green-500",
  no_show: "bg-red-500/80 hover:bg-red-500",
  canceled: "bg-muted/60 line-through",
  contract_paid: "bg-emerald-600/90 hover:bg-emerald-600",
};

const ATTENDEE_STATUS_CONFIG: Record<string, { label: string; shortLabel: string; bgClass: string }> = {
  invited: { label: "Agendado", shortLabel: "Agend.", bgClass: "bg-purple-600/80" },
  completed: { label: "Compareceu", shortLabel: "OK", bgClass: "bg-green-600/80" },
  no_show: { label: "No-show", shortLabel: "NS", bgClass: "bg-red-600/80" },
  contract_paid: { label: "Contrato Pago", shortLabel: "Contrato", bgClass: "bg-emerald-600/80" },
  rescheduled: { label: "Reagendado", shortLabel: "Reag.", bgClass: "bg-yellow-600/80" },
};

// Meta de leads por closer por dia (R2)
const R2_CLOSER_META = 18;

// Fixed time slots for R2 (07:00 to 23:30, 30-min intervals)
const ALL_TIME_SLOTS = Array.from({ length: 34 }, (_, i) => {
  const hour = Math.floor(i / 2) + 7;
  const minute = (i % 2) * 30;
  return { hour, minute, label: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}` };
});

export function R2CloserColumnCalendar({
  meetings,
  closers,
  selectedDate,
  configuredSlotsMap,
  onSelectMeeting,
  onSelectSlot,
}: R2CloserColumnCalendarProps) {

  // Get all meetings for a specific slot (may have multiple for same time/closer)
  const getMeetingsForSlot = (closerId: string, hour: number, minute: number) => {
    return meetings.filter((m) => {
      if (m.closer?.id !== closerId) return false;
      const meetingTime = parseISO(m.scheduled_at);
      return (
        isSameDay(meetingTime, selectedDate) &&
        meetingTime.getHours() === hour &&
        meetingTime.getMinutes() === minute
      );
    });
  };

  // Get consolidated meeting with all attendees from multiple meetings in same slot
  const getConsolidatedMeetingForSlot = (closerId: string, hour: number, minute: number): R2Meeting | undefined => {
    const slotMeetings = getMeetingsForSlot(closerId, hour, minute);
    if (slotMeetings.length === 0) return undefined;
    if (slotMeetings.length === 1) return slotMeetings[0];
    
    // Filter out canceled slots with no attendees
    const validMeetings = slotMeetings.filter(m => 
      m.status !== 'canceled' || (m.attendees && m.attendees.length > 0)
    );
    
    if (validMeetings.length === 0) {
      // All are empty canceled slots - treat as no meeting (slot is free)
      return undefined;
    }
    
    // Prioritize non-canceled meeting for status
    const primaryMeeting = validMeetings.find(m => m.status !== 'canceled') 
      || validMeetings[0];
    
    // Consolidate all attendees from valid meetings
    return {
      ...primaryMeeting,
      attendees: validMeetings.flatMap(m => m.attendees || [])
    };
  };

  // Check if a slot is configured for a specific closer
  const isSlotConfiguredForCloser = (closerId: string, hour: number, minute: number) => {
    if (!configuredSlotsMap) return true; // If no map provided, show all as available (fallback)
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    const dateSlots = configuredSlotsMap[dateStr];
    if (!dateSlots || !dateSlots[timeStr]) return false;
    return dateSlots[timeStr].closerIds.includes(closerId);
  };

  const isSlotAvailable = (closerId: string, hour: number, minute: number) => {
    // First check if slot is configured for this closer
    if (!isSlotConfiguredForCloser(closerId, hour, minute)) return false;
    // Then check if there's no meeting
    return getMeetingsForSlot(closerId, hour, minute).length === 0;
  };

  // Filter time slots to only show configured times AND times with existing meetings
  const timeSlots = useMemo(() => {
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    
    // 1. Configured times
    const configuredTimes = new Set<string>();
    if (configuredSlotsMap) {
      const dateSlots = configuredSlotsMap[dateStr];
      if (dateSlots) {
        Object.keys(dateSlots).forEach(t => configuredTimes.add(t));
      }
    }
    
    // 2. Times with existing meetings (even if not configured)
    meetings.forEach(m => {
      const meetingTime = parseISO(m.scheduled_at);
      if (isSameDay(meetingTime, selectedDate)) {
        const timeStr = format(meetingTime, 'HH:mm');
        configuredTimes.add(timeStr);
      }
    });
    
    if (configuredTimes.size === 0 && !configuredSlotsMap) {
      return ALL_TIME_SLOTS;
    }
    
    if (configuredTimes.size === 0) return [];
    
    return ALL_TIME_SLOTS.filter(slot => configuredTimes.has(slot.label));
  }, [configuredSlotsMap, selectedDate, meetings]);

  // Contador de leads (attendees) agendados por closer no dia
  const dailyLeadCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    
    meetings.forEach((meeting) => {
      const closerId = meeting.closer?.id;
      if (!closerId) return;
      
      // Verificar se a reunião é no dia selecionado
      if (!isSameDay(parseISO(meeting.scheduled_at), selectedDate)) return;
      
      const attendeesCount = meeting.attendees?.length || 0;
      counts[closerId] = (counts[closerId] || 0) + attendeesCount;
    });
    
    return counts;
  }, [meetings, selectedDate]);

  const now = new Date();
  const isToday = isSameDay(selectedDate, now);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!scrollContainerRef.current || timeSlots.length === 0) return;

    const targetMeeting = meetings
      .filter((m) => {
        const meetingDate = parseISO(m.scheduled_at);
        if (!isSameDay(meetingDate, selectedDate)) return false;
        if (isToday) return isAfter(meetingDate, now);
        return true;
      })
      .sort((a, b) => parseISO(a.scheduled_at).getTime() - parseISO(b.scheduled_at).getTime())[0];

    let targetSlotIndex = -1;

    if (targetMeeting) {
      const meetingTime = parseISO(targetMeeting.scheduled_at);
      targetSlotIndex = timeSlots.findIndex(
        (slot) => slot.hour === meetingTime.getHours() && slot.minute === meetingTime.getMinutes()
      );
    } else if (isToday) {
      targetSlotIndex = timeSlots.findIndex(
        (slot) => slot.hour > now.getHours() || (slot.hour === now.getHours() && slot.minute >= now.getMinutes())
      );
    }

    if (targetSlotIndex > 0) {
      const scrollPosition = Math.max(0, (targetSlotIndex - 2) * 44);
      scrollContainerRef.current.scrollTop = scrollPosition;
    }
  }, [meetings, selectedDate, isToday, timeSlots]);

  return (
    <div className="border rounded-lg overflow-hidden bg-card">
      {/* Header with closer names */}
      <div
        className="grid border-b bg-muted/50 sticky top-0 z-10"
        style={{ gridTemplateColumns: `80px repeat(${closers.length}, 1fr)` }}
      >
        <div className="p-3 text-center text-xs font-medium text-muted-foreground border-r flex items-center justify-center">
          <span>{format(selectedDate, "EEE dd/MM", { locale: ptBR })}</span>
        </div>
        {closers.map((closer) => {
          const leadCount = dailyLeadCounts[closer.id] || 0;
          return (
            <div key={closer.id} className="p-2 text-center border-l">
              <div className="flex items-center justify-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: closer.color || '#9333EA' }} />
                <span className="font-medium text-sm">{closer.name}</span>
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                <span className={cn("font-medium", leadCount >= R2_CLOSER_META ? "text-green-500" : "text-yellow-500")}>
                  {leadCount}
                </span>
                <span> / {R2_CLOSER_META} leads</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Time slots grid */}
      <div ref={scrollContainerRef} className="max-h-[500px] overflow-y-auto">
        {timeSlots.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nenhum horário configurado para esta data.
          </div>
        ) : timeSlots.map((slot, idx) => {
          const isCurrentSlot =
            isToday &&
            now.getHours() === slot.hour &&
            now.getMinutes() >= slot.minute &&
            now.getMinutes() < slot.minute + 30;

          return (
            <div
              key={idx}
              className={cn("grid border-b last:border-b-0", isCurrentSlot && "bg-purple-500/10")}
              style={{ gridTemplateColumns: `80px repeat(${closers.length}, 1fr)` }}
            >
              <div
                className={cn(
                  "p-2 text-xs text-muted-foreground text-center border-r bg-muted/30",
                  isCurrentSlot && "font-bold text-purple-600",
                )}
              >
                {slot.label}
              </div>

              {closers.map((closer) => {
                const meeting = getConsolidatedMeetingForSlot(closer.id, slot.hour, slot.minute);
                const available = isSlotAvailable(closer.id, slot.hour, slot.minute);

                return (
                  <div
                    key={`${closer.id}-${idx}`}
                    className={cn("min-h-[44px] p-0.5 border-l relative", isCurrentSlot && "bg-purple-500/5")}
                  >
                    {meeting ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => onSelectMeeting(meeting)}
                              className={cn(
                                "w-full h-full px-2 py-1 rounded text-xs text-white text-left transition-colors",
                                STATUS_STYLES[meeting.status] || STATUS_STYLES.scheduled,
                              )}
                            >
                              <div className="space-y-0.5">
                                {meeting.attendees?.length ? (
                                  meeting.attendees.slice(0, 2).map((att) => (
                                    <div key={att.id} className="flex items-center justify-between gap-1">
                                      <div className="flex items-center gap-1 min-w-0">
                                        <span className="truncate font-medium">
                                          {att.name || att.deal?.contact?.name || "Lead"}
                                        </span>
                                        {(att as any).is_reschedule && 
                                         !['contract_paid', 'completed', 'refunded', 'approved', 'rejected'].includes(att.status) && (
                                          <span className="flex items-center bg-orange-500/40 rounded px-0.5 shrink-0">
                                            <ArrowRightLeft className="h-2.5 w-2.5 text-white" />
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
                                  ))
                                ) : (
                                  <div className="font-medium truncate">
                                    {meeting.attendees?.[0]?.deal?.contact?.name || meeting.attendees?.[0]?.deal?.name || "Lead"}
                                  </div>
                                )}
                                {meeting.attendees && meeting.attendees.length > 2 && (
                                  <div className="text-[10px] opacity-80">+{meeting.attendees.length - 2} mais</div>
                                )}
                              </div>
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="right" className="max-w-xs">
                            <div className="space-y-1">
                              <div className="font-semibold text-xs mb-1">Participantes R2:</div>
                              {meeting.attendees?.length ? (
                                meeting.attendees.map((att) => (
                                  <div key={att.id} className="text-xs flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-1">
                                      <span>• {att.name || att.deal?.contact?.name || "Lead"}</span>
                                      {(att as any).is_reschedule && 
                                       !['contract_paid', 'completed', 'refunded', 'approved', 'rejected'].includes(att.status) && (
                                        <Badge variant="outline" className="text-[9px] px-1 py-0 bg-orange-100 text-orange-700 border-orange-300 gap-0.5">
                                          <ArrowRightLeft className="h-2.5 w-2.5" />
                                          Reagendado
                                        </Badge>
                                      )}
                                    </div>
                                    <Badge variant="outline" className="text-[9px] px-1 py-0">
                                      {ATTENDEE_STATUS_CONFIG[att.status]?.label || att.status}
                                    </Badge>
                                  </div>
                                ))
                              ) : (
                                <div className="text-xs">{meeting.attendees?.[0]?.deal?.contact?.name || meeting.attendees?.[0]?.deal?.name}</div>
                              )}
                              <div className="text-xs text-muted-foreground pt-1">
                                {format(parseISO(meeting.scheduled_at), "HH:mm")} - 30min
                              </div>
                              <Badge variant="outline" className="text-xs">
                                {meeting.status === "scheduled" && "Agendada"}
                                {meeting.status === "rescheduled" && "Reagendada"}
                                {meeting.status === "completed" && "Realizada"}
                                {meeting.status === "no_show" && "No-show"}
                                {meeting.status === "canceled" && "Cancelada"}
                                {meeting.status === "contract_paid" && "Contrato Pago"}
                              </Badge>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : available ? (
                      <button
                        onClick={() => {
                          const slotDate = setMinutes(setHours(new Date(selectedDate), slot.hour), slot.minute);
                          onSelectSlot(closer.id, slotDate);
                        }}
                        className="w-full h-full min-h-[40px] flex items-center justify-center rounded bg-purple-100 dark:bg-purple-500/20 border-2 border-dashed border-purple-400 hover:bg-purple-200 dark:hover:bg-purple-500/30 transition-all group"
                      >
                        <Plus className="h-4 w-4 text-purple-600 dark:text-purple-300 group-hover:text-purple-700" />
                        <span className="text-[10px] font-medium text-purple-600 dark:text-purple-300 ml-0.5">Livre</span>
                      </button>
                    ) : (
                      <div className="w-full h-full min-h-[40px]" />
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
