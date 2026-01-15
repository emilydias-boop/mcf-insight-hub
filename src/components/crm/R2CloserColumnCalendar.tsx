import { useMemo, useRef, useEffect } from "react";
import { format, parseISO, isSameDay, setHours, setMinutes, isAfter } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { R2Meeting } from "@/hooks/useR2AgendaMeetings";
import { R2Closer } from "@/hooks/useR2Closers";
import { cn } from "@/lib/utils";

interface R2CloserColumnCalendarProps {
  meetings: R2Meeting[];
  closers: R2Closer[];
  selectedDate: Date;
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

// Fixed time slots for R2 (9:00 to 18:00, 30-min intervals)
const TIME_SLOTS = Array.from({ length: 19 }, (_, i) => {
  const hour = Math.floor(i / 2) + 9;
  const minute = (i % 2) * 30;
  return { hour, minute, label: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}` };
});

export function R2CloserColumnCalendar({
  meetings,
  closers,
  selectedDate,
  onSelectMeeting,
  onSelectSlot,
}: R2CloserColumnCalendarProps) {

  const getMeetingForSlot = (closerId: string, hour: number, minute: number) => {
    return meetings.find((m) => {
      if (m.closer?.id !== closerId) return false;
      const meetingTime = parseISO(m.scheduled_at);
      return (
        isSameDay(meetingTime, selectedDate) &&
        meetingTime.getHours() === hour &&
        meetingTime.getMinutes() === minute
      );
    });
  };

  const isSlotAvailable = (closerId: string, hour: number, minute: number) => {
    const hasMeeting = getMeetingForSlot(closerId, hour, minute);
    return !hasMeeting;
  };

  const now = new Date();
  const isToday = isSameDay(selectedDate, now);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!scrollContainerRef.current || TIME_SLOTS.length === 0) return;

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
      targetSlotIndex = TIME_SLOTS.findIndex(
        (slot) => slot.hour === meetingTime.getHours() && slot.minute === meetingTime.getMinutes()
      );
    } else if (isToday) {
      targetSlotIndex = TIME_SLOTS.findIndex(
        (slot) => slot.hour > now.getHours() || (slot.hour === now.getHours() && slot.minute >= now.getMinutes())
      );
    }

    if (targetSlotIndex > 0) {
      const scrollPosition = Math.max(0, (targetSlotIndex - 2) * 44);
      scrollContainerRef.current.scrollTop = scrollPosition;
    }
  }, [meetings, selectedDate, isToday]);

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
        {closers.map((closer) => (
          <div key={closer.id} className="p-2 text-center border-l">
            <div className="flex items-center justify-center gap-2">
              <span className="font-medium text-sm">{closer.name}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Time slots grid */}
      <div ref={scrollContainerRef} className="max-h-[500px] overflow-y-auto">
        {TIME_SLOTS.map((slot, idx) => {
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
                const meeting = getMeetingForSlot(closer.id, slot.hour, slot.minute);
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
                                      <span className="truncate font-medium">
                                        {att.name || att.deal?.contact?.name || "Lead"}
                                      </span>
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
                                    <span>• {att.name || att.deal?.contact?.name || "Lead"}</span>
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
