import { useMemo } from 'react';
import { format, isSameDay, parseISO, addDays, startOfWeek, isWithinInterval, setHours, setMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { MeetingSlot, CloserWithAvailability } from '@/hooks/useAgendaData';

interface AgendaCalendarProps {
  meetings: MeetingSlot[];
  selectedDate: Date;
  onSelectMeeting: (meeting: MeetingSlot) => void;
  closerFilter: string | null;
  closers?: CloserWithAvailability[];
}

// 30min slots from 8:00 to 18:00
const TIME_SLOTS = Array.from({ length: 20 }, (_, i) => ({
  hour: Math.floor(i / 2) + 8,
  minute: (i % 2) * 30,
}));

const DEFAULT_COLORS: Record<string, string> = {
  'Thayna': '#3B82F6',
  'Deisi': '#8B5CF6',
  'Leticia': '#EC4899',
  'Julio': '#22C55E',
  'Jessica Bellini': '#F97316',
};

const STATUS_STYLES: Record<string, string> = {
  scheduled: 'border-l-4 border-l-primary',
  rescheduled: 'border-l-4 border-l-yellow-500',
  completed: 'border-l-4 border-l-green-500 opacity-75',
  no_show: 'border-l-4 border-l-red-500 opacity-75',
  canceled: 'border-l-4 border-l-muted opacity-50 line-through',
};

export function AgendaCalendar({ meetings, selectedDate, onSelectMeeting, closerFilter, closers = [] }: AgendaCalendarProps) {
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 5 }, (_, i) => addDays(weekStart, i));

  const filteredMeetings = useMemo(() => {
    if (!closerFilter) return meetings;
    return meetings.filter(m => m.closer_id === closerFilter);
  }, [meetings, closerFilter]);

  const getMeetingsForSlot = (day: Date, hour: number, minute: number) => {
    return filteredMeetings.filter(meeting => {
      const meetingDate = parseISO(meeting.scheduled_at);
      return (
        isSameDay(meetingDate, day) &&
        meetingDate.getHours() === hour &&
        meetingDate.getMinutes() >= minute &&
        meetingDate.getMinutes() < minute + 30
      );
    });
  };

  const getCloserColor = (closerId: string | undefined, closerName: string | undefined) => {
    // Try to get color from closers array (from DB)
    const closer = closers.find(c => c.id === closerId);
    if (closer?.color) return closer.color;
    // Fallback to default colors
    if (closerName && DEFAULT_COLORS[closerName]) return DEFAULT_COLORS[closerName];
    return '#6B7280';
  };

  const isCurrentTimeSlot = (day: Date, hour: number, minute: number) => {
    const now = new Date();
    if (!isSameDay(day, now)) return false;
    const slotStart = setMinutes(setHours(day, hour), minute);
    const slotEnd = setMinutes(setHours(day, hour), minute + 30);
    return isWithinInterval(now, { start: slotStart, end: slotEnd });
  };

  // Build legend from closers with colors
  const legendItems = useMemo(() => {
    const items = closers.length > 0
      ? closers.filter(c => c.is_active).map(c => ({ name: c.name, color: c.color || DEFAULT_COLORS[c.name] || '#6B7280' }))
      : Object.entries(DEFAULT_COLORS).map(([name, color]) => ({ name, color }));
    return items;
  }, [closers]);

  return (
    <div className="border rounded-lg overflow-hidden bg-card">
      {/* Header with days */}
      <div className="grid grid-cols-[70px_repeat(5,1fr)] border-b bg-muted/50">
        <div className="p-2 text-center text-xs font-medium text-muted-foreground">Hora</div>
        {weekDays.map(day => (
          <div
            key={day.toISOString()}
            className={cn(
              'p-2 text-center border-l',
              isSameDay(day, new Date()) && 'bg-primary/10'
            )}
          >
            <div className="text-xs text-muted-foreground uppercase">
              {format(day, 'EEE', { locale: ptBR })}
            </div>
            <div className={cn(
              'text-sm font-semibold',
              isSameDay(day, new Date()) && 'text-primary'
            )}>
              {format(day, 'd')}
            </div>
          </div>
        ))}
      </div>

      {/* Time slots grid - 30min intervals */}
      <div className="max-h-[500px] overflow-y-auto">
        {TIME_SLOTS.map(({ hour, minute }) => (
          <div
            key={`${hour}-${minute}`}
            className={cn(
              'grid grid-cols-[70px_repeat(5,1fr)] border-b last:border-b-0',
              minute === 0 && 'border-t border-t-border/50'
            )}
          >
            <div className={cn(
              'p-1 text-xs text-muted-foreground text-center border-r bg-muted/30',
              minute === 30 && 'text-muted-foreground/60'
            )}>
              {`${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`}
            </div>
            {weekDays.map(day => {
              const slotMeetings = getMeetingsForSlot(day, hour, minute);
              const isCurrent = isCurrentTimeSlot(day, hour, minute);

              return (
                <div
                  key={`${day.toISOString()}-${hour}-${minute}`}
                  className={cn(
                    'min-h-[40px] p-0.5 border-l relative',
                    isSameDay(day, new Date()) && 'bg-primary/5',
                    isCurrent && 'bg-primary/15 ring-1 ring-primary/30'
                  )}
                >
                  {slotMeetings.map(meeting => {
                    const closerColor = getCloserColor(meeting.closer_id, meeting.closer?.name);
                    return (
                      <TooltipProvider key={meeting.id}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => onSelectMeeting(meeting)}
                              className={cn(
                                'w-full text-left p-1 rounded text-xs bg-card shadow-sm hover:shadow-md transition-all hover:scale-[1.02]',
                                STATUS_STYLES[meeting.status] || ''
                              )}
                              style={{
                                borderLeftColor: closerColor,
                              }}
                            >
                              <div className="flex items-center gap-1">
                                <div
                                  className="w-2 h-2 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: closerColor }}
                                />
                                <span className="font-medium truncate text-[10px]">
                                  {format(parseISO(meeting.scheduled_at), 'HH:mm')}
                                </span>
                              </div>
                              <div className="truncate text-muted-foreground text-[10px]">
                                {meeting.deal?.contact?.name || meeting.deal?.name || 'Sem lead'}
                              </div>
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="right" className="max-w-[280px]">
                            <div className="space-y-1.5">
                              <div className="font-medium">{meeting.deal?.contact?.name || meeting.deal?.name}</div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <div
                                  className="w-2.5 h-2.5 rounded-full"
                                  style={{ backgroundColor: closerColor }}
                                />
                                <span>Closer: {meeting.closer?.name}</span>
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {format(parseISO(meeting.scheduled_at), "dd/MM 'às' HH:mm")}
                              </div>
                              {meeting.deal?.contact?.phone && (
                                <div className="text-xs text-muted-foreground">
                                  📱 {meeting.deal.contact.phone}
                                </div>
                              )}
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
                    );
                  })}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="p-3 border-t bg-muted/30 flex flex-wrap gap-3">
        {legendItems.map(({ name, color }) => (
          <div key={name} className="flex items-center gap-1.5 text-xs">
            <div
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: color }}
            />
            <span>{name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
