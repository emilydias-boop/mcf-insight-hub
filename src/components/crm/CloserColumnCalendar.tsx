import { useMemo } from 'react';
import { format, parseISO, isSameDay, addMinutes, setHours, setMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Settings } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { MeetingSlot, CloserWithAvailability, BlockedDate } from '@/hooks/useAgendaData';
import { cn } from '@/lib/utils';

interface CloserColumnCalendarProps {
  meetings: MeetingSlot[];
  closers: CloserWithAvailability[];
  blockedDates: BlockedDate[];
  selectedDate: Date;
  onSelectMeeting: (meeting: MeetingSlot) => void;
  onSelectSlot: (closerId: string, date: Date) => void;
  onEditHours?: () => void;
}

const SLOT_DURATION = 30; // 30 min slots
const DEFAULT_START_HOUR = 8;
const DEFAULT_END_HOUR = 18;

const STATUS_STYLES: Record<string, string> = {
  scheduled: 'bg-primary/90 hover:bg-primary',
  rescheduled: 'bg-yellow-500/90 hover:bg-yellow-500',
  completed: 'bg-green-500/80 hover:bg-green-500',
  no_show: 'bg-red-500/80 hover:bg-red-500',
  canceled: 'bg-muted/60 line-through',
};

export function CloserColumnCalendar({ 
  meetings, 
  closers, 
  blockedDates,
  selectedDate, 
  onSelectMeeting,
  onSelectSlot,
  onEditHours
}: CloserColumnCalendarProps) {
  const dayOfWeek = selectedDate.getDay() === 0 ? 7 : selectedDate.getDay();

  // Generate time slots dynamically based on closers availability for this day
  const timeSlots = useMemo(() => {
    let minHour = DEFAULT_END_HOUR;
    let maxHour = DEFAULT_START_HOUR;

    for (const closer of closers) {
      const dayAvailability = closer.availability.filter(
        a => a.day_of_week === dayOfWeek && a.is_active
      );
      
      for (const avail of dayAvailability) {
        const startHour = parseInt(avail.start_time.split(':')[0]);
        const endHour = parseInt(avail.end_time.split(':')[0]);
        minHour = Math.min(minHour, startHour);
        maxHour = Math.max(maxHour, endHour);
      }
    }

    // Fallback if no availability found
    if (minHour >= maxHour) {
      minHour = DEFAULT_START_HOUR;
      maxHour = DEFAULT_END_HOUR;
    }

    const slots: Date[] = [];
    for (let hour = minHour; hour < maxHour; hour++) {
      for (let minute = 0; minute < 60; minute += SLOT_DURATION) {
        const slot = setMinutes(setHours(selectedDate, hour), minute);
        slots.push(slot);
      }
    }
    return slots;
  }, [selectedDate, closers, dayOfWeek]);

  const isSlotAvailable = (closerId: string, slotTime: Date) => {
    const closer = closers.find(c => c.id === closerId);
    if (!closer) return false;

    // Check if date is blocked
    const isBlocked = blockedDates.some(
      bd => bd.closer_id === closerId && isSameDay(parseISO(bd.blocked_date), selectedDate)
    );
    if (isBlocked) return false;

    // Check availability
    const timeStr = format(slotTime, 'HH:mm');
    return closer.availability.some(a => {
      if (a.day_of_week !== dayOfWeek) return false;
      return timeStr >= a.start_time && timeStr < a.end_time;
    });
  };

  const getMeetingForSlot = (closerId: string, slotTime: Date) => {
    return meetings.find(m => {
      if (m.closer_id !== closerId) return false;
      const meetingTime = parseISO(m.scheduled_at);
      return isSameDay(meetingTime, slotTime) && 
             meetingTime.getHours() === slotTime.getHours() &&
             meetingTime.getMinutes() === slotTime.getMinutes();
    });
  };

  const now = new Date();
  const isToday = isSameDay(selectedDate, now);

  return (
    <div className="border rounded-lg overflow-hidden bg-card">
      {/* Header with closer names */}
      <div 
        className="grid border-b bg-muted/50 sticky top-0 z-10"
        style={{ gridTemplateColumns: `80px repeat(${closers.length}, 1fr)` }}
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
        {closers.map(closer => (
          <div 
            key={closer.id}
            className="p-3 text-center border-l"
          >
            <div className="flex items-center justify-center gap-2">
              <div 
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: closer.color }}
              />
              <span className="font-medium text-sm">{closer.name}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Time slots grid */}
      <div className="max-h-[500px] overflow-y-auto">
        {timeSlots.map((slot, idx) => {
          const timeStr = format(slot, 'HH:mm');
          const isCurrentSlot = isToday && 
            now.getHours() === slot.getHours() && 
            now.getMinutes() >= slot.getMinutes() && 
            now.getMinutes() < slot.getMinutes() + SLOT_DURATION;

          return (
            <div 
              key={idx}
              className={cn(
                "grid border-b last:border-b-0",
                isCurrentSlot && "bg-primary/10"
              )}
              style={{ gridTemplateColumns: `80px repeat(${closers.length}, 1fr)` }}
            >
              <div className={cn(
                "p-2 text-xs text-muted-foreground text-center border-r bg-muted/30",
                isCurrentSlot && "font-bold text-primary"
              )}>
                {timeStr}
              </div>
              
              {closers.map(closer => {
                const meeting = getMeetingForSlot(closer.id, slot);
                const available = isSlotAvailable(closer.id, slot);
                const isBlocked = blockedDates.some(
                  bd => bd.closer_id === closer.id && isSameDay(parseISO(bd.blocked_date), selectedDate)
                );

                return (
                  <div 
                    key={`${closer.id}-${idx}`}
                    className={cn(
                      "min-h-[40px] p-0.5 border-l relative",
                      isCurrentSlot && "bg-primary/5"
                    )}
                  >
                    {meeting ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => onSelectMeeting(meeting)}
                              className={cn(
                                'w-full h-full px-2 py-1 rounded text-xs text-white text-left transition-colors',
                                STATUS_STYLES[meeting.status] || STATUS_STYLES.scheduled
                              )}
                            >
                              <div className="font-medium truncate">
                                {meeting.attendees?.length 
                                  ? meeting.attendees.length > 1
                                    ? `${meeting.attendees[0].attendee_name || meeting.attendees[0].contact?.name || 'Lead'} +${meeting.attendees.length - 1}`
                                    : meeting.attendees[0].attendee_name || meeting.attendees[0].contact?.name || 'Lead'
                                  : meeting.deal?.contact?.name || meeting.deal?.name || 'Lead'}
                              </div>
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="right">
                            <div className="space-y-1">
                              <div className="font-semibold text-xs mb-1">Participantes:</div>
                              {meeting.attendees?.length ? (
                                meeting.attendees.map(att => (
                                  <div key={att.id} className="text-xs flex items-center gap-1">
                                    <span>• {att.attendee_name || att.contact?.name || 'Lead'}</span>
                                    {att.is_partner && <Badge variant="outline" className="text-[9px] px-1 py-0">Sócio</Badge>}
                                  </div>
                                ))
                              ) : (
                                <div className="text-xs">{meeting.deal?.contact?.name || meeting.deal?.name}</div>
                              )}
                              <div className="text-xs text-muted-foreground pt-1">
                                {format(parseISO(meeting.scheduled_at), "HH:mm")} - {meeting.duration_minutes}min
                              </div>
                              <Badge variant="outline" className="text-xs">
                                {meeting.status === 'scheduled' && 'Agendada'}
                                {meeting.status === 'rescheduled' && 'Reagendada'}
                                {meeting.status === 'completed' && 'Realizada'}
                                {meeting.status === 'no_show' && 'No-show'}
                                {meeting.status === 'canceled' && 'Cancelada'}
                              </Badge>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : isBlocked ? (
                      <div className="w-full h-full bg-muted/50 rounded flex items-center justify-center">
                        <span className="text-xs text-muted-foreground">Bloqueado</span>
                      </div>
                    ) : available ? (
                      <button
                        onClick={() => onSelectSlot(closer.id, slot)}
                        className="w-full h-full rounded hover:bg-accent/50 transition-colors"
                      />
                    ) : (
                      <div className="w-full h-full bg-muted/20" />
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
