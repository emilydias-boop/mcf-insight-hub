import { useMemo, useCallback, useState, useEffect } from 'react';
import { format, isSameDay, parseISO, addDays, startOfWeek, startOfMonth, endOfMonth, isWithinInterval, setHours, setMinutes, eachDayOfInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { MeetingSlot, CloserWithAvailability, useUpdateMeetingSchedule } from '@/hooks/useAgendaData';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';

export type ViewMode = 'day' | 'week' | 'month';

interface AgendaCalendarProps {
  meetings: MeetingSlot[];
  selectedDate: Date;
  onSelectMeeting: (meeting: MeetingSlot) => void;
  closerFilter: string | null;
  closers?: CloserWithAvailability[];
  viewMode?: ViewMode;
}

// 30min slots from 8:00 to 18:00
const TIME_SLOTS = Array.from({ length: 20 }, (_, i) => ({
  hour: Math.floor(i / 2) + 8,
  minute: (i % 2) * 30,
  index: i,
}));

const DEFAULT_COLORS: Record<string, string> = {
  'Thayna': '#3B82F6',
  'Deisi': '#8B5CF6',
  'Leticia': '#EC4899',
  'Julio': '#22C55E',
  'Jessica Bellini': '#F97316',
};

const STATUS_STYLES: Record<string, string> = {
  scheduled: 'border-l-2 border-l-primary',
  rescheduled: 'border-l-2 border-l-yellow-500',
  completed: 'border-l-2 border-l-green-500 opacity-75',
  no_show: 'border-l-2 border-l-red-500 opacity-75',
  canceled: 'border-l-2 border-l-muted opacity-50 line-through',
};

const SLOT_HEIGHT = 40; // px per 30-min slot

export function AgendaCalendar({ 
  meetings, 
  selectedDate, 
  onSelectMeeting, 
  closerFilter, 
  closers = [],
  viewMode = 'week'
}: AgendaCalendarProps) {
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const updateSchedule = useUpdateMeetingSchedule();
  
  // Estado para horário atual (linha vermelha)
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Atualizar a cada minuto
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);
  
  // Calcular posição da linha vermelha em pixels
  const getCurrentTimePosition = useCallback(() => {
    const hour = currentTime.getHours();
    const minute = currentTime.getMinutes();
    
    if (hour < 8 || hour >= 18) return null; // Fora do horário visível
    
    // Cada slot = 40px, calcular offset
    const slotsFromStart = (hour - 8) * 2 + (minute / 30);
    return slotsFromStart * SLOT_HEIGHT;
  }, [currentTime]);
  
  const viewDays = useMemo(() => {
    if (viewMode === 'day') {
      return [selectedDate];
    } else if (viewMode === 'month') {
      const monthStart = startOfMonth(selectedDate);
      const monthEnd = endOfMonth(selectedDate);
      return eachDayOfInterval({ start: monthStart, end: monthEnd });
    }
    // week view
    return Array.from({ length: 5 }, (_, i) => addDays(weekStart, i));
  }, [selectedDate, viewMode, weekStart]);

  const filteredMeetings = useMemo(() => {
    if (!closerFilter) return meetings;
    return meetings.filter(m => m.closer_id === closerFilter);
  }, [meetings, closerFilter]);

  // Get meetings that START in this slot
  const getMeetingsStartingInSlot = useCallback((day: Date, hour: number, minute: number) => {
    return filteredMeetings.filter(meeting => {
      const meetingDate = parseISO(meeting.scheduled_at);
      return (
        isSameDay(meetingDate, day) &&
        meetingDate.getHours() === hour &&
        meetingDate.getMinutes() >= minute &&
        meetingDate.getMinutes() < minute + 30
      );
    });
  }, [filteredMeetings]);

  // Check if a slot is occupied by a meeting that started earlier
  const isSlotOccupiedByEarlierMeeting = useCallback((day: Date, hour: number, minute: number) => {
    const slotTime = setMinutes(setHours(new Date(day), hour), minute);
    
    return filteredMeetings.some(meeting => {
      const meetingStart = parseISO(meeting.scheduled_at);
      if (!isSameDay(meetingStart, day)) return false;
      
      const duration = meeting.duration_minutes || 30;
      const meetingEnd = new Date(meetingStart.getTime() + duration * 60 * 1000);
      
      // Check if this slot is covered but NOT the start slot
      return slotTime >= meetingStart && slotTime < meetingEnd && 
             !(meetingStart.getHours() === hour && 
               meetingStart.getMinutes() >= minute && 
               meetingStart.getMinutes() < minute + 30);
    });
  }, [filteredMeetings]);

  const getMeetingsForDay = (day: Date) => {
    return filteredMeetings.filter(meeting => {
      const meetingDate = parseISO(meeting.scheduled_at);
      return isSameDay(meetingDate, day);
    });
  };

  const getCloserColor = (closerId: string | undefined, closerName: string | undefined) => {
    const closer = closers.find(c => c.id === closerId);
    if (closer?.color) return closer.color;
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

  const legendItems = useMemo(() => {
    const items = closers.length > 0
      ? closers.filter(c => c.is_active).map(c => ({ name: c.name, color: c.color || DEFAULT_COLORS[c.name] || '#6B7280' }))
      : Object.entries(DEFAULT_COLORS).map(([name, color]) => ({ name, color }));
    return items;
  }, [closers]);

  // Calculate how many slots a meeting occupies
  const getSlotsNeeded = (durationMinutes: number) => {
    return Math.ceil(durationMinutes / 30);
  };

  // Handle drag and drop
  const handleDragEnd = useCallback((result: DropResult) => {
    if (!result.destination) return;
    
    const [dayISO, hour, minute] = result.destination.droppableId.split('|');
    const newDate = new Date(dayISO);
    newDate.setHours(parseInt(hour), parseInt(minute), 0, 0);
    
    updateSchedule.mutate({
      meetingId: result.draggableId,
      scheduledAt: newDate.toISOString(),
    });
  }, [updateSchedule]);

  // Month view rendering
  if (viewMode === 'month') {
    const monthStart = startOfMonth(selectedDate);
    const monthEnd = endOfMonth(selectedDate);
    const startDay = startOfWeek(monthStart, { weekStartsOn: 1 });
    const weeks: Date[][] = [];
    let currentWeek: Date[] = [];
    let day = startDay;

    while (day <= monthEnd || currentWeek.length > 0) {
      currentWeek.push(day);
      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
        if (day > monthEnd) break;
      }
      day = addDays(day, 1);
    }

    return (
      <div className="border rounded-lg overflow-hidden bg-card">
        {/* Header */}
        <div className="grid grid-cols-7 border-b bg-muted/50">
          {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map(d => (
            <div key={d} className="p-2.5 text-center text-xs font-medium text-muted-foreground">
              {d}
            </div>
          ))}
        </div>

        {/* Weeks */}
        <div className="divide-y">
          {weeks.map((week, weekIdx) => (
            <div key={weekIdx} className="grid grid-cols-7 min-h-[100px]">
              {week.map(day => {
                const dayMeetings = getMeetingsForDay(day);
                const isCurrentMonth = day.getMonth() === selectedDate.getMonth();
                const isToday = isSameDay(day, new Date());

                return (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      'p-1.5 border-l first:border-l-0 min-h-[100px]',
                      !isCurrentMonth && 'bg-muted/40 opacity-60',
                      isToday && 'bg-primary/15 ring-1 ring-inset ring-primary/30'
                    )}
                  >
                    <div className={cn(
                      'text-sm font-semibold mb-1.5 w-7 h-7 flex items-center justify-center rounded-full',
                      isToday && 'bg-primary text-primary-foreground'
                    )}>
                      {format(day, 'd')}
                    </div>
                    <div className="space-y-1">
                      {dayMeetings.slice(0, 3).map(meeting => {
                        const closerColor = getCloserColor(meeting.closer_id, meeting.closer?.name);
                        return (
                          <HoverCard key={meeting.id} openDelay={200} closeDelay={100}>
                            <HoverCardTrigger asChild>
                              <button
                                onClick={() => onSelectMeeting(meeting)}
                                className="w-full text-left text-[10px] px-1.5 py-1 rounded-sm hover:scale-[1.02] transition-transform truncate"
                                style={{ 
                                  backgroundColor: `${closerColor}20`,
                                  borderLeft: `3px solid ${closerColor}`,
                                  color: closerColor
                                }}
                              >
                                <span className="font-semibold">{format(parseISO(meeting.scheduled_at), 'HH:mm')}</span>
                                <span className="ml-1 opacity-80">{meeting.deal?.contact?.name?.split(' ')[0] || 'Lead'}</span>
                              </button>
                            </HoverCardTrigger>
                            <HoverCardContent side="right" className="w-72 p-3">
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: closerColor }} />
                                  <span className="font-semibold truncate">{meeting.deal?.contact?.name || 'Lead'}</span>
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  📅 {format(parseISO(meeting.scheduled_at), "EEEE, dd/MM 'às' HH:mm", { locale: ptBR })}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  👤 Closer: {meeting.closer?.name}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  ⏱️ Duração: {meeting.duration_minutes || 30} minutos
                                </div>
                                {meeting.deal?.contact?.phone && (
                                  <div className="text-sm text-muted-foreground">
                                    📱 {meeting.deal.contact.phone}
                                  </div>
                                )}
                                <Badge variant="outline" className="mt-1">
                                  {meeting.status === 'scheduled' && '🟢 Agendada'}
                                  {meeting.status === 'rescheduled' && '🟡 Reagendada'}
                                  {meeting.status === 'completed' && '✅ Realizada'}
                                  {meeting.status === 'no_show' && '❌ No-show'}
                                  {meeting.status === 'canceled' && '🚫 Cancelada'}
                                </Badge>
                              </div>
                            </HoverCardContent>
                          </HoverCard>
                        );
                      })}
                      {dayMeetings.length > 3 && (
                        <div className="text-[10px] text-muted-foreground pl-1 font-medium">
                          +{dayMeetings.length - 3} mais
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="p-3 border-t bg-muted/30 flex flex-wrap gap-4">
          {legendItems.map(({ name, color }) => (
            <div key={name} className="flex items-center gap-2 text-xs">
              <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: color }} />
              <span className="font-medium">{name}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Day or Week view rendering with drag-and-drop
  const gridCols = viewMode === 'day' ? 'grid-cols-[60px_1fr]' : 'grid-cols-[60px_repeat(5,1fr)]';
  const currentTimePos = getCurrentTimePosition();

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="border rounded-lg overflow-hidden bg-card">
        {/* Time slots grid - 30min intervals with sticky header */}
        <div className="max-h-[600px] overflow-y-auto relative">
          {/* Header with days - sticky inside scroll container */}
          <div className={cn('grid border-b bg-muted/50 sticky top-0 z-20', gridCols)}>
            <div className="min-w-[60px] w-[60px] flex-shrink-0 h-[52px] flex items-center justify-center text-xs font-medium text-muted-foreground border-r bg-muted/30">
              Hora
            </div>
            {viewDays.map(day => (
              <div
                key={day.toISOString()}
                className={cn(
                  'h-[52px] flex flex-col items-center justify-center border-l bg-muted/50',
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

          {/* Linha vermelha do horário atual - offset by header height (52px) */}
          {currentTimePos !== null && viewDays.some(d => isSameDay(d, currentTime)) && (
            <div 
              className="absolute left-[60px] right-0 z-30 pointer-events-none flex items-center"
              style={{ top: `${currentTimePos + 52}px` }}
            >
              <div className="w-3 h-3 rounded-full bg-destructive -ml-1.5 shadow-md border-2 border-background" />
              <div className="flex-1 h-[2px] bg-destructive shadow-sm" />
            </div>
          )}
          
          {TIME_SLOTS.map(({ hour, minute }) => (
            <div
              key={`${hour}-${minute}`}
              className={cn(
                'grid border-b last:border-b-0',
                gridCols,
                minute === 0 && 'border-t border-t-border/50'
              )}
            >
              <div className={cn(
                'min-w-[60px] w-[60px] flex-shrink-0 h-[40px] flex items-center justify-center text-xs text-muted-foreground border-r bg-muted/30',
                minute === 30 && 'text-muted-foreground/60'
              )}>
                {`${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`}
              </div>
              {viewDays.map(day => {
                const slotMeetings = getMeetingsStartingInSlot(day, hour, minute);
                const isOccupied = isSlotOccupiedByEarlierMeeting(day, hour, minute);
                const isCurrent = isCurrentTimeSlot(day, hour, minute);
                const droppableId = `${day.toISOString()}|${hour}|${minute}`;

                return (
                  <Droppable key={droppableId} droppableId={droppableId}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={cn(
                          'h-[40px] border-l relative',
                          isSameDay(day, new Date()) && 'bg-primary/5',
                          isCurrent && 'bg-primary/15 ring-1 ring-primary/30',
                          snapshot.isDraggingOver && 'bg-primary/20',
                          isOccupied && 'pointer-events-none'
                        )}
                      >
                        {slotMeetings.map((meeting, index) => {
                          const closerColor = getCloserColor(meeting.closer_id, meeting.closer?.name);
                          const slotsNeeded = getSlotsNeeded(meeting.duration_minutes || 30);
                          const cardHeight = SLOT_HEIGHT * slotsNeeded - 4;

                          return (
                            <Draggable key={meeting.id} draggableId={meeting.id} index={index}>
                              {(dragProvided, dragSnapshot) => (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <button
                                        ref={dragProvided.innerRef}
                                        {...dragProvided.draggableProps}
                                        {...dragProvided.dragHandleProps}
                                        onClick={() => onSelectMeeting(meeting)}
                                        className={cn(
                                          'absolute left-0.5 right-0.5 top-0.5 text-left p-1 rounded text-xs bg-card shadow-sm hover:shadow-md transition-all overflow-hidden z-10',
                                          STATUS_STYLES[meeting.status] || '',
                                          dragSnapshot.isDragging && 'shadow-lg ring-2 ring-primary'
                                        )}
                                        style={{ 
                                          height: `${cardHeight}px`,
                                          borderLeftColor: closerColor,
                                          ...dragProvided.draggableProps.style,
                                        }}
                                      >
                                        <div className="flex items-center gap-1">
                                          <div
                                            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                            style={{ backgroundColor: closerColor }}
                                          />
                                          <span className="font-medium truncate text-[10px]">
                                            {format(parseISO(meeting.scheduled_at), 'HH:mm')}
                                          </span>
                                        </div>
                                        <div className="truncate text-muted-foreground text-[9px]">
                                          {meeting.deal?.contact?.name || meeting.deal?.name || 'Sem lead'}
                                        </div>
                                        {slotsNeeded > 1 && (
                                          <div className="text-[8px] text-muted-foreground mt-0.5">
                                            {meeting.duration_minutes}min
                                          </div>
                                        )}
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
                                          {format(parseISO(meeting.scheduled_at), "dd/MM 'às' HH:mm")} ({meeting.duration_minutes || 30}min)
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
                              )}
                            </Draggable>
                          );
                        })}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                );
              })}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="p-3 border-t bg-muted/30 flex flex-wrap gap-3">
          {legendItems.map(({ name, color }) => (
            <div key={name} className="flex items-center gap-1.5 text-xs">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
              <span>{name}</span>
            </div>
          ))}
        </div>
      </div>
    </DragDropContext>
  );
}
