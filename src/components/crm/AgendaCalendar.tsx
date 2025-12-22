import { useMemo } from 'react';
import { format, isSameDay, parseISO, addDays, startOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { MeetingSlot } from '@/hooks/useAgendaData';

interface AgendaCalendarProps {
  meetings: MeetingSlot[];
  selectedDate: Date;
  onSelectMeeting: (meeting: MeetingSlot) => void;
  closerFilter: string | null;
}

const HOURS = Array.from({ length: 10 }, (_, i) => i + 8); // 8h to 17h
const CLOSER_COLORS: Record<string, string> = {
  'Thayna': 'bg-blue-500',
  'Deisi': 'bg-purple-500',
  'Leticia': 'bg-pink-500',
  'Julio': 'bg-green-500',
  'Jessica Bellini': 'bg-orange-500',
};

const STATUS_STYLES: Record<string, string> = {
  scheduled: 'border-l-4 border-l-primary',
  rescheduled: 'border-l-4 border-l-yellow-500',
  completed: 'border-l-4 border-l-green-500 opacity-75',
  no_show: 'border-l-4 border-l-red-500 opacity-75',
  canceled: 'border-l-4 border-l-muted opacity-50 line-through',
};

export function AgendaCalendar({ meetings, selectedDate, onSelectMeeting, closerFilter }: AgendaCalendarProps) {
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 5 }, (_, i) => addDays(weekStart, i));

  const filteredMeetings = useMemo(() => {
    if (!closerFilter) return meetings;
    return meetings.filter(m => m.closer_id === closerFilter);
  }, [meetings, closerFilter]);

  const getMeetingsForSlot = (day: Date, hour: number) => {
    return filteredMeetings.filter(meeting => {
      const meetingDate = parseISO(meeting.scheduled_at);
      return isSameDay(meetingDate, day) && meetingDate.getHours() === hour;
    });
  };

  const getCloserColor = (closerName: string | undefined) => {
    if (!closerName) return 'bg-muted';
    return CLOSER_COLORS[closerName] || 'bg-muted';
  };

  return (
    <div className="border rounded-lg overflow-hidden bg-card">
      {/* Header with days */}
      <div className="grid grid-cols-[60px_repeat(5,1fr)] border-b bg-muted/50">
        <div className="p-2 text-center text-xs font-medium text-muted-foreground">Hora</div>
        {weekDays.map(day => (
          <div
            key={day.toISOString()}
            className={cn(
              'p-2 text-center border-l',
              isSameDay(day, new Date()) && 'bg-primary/10'
            )}
          >
            <div className="text-xs text-muted-foreground">
              {format(day, 'EEE', { locale: ptBR })}
            </div>
            <div className={cn(
              'text-sm font-medium',
              isSameDay(day, new Date()) && 'text-primary'
            )}>
              {format(day, 'd')}
            </div>
          </div>
        ))}
      </div>

      {/* Time slots grid */}
      <div className="max-h-[500px] overflow-y-auto">
        {HOURS.map(hour => (
          <div key={hour} className="grid grid-cols-[60px_repeat(5,1fr)] border-b last:border-b-0">
            <div className="p-2 text-xs text-muted-foreground text-center border-r bg-muted/30">
              {`${hour.toString().padStart(2, '0')}:00`}
            </div>
            {weekDays.map(day => {
              const slotMeetings = getMeetingsForSlot(day, hour);
              return (
                <div
                  key={`${day.toISOString()}-${hour}`}
                  className={cn(
                    'min-h-[60px] p-1 border-l relative',
                    isSameDay(day, new Date()) && 'bg-primary/5'
                  )}
                >
                  {slotMeetings.map(meeting => (
                    <TooltipProvider key={meeting.id}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => onSelectMeeting(meeting)}
                            className={cn(
                              'w-full text-left p-1.5 rounded text-xs bg-card shadow-sm hover:shadow-md transition-shadow',
                              STATUS_STYLES[meeting.status] || ''
                            )}
                          >
                            <div className="flex items-center gap-1 mb-0.5">
                              <div className={cn('w-2 h-2 rounded-full', getCloserColor(meeting.closer?.name))} />
                              <span className="font-medium truncate">
                                {format(parseISO(meeting.scheduled_at), 'HH:mm')}
                              </span>
                            </div>
                            <div className="truncate text-muted-foreground">
                              {meeting.deal?.contact?.name || meeting.deal?.name || 'Sem lead'}
                            </div>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-[250px]">
                          <div className="space-y-1">
                            <div className="font-medium">{meeting.deal?.contact?.name || meeting.deal?.name}</div>
                            <div className="text-xs text-muted-foreground">
                              Closer: {meeting.closer?.name}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {format(parseISO(meeting.scheduled_at), "dd/MM 'às' HH:mm")}
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
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="p-3 border-t bg-muted/30 flex flex-wrap gap-3">
        {Object.entries(CLOSER_COLORS).map(([name, color]) => (
          <div key={name} className="flex items-center gap-1.5 text-xs">
            <div className={cn('w-2.5 h-2.5 rounded-full', color)} />
            <span>{name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
