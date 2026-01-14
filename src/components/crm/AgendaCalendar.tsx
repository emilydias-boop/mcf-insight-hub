import { useMemo, useCallback, useState, useEffect, useRef } from 'react';
import { format, isSameDay, parseISO, addDays, startOfWeek, startOfMonth, endOfMonth, isWithinInterval, setHours, setMinutes, eachDayOfInterval, isAfter } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { WEEK_STARTS_ON } from '@/lib/businessDays';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { MeetingSlot, CloserWithAvailability, useUpdateMeetingSchedule } from '@/hooks/useAgendaData';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { useUniqueSlotsForDays } from '@/hooks/useCloserMeetingLinks';

export type ViewMode = 'day' | 'week' | 'month';

interface AgendaCalendarProps {
  meetings: MeetingSlot[];
  selectedDate: Date;
  onSelectMeeting: (meeting: MeetingSlot) => void;
  closerFilter: string | null;
  closers?: CloserWithAvailability[];
  viewMode?: ViewMode;
  onEditHours?: () => void;
  onSelectSlot?: (day: Date, hour: number, minute: number, closerId?: string) => void;
}

// Default fallback values
const DEFAULT_START_HOUR = 8;
const DEFAULT_END_HOUR = 18;

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
  contract_paid: 'border-l-2 border-l-emerald-600 opacity-75',
};

const SLOT_HEIGHT = 40; // px per 30-min slot
const MAX_MEETINGS_PER_SLOT = 999; // No limit on meetings per slot

import { Settings, Plus, ArrowRightLeft } from 'lucide-react';

export function AgendaCalendar({ 
  meetings, 
  selectedDate, 
  onSelectMeeting, 
  closerFilter, 
  closers = [],
  onEditHours,
  viewMode = 'week',
  onSelectSlot
}: AgendaCalendarProps) {
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: WEEK_STARTS_ON });
  const updateSchedule = useUpdateMeetingSchedule();
  
  // Estado para horário atual (linha vermelha)
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Atualizar a cada minuto
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Get days of week that will be displayed in this view
  // Semana customizada: Sáb(6), Seg(1), Ter(2), Qua(3), Qui(4), Sex(5) - sem Domingo(0)
  const daysOfWeekInView = useMemo(() => {
    const days = viewMode === 'day' 
      ? [selectedDate.getDay()]
      : viewMode === 'month'
        ? [0, 1, 2, 3, 4, 5, 6] // All days for month view
        : [6, 1, 2, 3, 4, 5]; // Sáb=6, Seg=1, Ter=2, Qua=3, Qui=4, Sex=5 (sem Dom=0)
    return days;
  }, [selectedDate, viewMode]);

  // Fetch actual meeting link slots from closer_meeting_links table
  const { data: meetingLinkSlots } = useUniqueSlotsForDays(daysOfWeekInView);

  // Calculate dynamic time slots based on closer_meeting_links data
  const timeSlots = useMemo(() => {
    let minHour = DEFAULT_END_HOUR;
    let maxHour = DEFAULT_START_HOUR;

    // Use real time slots from closer_meeting_links
    if (meetingLinkSlots) {
      for (const dayOfWeek of Object.keys(meetingLinkSlots)) {
        const slots = meetingLinkSlots[Number(dayOfWeek)];
        for (const slot of slots || []) {
          const [hourStr, minuteStr] = slot.time.split(':');
          const hour = parseInt(hourStr);
          const minute = parseInt(minuteStr);
          minHour = Math.min(minHour, hour);
          // Add 30 min for the slot duration, then round up to next hour for display
          const slotEndMinutes = hour * 60 + minute + 30;
          const slotEndHour = Math.ceil(slotEndMinutes / 60);
          maxHour = Math.max(maxHour, slotEndHour);
        }
      }
    }

    // Fallback if no slots found
    if (minHour >= maxHour) {
      minHour = DEFAULT_START_HOUR;
      maxHour = DEFAULT_END_HOUR;
    }

    const totalSlots = (maxHour - minHour) * 4;
    return Array.from({ length: totalSlots }, (_, i) => ({
      hour: Math.floor(i / 4) + minHour,
      minute: (i % 4) * 15,
      index: i,
    }));
  }, [meetingLinkSlots]);
  
  // Calcular posição da linha vermelha em pixels (depends on timeSlots)
  const getCurrentTimePosition = useCallback(() => {
    if (timeSlots.length === 0) return null;
    
    const hour = currentTime.getHours();
    const minute = currentTime.getMinutes();
    const minHour = timeSlots[0].hour;
    const lastSlot = timeSlots[timeSlots.length - 1];
    const maxHour = lastSlot.hour + ((lastSlot.minute + 15) / 60);
    
    if (hour < minHour || hour >= maxHour) return null;
    
    // Cada slot = 40px, calcular offset (4 slots por hora com intervalo de 15min)
    const slotsFromStart = (hour - minHour) * 4 + (minute / 15);
    return slotsFromStart * SLOT_HEIGHT;
  }, [currentTime, timeSlots]);
  
  const viewDays = useMemo(() => {
    if (viewMode === 'day') {
      return [selectedDate];
    } else if (viewMode === 'month') {
      const monthStart = startOfMonth(selectedDate);
      const monthEnd = endOfMonth(selectedDate);
      return eachDayOfInterval({ start: monthStart, end: monthEnd });
    }
    // Semana de trabalho: Sáb, Seg, Ter, Qua, Qui, Sex (pular Domingo)
    // weekStart = Sábado (dia 0 da semana customizada)
    return [
      addDays(weekStart, 0), // Sábado
      addDays(weekStart, 2), // Segunda (pular domingo que seria dia 1)
      addDays(weekStart, 3), // Terça
      addDays(weekStart, 4), // Quarta
      addDays(weekStart, 5), // Quinta
      addDays(weekStart, 6), // Sexta
    ];
  }, [selectedDate, viewMode, weekStart]);

  const filteredMeetings = useMemo(() => {
    if (!closerFilter) return meetings;
    return meetings.filter(m => m.closer_id === closerFilter);
  }, [meetings, closerFilter]);

  // Get meetings that START in this slot, grouped by closer
  const getMeetingsStartingInSlot = useCallback((day: Date, hour: number, minute: number) => {
    return filteredMeetings.filter(meeting => {
      const meetingDate = parseISO(meeting.scheduled_at);
      return (
        isSameDay(meetingDate, day) &&
        meetingDate.getHours() === hour &&
        meetingDate.getMinutes() >= minute &&
        meetingDate.getMinutes() < minute + 15
      );
    });
  }, [filteredMeetings]);

  // Group meetings by slot+closer for display
  const getGroupedMeetingsInSlot = useCallback((day: Date, hour: number, minute: number) => {
    const slotMeetings = getMeetingsStartingInSlot(day, hour, minute);
    
    // Group by closer_id
    const groupedByCloser = slotMeetings.reduce((acc, meeting) => {
      const closerId = meeting.closer_id || 'unknown';
      if (!acc[closerId]) {
        acc[closerId] = [];
      }
      acc[closerId].push(meeting);
      return acc;
    }, {} as Record<string, MeetingSlot[]>);
    
    return Object.entries(groupedByCloser).map(([closerId, meetings]) => ({
      closerId,
      meetings,
      closer: meetings[0].closer,
      duration: meetings[0].duration_minutes || 30,
    }));
  }, [getMeetingsStartingInSlot]);

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
               meetingStart.getMinutes() < minute + 15);
    });
  }, [filteredMeetings]);

  // Get the meeting that covers a specific slot (for clicks on occupied slots)
  const getMeetingCoveringSlot = useCallback((day: Date, hour: number, minute: number): MeetingSlot | null => {
    const slotTime = setMinutes(setHours(new Date(day), hour), minute);
    
    for (const meeting of filteredMeetings) {
      const meetingStart = parseISO(meeting.scheduled_at);
      if (!isSameDay(meetingStart, day)) continue;
      
      const duration = meeting.duration_minutes || 30;
      const meetingEnd = new Date(meetingStart.getTime() + duration * 60 * 1000);
      
      // Check if this slot is within the meeting's duration
      if (slotTime >= meetingStart && slotTime < meetingEnd) {
        return meeting;
      }
    }
    return null;
  }, [filteredMeetings]);

  // Calculate slot occupancy - how many meetings per closer per time slot
  const getSlotOccupancy = useCallback((day: Date, hour: number, minute: number, closerId?: string) => {
    const slotMeetings = filteredMeetings.filter(meeting => {
      const meetingDate = parseISO(meeting.scheduled_at);
      const matchesTime = isSameDay(meetingDate, day) &&
        meetingDate.getHours() === hour &&
        meetingDate.getMinutes() >= minute &&
        meetingDate.getMinutes() < minute + 15;
      
      if (closerId) {
        return matchesTime && meeting.closer_id === closerId;
      }
      return matchesTime;
    });
    
    return {
      count: slotMeetings.length,
      isFull: slotMeetings.length >= MAX_MEETINGS_PER_SLOT,
    };
  }, [filteredMeetings]);

  // Check if slot is full for ANY closer (used for time column display)
  const isSlotFullForAnyCloser = useCallback((day: Date, hour: number, minute: number) => {
    // Group meetings by closer for this slot
    const slotMeetings = filteredMeetings.filter(meeting => {
      const meetingDate = parseISO(meeting.scheduled_at);
      return isSameDay(meetingDate, day) &&
        meetingDate.getHours() === hour &&
        meetingDate.getMinutes() >= minute &&
        meetingDate.getMinutes() < minute + 15;
    });
    
    // Count per closer
    const countByCloser: Record<string, number> = {};
    slotMeetings.forEach(m => {
      const cid = m.closer_id || 'unknown';
      countByCloser[cid] = (countByCloser[cid] || 0) + 1;
    });
    
    // Check if any closer has reached max
    return Object.values(countByCloser).some(count => count >= MAX_MEETINGS_PER_SLOT);
  }, [filteredMeetings]);

  // Check if slot is configured (has available closer hours) for at least one closer
  const isSlotConfigured = useCallback((day: Date, hour: number, minute: number) => {
    const dayOfWeek = day.getDay() === 0 ? 7 : day.getDay();
    const slots = meetingLinkSlots?.[dayOfWeek] || [];
    const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    return slots.some(s => s.time === timeStr);
  }, [meetingLinkSlots]);

  // Check if slot is available (configured and no meetings)
  const isSlotAvailable = useCallback((day: Date, hour: number, minute: number) => {
    if (!isSlotConfigured(day, hour, minute)) return false;
    const slotMeetings = filteredMeetings.filter(meeting => {
      const meetingDate = parseISO(meeting.scheduled_at);
      return isSameDay(meetingDate, day) &&
        meetingDate.getHours() === hour &&
        meetingDate.getMinutes() >= minute &&
        meetingDate.getMinutes() < minute + 15;
    });
    return slotMeetings.length === 0;
  }, [isSlotConfigured, filteredMeetings]);

  // Get available closers for a specific slot (configured and without meetings at that time)
  const getAvailableClosersForSlot = useCallback((day: Date, hour: number, minute: number) => {
    const dayOfWeek = day.getDay() === 0 ? 7 : day.getDay();
    const slots = meetingLinkSlots?.[dayOfWeek] || [];
    const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    
    // Find closerIds configured for this time
    const configuredSlot = slots.find(s => s.time === timeStr);
    const configuredCloserIds = configuredSlot?.closerIds || [];
    
    // Filter out closers that already have a meeting at this exact time
    return configuredCloserIds.filter(closerId => {
      const slotTime = setMinutes(setHours(new Date(day), hour), minute);
      
      // Check if this closer has any meeting covering this slot
      const hasMeeting = filteredMeetings.some(meeting => {
        if (meeting.closer_id !== closerId) return false;
        
        const meetingStart = parseISO(meeting.scheduled_at);
        if (!isSameDay(meetingStart, day)) return false;
        
        const duration = meeting.duration_minutes || 30;
        const meetingEnd = new Date(meetingStart.getTime() + duration * 60 * 1000);
        
        return slotTime >= meetingStart && slotTime < meetingEnd;
      });
      
      return !hasMeeting;
    });
  }, [meetingLinkSlots, filteredMeetings]);

  const getMeetingsForDay = (day: Date) => {
    return filteredMeetings.filter(meeting => {
      const meetingDate = parseISO(meeting.scheduled_at);
      return isSameDay(meetingDate, day);
    });
  };

  // Get all unique closers with meetings on a specific day (for fixed column layout)
  const getActiveClosersForDay = useCallback((day: Date) => {
    const dayMeetings = filteredMeetings.filter(m => 
      isSameDay(parseISO(m.scheduled_at), day)
    );
    const uniqueCloserIds = [...new Set(dayMeetings.map(m => m.closer_id).filter(Boolean))] as string[];
    return uniqueCloserIds.sort(); // Consistent alphabetical order
  }, [filteredMeetings]);

  // Calculate fixed column position for a closer on a specific day
  const getCloserColumnPosition = useCallback((day: Date, closerId: string | undefined) => {
    if (!closerId) {
      return { widthPercent: 100, leftPercent: 0, totalClosers: 1 };
    }
    const activeClosers = getActiveClosersForDay(day);
    const totalClosers = activeClosers.length || 1;
    const columnIndex = activeClosers.indexOf(closerId);
    
    return {
      widthPercent: 100 / totalClosers,
      leftPercent: columnIndex >= 0 ? (columnIndex * 100 / totalClosers) : 0,
      totalClosers
    };
  }, [getActiveClosersForDay]);

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
    const slotEnd = setMinutes(setHours(day, hour), minute + 15);
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
    const startDay = startOfWeek(monthStart, { weekStartsOn: WEEK_STARTS_ON });
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
                                <span className="ml-1 opacity-80">
                                  {meeting.attendees?.length 
                                    ? meeting.attendees.length > 1
                                      ? `${(meeting.attendees[0].attendee_name || meeting.attendees[0].contact?.name || meeting.attendees[0].deal?.name || meeting.deal?.name || 'Lead').split(' ')[0]} +${meeting.attendees.length - 1}`
                                      : (meeting.attendees[0].attendee_name || meeting.attendees[0].contact?.name || meeting.attendees[0].deal?.name || meeting.deal?.name || 'Lead').split(' ')[0]
                                    : meeting.deal?.contact?.name?.split(' ')[0] || meeting.deal?.name?.split(' ')[0] || 'Lead'}
                                </span>
                              </button>
                            </HoverCardTrigger>
                            <HoverCardContent side="right" className="w-80 p-3">
                              <div className="space-y-3">
                                {/* Header com SDR e Closer */}
                                <div className="flex justify-between text-xs border-b pb-2">
                                  <div className="flex items-center gap-1">
                                    <span className="text-muted-foreground">SDR:</span>
                                    <span className="font-medium">{meeting.booked_by_profile?.full_name || 'N/A'}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <span className="text-muted-foreground">Closer:</span>
                                    <span className="font-medium">{meeting.closer?.name || 'N/A'}</span>
                                  </div>
                                </div>
                                
                                {/* Lista de participantes com status individual */}
                                <div className="space-y-2">
                                  <div className="font-semibold text-sm">Participantes:</div>
                                  {meeting.attendees?.length ? (
                                    <div className="space-y-1.5">
                                      {meeting.attendees.map(att => (
                                        <div key={att.id} className="flex items-center justify-between p-2 rounded bg-muted/30">
                                          <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: closerColor }} />
                                            <span className="text-sm">{att.attendee_name || att.contact?.name || att.deal?.name || 'Lead'}</span>
                                            {att.is_partner && <Badge variant="outline" className="text-[9px] px-1 py-0">Sócio</Badge>}
                                          </div>
                                          <div>
                                            {att.status === 'no_show' && <Badge variant="destructive" className="text-[9px]">No-show</Badge>}
                                            {att.status === 'completed' && <Badge className="text-[9px] bg-green-600">Compareceu</Badge>}
                                            {att.status === 'invited' && <Badge variant="secondary" className="text-[9px]">Convidado</Badge>}
                                            {att.status === 'confirmed' && <Badge variant="secondary" className="text-[9px]">Confirmado</Badge>}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-2 p-2 rounded bg-muted/30">
                                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: closerColor }} />
                                      <span className="text-sm">{meeting.deal?.contact?.name || 'Lead'}</span>
                                    </div>
                                  )}
                                </div>
                                
                                {/* Info da reunião */}
                                <div className="text-xs text-muted-foreground space-y-1 pt-1 border-t">
                                  <div>📅 {format(parseISO(meeting.scheduled_at), "EEEE, dd/MM 'às' HH:mm", { locale: ptBR })}</div>
                                  <div>⏱️ Duração: {meeting.duration_minutes || 30} minutos</div>
                                </div>
                                
                                <Badge variant="outline" className="mt-1">
                                  {meeting.status === 'scheduled' && '🟢 Agendada'}
                                  {meeting.status === 'rescheduled' && '🟡 Reagendada'}
                                  {meeting.status === 'completed' && '✅ Realizada'}
                                  {meeting.status === 'no_show' && '❌ No-show'}
                                  {meeting.status === 'canceled' && '🚫 Cancelada'}
                                  {meeting.status === 'contract_paid' && '💰 Contrato Pago'}
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
  const gridCols = viewMode === 'day' ? 'grid-cols-[60px_1fr]' : 'grid-cols-[60px_repeat(6,1fr)]';
  const currentTimePos = getCurrentTimePosition();
  
  // Ref for scroll container
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll to first meeting or current time
  useEffect(() => {
    if (!scrollContainerRef.current || timeSlots.length === 0) return;
    
    const now = new Date();
    const isToday = viewDays.some(d => isSameDay(d, now));
    
    // Find first upcoming meeting
    const targetMeeting = filteredMeetings
      .filter(m => {
        const meetingDate = parseISO(m.scheduled_at);
        // For today, only consider future meetings
        if (isSameDay(meetingDate, now)) return isAfter(meetingDate, now);
        // For other days, include all
        return viewDays.some(d => isSameDay(d, meetingDate));
      })
      .sort((a, b) => parseISO(a.scheduled_at).getTime() - parseISO(b.scheduled_at).getTime())[0];
    
    let targetSlotIndex = -1;
    
    if (targetMeeting) {
      // Scroll to first meeting
      const meetingTime = parseISO(targetMeeting.scheduled_at);
      const meetingHour = meetingTime.getHours();
      const meetingMinute = Math.floor(meetingTime.getMinutes() / 15) * 15;
      targetSlotIndex = timeSlots.findIndex(
        slot => slot.hour === meetingHour && slot.minute === meetingMinute
      );
    } else if (isToday) {
      // For today without upcoming meetings, scroll to current time
      const currentHour = now.getHours();
      const currentMinute = Math.floor(now.getMinutes() / 15) * 15;
      targetSlotIndex = timeSlots.findIndex(
        slot => slot.hour >= currentHour && (slot.hour > currentHour || slot.minute >= currentMinute)
      );
    }
    
    if (targetSlotIndex > 0) {
      // Scroll with some margin (3 slots above) and account for sticky header (52px)
      const scrollPosition = Math.max(0, (targetSlotIndex - 3) * SLOT_HEIGHT);
      scrollContainerRef.current.scrollTop = scrollPosition;
    }
  }, [filteredMeetings, timeSlots, viewDays]);

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="border rounded-lg overflow-hidden bg-card">
        {/* Time slots grid - 30min intervals with sticky header */}
        <div ref={scrollContainerRef} className="max-h-[600px] overflow-y-auto relative">
          {/* Header with days - sticky inside scroll container */}
          <div className={cn('grid border-b bg-muted/50 sticky top-0 z-20', gridCols)}>
            <div className="min-w-[60px] w-[60px] flex-shrink-0 h-[52px] flex flex-col items-center justify-center text-xs font-medium text-muted-foreground border-r bg-muted/30 gap-0.5">
              <span>Hora</span>
              {onEditHours && (
                <button
                  onClick={onEditHours}
                  className="hover:bg-muted-foreground/20 rounded p-0.5 transition-colors"
                  title="Editar horários"
                >
                  <Settings className="h-3 w-3" />
                </button>
              )}
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
          
          {timeSlots.map(({ hour, minute }) => {
            // Check if this time slot is full for any closer across all days
            const anyDayFull = viewDays.some(day => isSlotFullForAnyCloser(day, hour, minute));
            
            return (
              <div
                key={`${hour}-${minute}`}
                className={cn(
                  'grid border-b last:border-b-0',
                  gridCols,
                  minute === 0 && 'border-t border-t-border/50'
                )}
              >
                  <div 
                    className={cn(
                      'min-w-[60px] w-[60px] flex-shrink-0 h-[40px] flex items-center justify-center text-xs border-r bg-muted/30',
                      (minute === 15 || minute === 45) && 'text-muted-foreground/60',
                      anyDayFull ? 'line-through text-muted-foreground/40' : 'text-muted-foreground',
                      onEditHours && 'cursor-pointer hover:bg-muted/50 hover:text-foreground transition-colors'
                    )}
                    onClick={onEditHours}
                    title={onEditHours ? "Clique para editar horários" : undefined}
                  >
                    {`${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`}
                  </div>
                {viewDays.map(day => {
                  const groupedSlots = getGroupedMeetingsInSlot(day, hour, minute);
                  const isOccupied = isSlotOccupiedByEarlierMeeting(day, hour, minute);
                  const isCurrent = isCurrentTimeSlot(day, hour, minute);
                  const droppableId = `${day.toISOString()}|${hour}|${minute}`;
                  
                  // Check if THIS specific slot is full
                  const slotOccupancy = getSlotOccupancy(day, hour, minute);
                  const isSlotFull = slotOccupancy.isFull;

                  return (
                    <Droppable 
                      key={droppableId} 
                      droppableId={droppableId}
                      isDropDisabled={isSlotFull}
                    >
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          onClick={() => {
                            // If slot is occupied by an earlier meeting, open that meeting
                            if (isOccupied) {
                              const coveringMeeting = getMeetingCoveringSlot(day, hour, minute);
                              if (coveringMeeting) {
                                onSelectMeeting(coveringMeeting);
                              }
                            }
                          }}
                          className={cn(
                            'h-[40px] border-l relative overflow-visible',
                            isSameDay(day, new Date()) && 'bg-primary/5',
                            isCurrent && 'bg-primary/15 ring-1 ring-primary/30',
                            snapshot.isDraggingOver && !isSlotFull && 'bg-primary/20',
                            isOccupied && 'cursor-pointer',
                            isSlotFull && 'bg-muted/40',
                            // Highlight available slots (configured but no meetings)
                            isSlotAvailable(day, hour, minute) && !isOccupied && groupedSlots.length === 0 && 'bg-white/80 dark:bg-white/5'
                          )}
                        >
                          {/* Available slot indicators - one button per available closer */}
                          {!isOccupied && groupedSlots.length === 0 && onSelectSlot && (() => {
                            const availableClosers = getAvailableClosersForSlot(day, hour, minute);
                            if (availableClosers.length === 0) return null;
                            
                            return (
                              <div className="absolute inset-0.5 flex flex-wrap gap-0.5 p-0.5 overflow-hidden">
                                {availableClosers.map(closerId => {
                                  const closer = closers.find(c => c.id === closerId);
                                  const closerColor = getCloserColor(closerId, closer?.name);
                                  const firstName = closer?.name?.split(' ')[0] || 'Closer';
                                  
                                  return (
                                    <button
                                      key={closerId}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onSelectSlot(day, hour, minute, closerId);
                                      }}
                                      className="flex-1 min-w-[45%] rounded text-[9px] font-medium flex items-center justify-center gap-0.5 border border-dashed hover:opacity-80 transition-all"
                                      style={{ 
                                        backgroundColor: `${closerColor}15`,
                                        borderColor: closerColor,
                                        color: closerColor
                                      }}
                                    >
                                      <Plus className="h-3 w-3" />
                                      {firstName}
                                    </button>
                                  );
                                })}
                              </div>
                            );
                          })()}
                          {groupedSlots.map((group, groupIndex) => {
                            const closerColor = getCloserColor(group.closerId, group.closer?.name);
                            const slotsNeeded = getSlotsNeeded(group.duration);
                            const cardHeight = SLOT_HEIGHT * slotsNeeded - 4;
                            // Use fixed columns per closer for the entire day (prevents overlap)
                            const { widthPercent, leftPercent, totalClosers } = getCloserColumnPosition(day, group.closerId);
                            
                            // All meetings in this group
                            const meetings = group.meetings;
                            const firstMeeting = meetings[0];
                            const leadNames = meetings.map(m => {
                              if (m.attendees?.length) {
                                const firstName = (m.attendees[0].attendee_name || m.attendees[0].contact?.name || m.attendees[0].deal?.name || m.deal?.name || 'Lead').split(' ')[0];
                                return m.attendees.length > 1 ? `${firstName} +${m.attendees.length - 1}` : firstName;
                              }
                              return m.deal?.contact?.name?.split(' ')[0] || m.deal?.name?.split(' ')[0] || 'Lead';
                            }).join(', ');

                            return (
                              <Draggable 
                                key={firstMeeting.id} 
                                draggableId={firstMeeting.id} 
                                index={groupIndex}
                              >
                                {(dragProvided, dragSnapshot) => (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <button
                                          ref={dragProvided.innerRef}
                                          {...dragProvided.draggableProps}
                                          {...dragProvided.dragHandleProps}
                                          onClick={() => onSelectMeeting(firstMeeting)}
                                          className={cn(
                                            'absolute top-0.5 text-left p-1 rounded text-xs bg-card shadow-sm hover:shadow-md transition-all overflow-hidden z-10',
                                            STATUS_STYLES[firstMeeting.status] || '',
                                            dragSnapshot.isDragging && 'shadow-lg ring-2 ring-primary'
                                          )}
                                          style={{ 
                                            height: `${cardHeight}px`,
                                            borderLeftColor: closerColor,
                                            left: totalClosers > 1 ? `calc(${leftPercent}% + 2px)` : '2px',
                                            right: totalClosers > 1 ? `calc(${100 - leftPercent - widthPercent}% + 2px)` : '2px',
                                            ...dragProvided.draggableProps.style,
                                          }}
                                        >
                                          {/* Header: Apenas Horário */}
                                          <div className="flex items-center gap-1 mb-0.5">
                                            <div
                                              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                              style={{ backgroundColor: closerColor }}
                                            />
                                            <span className="font-medium text-[10px]">
                                              {format(parseISO(firstMeeting.scheduled_at), 'HH:mm')}
                                            </span>
                                          </div>

                                          {/* Lista de participantes com SDR individual */}
                                          <div className="space-y-0.5">
                                            {(() => {
                                              // Flatten meetings com seus attendees - usar o SDR do attendee individual, com fallback para o SDR do meeting
                                              const attendeesWithMeeting = meetings.flatMap(m => 
                                                (m.attendees || []).map(att => ({ 
                                                  ...att, 
                                                  meetingSdr: att.booked_by_profile?.full_name || m.booked_by_profile?.full_name 
                                                }))
                                              );
                                              const displayAttendees = attendeesWithMeeting.slice(0, 3);
                                              const remaining = attendeesWithMeeting.length - 3;
                                              
                                              return (
                                                <>
                                                  {displayAttendees.map(att => (
                                                    <div key={att.id} className="flex items-center justify-between gap-1">
                                                      <div className="flex items-center gap-1 min-w-0">
                                                        <div className="w-1 h-1 rounded-full flex-shrink-0" style={{ backgroundColor: closerColor }} />
                                                        <span className="text-[9px] truncate">
                                                          {(att.attendee_name || att.contact?.name || att.deal?.name || 'Lead').split(' ')[0]}
                                                        </span>
                                                        {att.is_partner && <span className="text-[7px] text-muted-foreground">(S)</span>}
                                                        {!att.is_partner && att.parent_attendee_id && <ArrowRightLeft className="h-2 w-2 text-orange-500" />}
                                                        <span className="text-[7px] text-muted-foreground truncate">
                                                          ({att.meetingSdr?.split(' ')[0] || 'N/A'})
                                                        </span>
                                                      </div>
                                                      <div className="flex items-center gap-0.5 flex-shrink-0">
                                                        {att.already_builds === true && (
                                                          <Badge className="text-[6px] px-0.5 py-0 h-2.5 bg-blue-600">C</Badge>
                                                        )}
                                                        {att.already_builds === false && (
                                                          <Badge variant="outline" className="text-[6px] px-0.5 py-0 h-2.5 border-orange-500 text-orange-600">NC</Badge>
                                                        )}
                                                        {att.status === 'no_show' && <Badge variant="destructive" className="text-[7px] px-1 py-0 h-3">No-show</Badge>}
                                                        {att.status === 'completed' && <Badge className="text-[7px] px-1 py-0 h-3 bg-green-600">OK</Badge>}
                                                        {att.status === 'invited' && <Badge variant="secondary" className="text-[7px] px-1 py-0 h-3">Agendado</Badge>}
                                                        {att.status === 'confirmed' && <Badge variant="outline" className="text-[7px] px-1 py-0 h-3">Confirmado</Badge>}
                                                      </div>
                                                    </div>
                                                  ))}
                                                  {remaining > 0 && (
                                                    <span className="text-[8px] text-muted-foreground">+{remaining} mais</span>
                                                  )}
                                                </>
                                              );
                                            })()}
                                          </div>

                                          {/* Duração */}
                                          {slotsNeeded > 1 && (
                                            <div className="text-[8px] text-muted-foreground mt-0.5">
                                              {group.duration}min
                                            </div>
                                          )}
                                        </button>
                                      </TooltipTrigger>
                                        <TooltipContent side="right" className="max-w-[320px]">
                                        <div className="space-y-2">
                                          {/* Header com Closer */}
                                          <div className="flex justify-between text-xs border-b pb-1.5 mb-1.5">
                                            <span>Closer: <strong>{group.closer?.name || 'N/A'}</strong></span>
                                            <span>{meetings.length} reunião(ões)</span>
                                          </div>
                                          
                                          <div className="font-medium">
                                            {format(parseISO(firstMeeting.scheduled_at), 'HH:mm')} - {group.duration}min
                                          </div>
                                          
                                          {/* Participantes agrupados por SDR */}
                                          <div className="space-y-2 mt-2">
                                            {(() => {
                                              type AttendeeWithSdr = {
                                                id: string;
                                                attendee_name: string;
                                                status: string;
                                                is_partner: boolean;
                                                already_builds: boolean | null;
                                                contact?: { id: string; name: string; phone: string; email: string } | null;
                                                sdrName: string;
                                                sdrId: string;
                                              };
                                              
                                              // Flatten all attendees with their SDR info
                                              const allAttendees: AttendeeWithSdr[] = meetings.flatMap(m => 
                                                (m.attendees && m.attendees.length > 0) 
                                                  ? m.attendees.map(att => ({
                                                      id: att.id,
                                                      attendee_name: att.attendee_name || '',
                                                      status: att.status,
                                                      is_partner: att.is_partner,
                                                      already_builds: att.already_builds,
                                                      contact: att.contact,
                                                      sdrName: att.booked_by_profile?.full_name || m.booked_by_profile?.full_name || 'N/A',
                                                      sdrId: att.booked_by || m.booked_by || 'unknown'
                                                    }))
                                                  : [{
                                                      id: m.id,
                                                      attendee_name: m.deal?.contact?.name || m.deal?.name || 'Lead',
                                                      status: m.status,
                                                      is_partner: false,
                                                      already_builds: null,
                                                      contact: m.deal?.contact,
                                                      sdrName: m.booked_by_profile?.full_name || 'N/A',
                                                      sdrId: m.booked_by || 'unknown'
                                                    }]
                                              );
                                              
                                              // Group by SDR
                                              const groupedBySdr = allAttendees.reduce((acc, att) => {
                                                const key = att.sdrId;
                                                if (!acc[key]) {
                                                  acc[key] = { sdrName: att.sdrName, attendees: [] as AttendeeWithSdr[] };
                                                }
                                                acc[key].attendees.push(att);
                                                return acc;
                                              }, {} as Record<string, { sdrName: string; attendees: AttendeeWithSdr[] }>);
                                              
                                              return Object.entries(groupedBySdr).map(([sdrId, sdrGroup]) => (
                                                <div key={sdrId} className="space-y-1">
                                                  <div className="text-[10px] text-muted-foreground border-b pb-0.5">
                                                    SDR: {sdrGroup.sdrName}
                                                  </div>
                                                  {sdrGroup.attendees.map(att => (
                                                    <div key={att.id} className="text-xs p-1.5 bg-muted/50 rounded flex items-center justify-between">
                                                      <div className="flex items-center gap-1.5">
                                                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: closerColor }} />
                                                        <span>{att.attendee_name || att.contact?.name || 'Lead'}</span>
                                                        {att.is_partner && <Badge variant="outline" className="text-[8px] px-1 py-0">Sócio</Badge>}
                                                        {att.already_builds === true && (
                                                          <Badge className="text-[8px] px-1 py-0 bg-blue-600">Constrói</Badge>
                                                        )}
                                                        {att.already_builds === false && (
                                                          <Badge variant="outline" className="text-[8px] px-1 py-0 border-orange-500 text-orange-600">Não Constrói</Badge>
                                                        )}
                                                      </div>
                                                      <div>
                                                        {att.status === 'no_show' && <Badge variant="destructive" className="text-[8px]">No-show</Badge>}
                                                        {att.status === 'completed' && <Badge className="text-[8px] bg-green-600">OK</Badge>}
                                                        {att.status === 'invited' && <Badge variant="secondary" className="text-[8px]">Agendado</Badge>}
                                                        {att.status === 'confirmed' && <Badge variant="outline" className="text-[8px]">Confirmado</Badge>}
                                                      </div>
                                                    </div>
                                                  ))}
                                                </div>
                                              ));
                                            })()}
                                          </div>
                                          
                                          <div className="text-xs text-muted-foreground pt-1">
                                            {format(parseISO(firstMeeting.scheduled_at), "dd/MM 'às' HH:mm")} ({group.duration}min)
                                          </div>
                                          
                                          <Badge variant="outline" className="text-xs">
                                            {firstMeeting.status === 'scheduled' && 'Agendada'}
                                            {firstMeeting.status === 'rescheduled' && 'Reagendada'}
                                            {firstMeeting.status === 'completed' && 'Realizada'}
                                            {firstMeeting.status === 'no_show' && 'No-show'}
                                            {firstMeeting.status === 'canceled' && 'Cancelada'}
                                          </Badge>
                                        </div>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                              </Draggable>
                            );
                          })}
                          {/* Full slot indicator */}
                          {isSlotFull && groupedSlots.length > 0 && (
                            <div className="absolute top-0.5 right-1 text-[8px] font-medium text-muted-foreground/60">
                              {slotOccupancy.count}/{MAX_MEETINGS_PER_SLOT}
                            </div>
                          )}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  );
                })}
              </div>
            );
          })}
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
