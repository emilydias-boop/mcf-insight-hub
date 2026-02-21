import { useMemo, useCallback, useState, useEffect, useRef } from 'react';
import { format, isSameDay, parseISO, addDays, startOfWeek, startOfMonth, endOfMonth, isWithinInterval, setHours, setMinutes, eachDayOfInterval, isAfter } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { WEEK_STARTS_ON } from '@/lib/businessDays';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { UserPlus } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { MeetingSlot, CloserWithAvailability, useUpdateMeetingSchedule } from '@/hooks/useAgendaData';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { useUniqueSlotsForDays } from '@/hooks/useCloserMeetingLinks';
import { useR2DailySlotsForView, getConfiguredSlotsForDate } from '@/hooks/useR2DailySlotsForView';
import { useCloserCrossBUConflicts } from '@/hooks/useCloserConflicts';

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
  onAddToMeeting?: (day: Date, hour: number, minute: number, closerId?: string) => void;
  meetingType?: 'r1' | 'r2';
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
  scheduled: 'border-l-4 border-l-primary bg-primary/5',
  rescheduled: 'border-l-4 border-l-yellow-500 bg-yellow-50/50 dark:bg-yellow-900/10',
  completed: 'border-l-4 border-l-green-500 bg-green-50/50 dark:bg-green-900/10',
  no_show: 'border-l-4 border-l-red-500 bg-red-50/50 dark:bg-red-900/10',
  canceled: 'border-l-4 border-l-muted bg-muted/20 opacity-60',
  contract_paid: 'border-l-4 border-l-emerald-600 bg-emerald-50/50 dark:bg-emerald-900/10',
};

const STATUS_BADGE_STYLES: Record<string, { label: string; className: string }> = {
  scheduled: { label: 'Agendada', className: 'bg-primary text-primary-foreground' },
  rescheduled: { label: 'Reagendada', className: 'bg-yellow-500 text-white' },
  completed: { label: 'Realizada', className: 'bg-green-500 text-white' },
  no_show: { label: 'No-show', className: 'bg-red-500 text-white' },
  canceled: { label: 'Cancelada', className: 'bg-muted text-muted-foreground' },
  contract_paid: { label: 'Contrato Pago', className: 'bg-emerald-600 text-white' },
};

const SLOT_HEIGHT = 40; // px per 15-min slot (matches h-[40px] in grid cells)
const MAX_MEETINGS_PER_SLOT = 999; // No limit on meetings per slot

import { Settings, Plus, ArrowRightLeft, DollarSign, UserCircle } from 'lucide-react';
import { useOutsideDetectionBatch } from '@/hooks/useOutsideDetection';
import { usePartnerProductDetectionBatch } from '@/hooks/usePartnerProductDetection';
import { useBUContext } from '@/contexts/BUContext';
export function AgendaCalendar({ 
  meetings, 
  selectedDate, 
  onSelectMeeting, 
  closerFilter, 
  closers = [],
  onEditHours,
  viewMode = 'week',
  onSelectSlot,
  onAddToMeeting,
  meetingType = 'r1'
}: AgendaCalendarProps) {
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: WEEK_STARTS_ON });
  const updateSchedule = useUpdateMeetingSchedule();
  const { activeBU } = useBUContext();
  
  // Ref for scroll container - MUST be before any conditional returns
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  // Estado para horário atual (linha vermelha)
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Atualizar a cada minuto
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Get days of week for data fetching (always include Sunday to check for slots)
  const daysOfWeekInView = useMemo(() => {
    const days = viewMode === 'day' 
      ? [selectedDate.getDay()]
      : viewMode === 'month'
        ? [0, 1, 2, 3, 4, 5, 6]
        : [6, 0, 1, 2, 3, 4, 5];
    return days;
  }, [selectedDate, viewMode]);

  // Extrair IDs dos closers recebidos (já filtrados por BU no componente pai)
  const closerIdsForSlots = useMemo(() => closers.map(c => c.id), [closers]);

  // Fetch actual meeting link slots from closer_meeting_links table (R1 only)
  // Passa os IDs dos closers da BU para filtrar apenas slots relevantes
  const { data: meetingLinkSlots } = useUniqueSlotsForDays(daysOfWeekInView, 'r1', closerIdsForSlots);

  // Calculate view date range for R2 daily slots
  const viewDateRange = useMemo(() => {
    if (viewMode === 'day') {
      return { start: selectedDate, end: selectedDate };
    } else if (viewMode === 'month') {
      return { start: startOfMonth(selectedDate), end: endOfMonth(selectedDate) };
    }
    // Week view
    const start = startOfWeek(selectedDate, { weekStartsOn: WEEK_STARTS_ON });
    return { start, end: addDays(start, 6) };
  }, [selectedDate, viewMode]);

  // Fetch R2 daily slots for the view range
  const { data: r2DailySlotsMap } = useR2DailySlotsForView(
    meetingType === 'r2' ? viewDateRange.start : undefined,
    meetingType === 'r2' ? viewDateRange.end : undefined,
    closers.map(c => c.id)
  );

  // Fetch cross-BU conflicts for all closers in view (based on employee_id)
  const { data: crossBuConflictsData } = useCloserCrossBUConflicts(
    closerIdsForSlots,
    selectedDate
  );

  // Calculate dynamic time slots based on configured slots AND existing meetings
  const timeSlots = useMemo(() => {
    let minHour = DEFAULT_END_HOUR;
    let maxHour = DEFAULT_START_HOUR;

    // Include hours from existing meetings (ensures visibility for off-schedule meetings)
    for (const meeting of meetings) {
      const meetingDate = parseISO(meeting.scheduled_at);
      const hour = meetingDate.getHours();
      const minute = meetingDate.getMinutes();
      minHour = Math.min(minHour, hour);
      const slotEndMinutes = hour * 60 + minute + (meeting.duration_minutes || 60);
      const slotEndHour = Math.ceil(slotEndMinutes / 60);
      maxHour = Math.max(maxHour, slotEndHour);
    }

    if (meetingType === 'r2' && r2DailySlotsMap) {
      // For R2, use daily slots map
      for (const dateStr of Object.keys(r2DailySlotsMap)) {
        const dateSlots = r2DailySlotsMap[dateStr];
        for (const time of Object.keys(dateSlots)) {
          const [hourStr, minuteStr] = time.split(':');
          const hour = parseInt(hourStr);
          const minute = parseInt(minuteStr);
          minHour = Math.min(minHour, hour);
          const slotEndMinutes = hour * 60 + minute + 30;
          const slotEndHour = Math.ceil(slotEndMinutes / 60);
          maxHour = Math.max(maxHour, slotEndHour);
        }
      }
    } else if (meetingLinkSlots) {
      // For R1, use weekday-based slots
      for (const dayOfWeek of Object.keys(meetingLinkSlots)) {
        const slots = meetingLinkSlots[Number(dayOfWeek)];
        for (const slot of slots || []) {
          const [hourStr, minuteStr] = slot.time.split(':');
          const hour = parseInt(hourStr);
          const minute = parseInt(minuteStr);
          minHour = Math.min(minHour, hour);
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
  }, [meetingLinkSlots, r2DailySlotsMap, meetingType, meetings]);
  
  // Calcular posição da linha vermelha em pixels (depends on timeSlots)
  const getCurrentTimePosition = useCallback(() => {
    if (timeSlots.length === 0) return null;
    
    const hour = currentTime.getHours();
    const minute = currentTime.getMinutes();
    const currentMinutes = hour * 60 + minute;
    
    const firstSlot = timeSlots[0];
    const lastSlot = timeSlots[timeSlots.length - 1];
    const minMinutes = firstSlot.hour * 60 + firstSlot.minute;
    const maxMinutes = lastSlot.hour * 60 + lastSlot.minute + 15;
    
    if (currentMinutes < minMinutes || currentMinutes >= maxMinutes) return null;
    
    // Calcular posição proporcional baseado nos minutos desde o primeiro slot
    const slotIndex = (currentMinutes - minMinutes) / 15;
    return slotIndex * SLOT_HEIGHT;
  }, [currentTime, timeSlots]);
  
  // Determine if Sunday should be shown (has meetings or configured slots)
  const includeSunday = useMemo(() => {
    if (viewMode !== 'week') return true;
    const sundayDate = addDays(weekStart, 1);
    
    // Check if any meeting is scheduled on this Sunday
    const hasMeetings = meetings.some(m => isSameDay(parseISO(m.scheduled_at), sundayDate));
    if (hasMeetings) return true;
    
    // Check R2 daily slots for this Sunday
    if (meetingType === 'r2' && r2DailySlotsMap) {
      const sundayStr = format(sundayDate, 'yyyy-MM-dd');
      const sundaySlots = r2DailySlotsMap[sundayStr];
      if (sundaySlots && Object.keys(sundaySlots).length > 0) return true;
    }
    
    // Check R1 weekday slots for Sunday (day_of_week = 0)
    if (meetingType === 'r1' && meetingLinkSlots) {
      const sundayR1Slots = meetingLinkSlots[0];
      if (sundayR1Slots && sundayR1Slots.length > 0) return true;
    }
    
    return false;
  }, [viewMode, weekStart, meetings, meetingType, r2DailySlotsMap, meetingLinkSlots]);

  const viewDays = useMemo(() => {
    if (viewMode === 'day') {
      return [selectedDate];
    } else if (viewMode === 'month') {
      const monthStart = startOfMonth(selectedDate);
      const monthEnd = endOfMonth(selectedDate);
      return eachDayOfInterval({ start: monthStart, end: monthEnd });
    }
    // Semana de trabalho: Sáb, [Dom], Seg, Ter, Qua, Qui, Sex
    const days = [
      addDays(weekStart, 0), // Sábado
    ];
    if (includeSunday) {
      days.push(addDays(weekStart, 1)); // Domingo (only when has data)
    }
    days.push(
      addDays(weekStart, 2), // Segunda
      addDays(weekStart, 3), // Terça
      addDays(weekStart, 4), // Quarta
      addDays(weekStart, 5), // Quinta
      addDays(weekStart, 6), // Sexta
    );
    return days;
  }, [selectedDate, viewMode, weekStart, includeSunday]);

  // Collect all attendees for batch Outside detection
  const attendeesForOutsideCheck = useMemo(() => {
    return meetings.flatMap(m => 
      m.attendees?.map(att => ({
        id: att.id,
        email: att.contact?.email || null,
        meetingDate: m.scheduled_at
      })) || []
    );
  }, [meetings]);

  // Hook to detect Outside leads (purchased contract before meeting)
  const { data: outsideData = {} } = useOutsideDetectionBatch(attendeesForOutsideCheck);

  // Hook to detect partner products (for Consórcio BU)
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
  // Now accepts optional closerId to handle overlapping meetings from different closers
  const getMeetingCoveringSlot = useCallback((day: Date, hour: number, minute: number, closerId?: string): MeetingSlot | null => {
    const slotTime = setMinutes(setHours(new Date(day), hour), minute);
    
    for (const meeting of filteredMeetings) {
      const meetingStart = parseISO(meeting.scheduled_at);
      if (!isSameDay(meetingStart, day)) continue;
      
      // If closerId was specified, filter by it
      if (closerId && meeting.closer_id !== closerId) continue;
      
      const duration = meeting.duration_minutes || 30;
      const meetingEnd = new Date(meetingStart.getTime() + duration * 60 * 1000);
      
      // Check if this slot is within the meeting's duration
      if (slotTime >= meetingStart && slotTime < meetingEnd) {
        return meeting;
      }
    }
    return null;
  }, [filteredMeetings]);

  // Get all active closers that have meetings covering a specific slot
  const getActiveClosersInSlot = useCallback((day: Date, hour: number, minute: number): string[] => {
    const slotTime = setMinutes(setHours(new Date(day), hour), minute);
    const closerIds = new Set<string>();
    
    for (const meeting of filteredMeetings) {
      const meetingStart = parseISO(meeting.scheduled_at);
      if (!isSameDay(meetingStart, day)) continue;
      
      const duration = meeting.duration_minutes || 30;
      const meetingEnd = new Date(meetingStart.getTime() + duration * 60 * 1000);
      
      if (slotTime >= meetingStart && slotTime < meetingEnd && meeting.closer_id) {
        closerIds.add(meeting.closer_id);
      }
    }
    
    return [...closerIds].sort();
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
    const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    
    if (meetingType === 'r2' && r2DailySlotsMap) {
      // For R2, check daily slots map
      const dateStr = format(day, 'yyyy-MM-dd');
      const dateSlots = r2DailySlotsMap[dateStr];
      return dateSlots && dateSlots[timeStr] && dateSlots[timeStr].closerIds.length > 0;
    }
    
    // For R1, use weekday-based slots
    const dayOfWeek = day.getDay();
    const slots = meetingLinkSlots?.[dayOfWeek] || [];
    return slots.some(s => s.time === timeStr);
  }, [meetingLinkSlots, r2DailySlotsMap, meetingType]);

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
    const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    let configuredCloserIds: string[] = [];
    
    if (meetingType === 'r2' && r2DailySlotsMap) {
      // For R2, get closers from daily slots map
      const dateStr = format(day, 'yyyy-MM-dd');
      const dateSlots = r2DailySlotsMap[dateStr];
      const slotInfo = dateSlots?.[timeStr];
      configuredCloserIds = slotInfo?.closerIds || [];
    } else {
      // For R1, use weekday-based slots
      const dayOfWeek = day.getDay();
      const slots = meetingLinkSlots?.[dayOfWeek] || [];
      const configuredSlot = slots.find(s => s.time === timeStr);
      configuredCloserIds = configuredSlot?.closerIds || [];
    }
    
    // Filter out closers that already have a meeting at this exact time
    // Also check for cross-BU conflicts (meetings from related closers with same employee_id)
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
      
      if (hasMeeting) return false;
      
      // Check for cross-BU conflicts via employee_id
      // Only check if we're looking at the selected date (conflicts are date-specific)
      if (crossBuConflictsData?.conflictingTimes && isSameDay(day, selectedDate)) {
        const hasCrossBuConflict = crossBuConflictsData.conflictingTimes.some(
          conflict => conflict.closerId === closerId && conflict.time === timeStr
        );
        if (hasCrossBuConflict) return false;
      }
      
      return true;
    });
  }, [meetingLinkSlots, r2DailySlotsMap, meetingType, filteredMeetings, crossBuConflictsData, selectedDate]);

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

  // Get ALL closers that have ANY configured availability on this day
  // (not just closers with meetings - this ensures consistent column layout)
  const getAllConfiguredClosersForDay = useCallback((day: Date) => {
    const allCloserIdsSet = new Set<string>();
    
    if (meetingType === 'r2' && r2DailySlotsMap) {
      // For R2, check daily slots map
      const dateStr = format(day, 'yyyy-MM-dd');
      const dateSlots = r2DailySlotsMap[dateStr];
      if (dateSlots) {
        Object.values(dateSlots).forEach(slotInfo => {
          slotInfo.closerIds.forEach(id => allCloserIdsSet.add(id));
        });
      }
    } else {
      // For R1, check weekday-based slots
      const dayOfWeek = day.getDay();
      const slots = meetingLinkSlots?.[dayOfWeek] || [];
      slots.forEach(slot => {
        slot.closerIds.forEach(id => allCloserIdsSet.add(id));
      });
    }
    
    return Array.from(allCloserIdsSet).sort();
  }, [meetingType, r2DailySlotsMap, meetingLinkSlots]);

  // Get closers that have meetings at a specific time slot
  const getMeetingClosersForSlot = useCallback((day: Date, hour: number, minute: number) => {
    const slotTime = setMinutes(setHours(new Date(day), hour), minute);
    
    const slotMeetings = filteredMeetings.filter(meeting => {
      const meetingStart = parseISO(meeting.scheduled_at);
      if (!isSameDay(meetingStart, day)) return false;
      
      const duration = meeting.duration_minutes || 30;
      const meetingEnd = new Date(meetingStart.getTime() + duration * 60 * 1000);
      
      return slotTime >= meetingStart && slotTime < meetingEnd;
    });
    
    return [...new Set(slotMeetings.map(m => m.closer_id).filter(Boolean))].sort() as string[];
  }, [filteredMeetings]);

  // Get ALL closers (with meetings OR availability) for a specific slot
  // This ensures consistent column layout within each time slot
  const getAllClosersForSlot = useCallback((day: Date, hour: number, minute: number) => {
    const meetingClosers = getMeetingClosersForSlot(day, hour, minute);
    const availableClosers = getAvailableClosersForSlot(day, hour, minute);
    
    // Combine and deduplicate, then sort for consistent order
    const allClosers = [...new Set([...meetingClosers, ...availableClosers])].sort();
    return allClosers;
  }, [getMeetingClosersForSlot, getAvailableClosersForSlot]);

  // Get the CSS Grid column index for a closer (1-indexed for CSS Grid)
  const getCloserGridColumn = useCallback((closerId: string, day: Date): number => {
    const allDayClosers = getAllConfiguredClosersForDay(day);
    const index = allDayClosers.indexOf(closerId);
    return index >= 0 ? index + 1 : 1; // CSS Grid columns are 1-indexed
  }, [getAllConfiguredClosersForDay]);

  // Get grid layout info for a slot
  const getSlotGridInfo = useCallback((day: Date) => {
    const allDayClosers = getAllConfiguredClosersForDay(day);
    const totalClosers = allDayClosers.length || 1;
    const isCompact = totalClosers >= 3;
    return { allDayClosers, totalClosers, isCompact };
  }, [getAllConfiguredClosersForDay]);

  // Legacy function for day-level positioning (used in some edge cases)
  const getCloserColumnPosition = useCallback((day: Date, closerId: string | undefined) => {
    if (!closerId) {
      return { widthPercent: 100, leftPercent: 0, totalClosers: 1, isCompact: false, stackIndex: 0 };
    }
    const activeClosers = getAllConfiguredClosersForDay(day);
    const totalClosers = activeClosers.length || 1;
    const columnIndex = activeClosers.indexOf(closerId);
    const isCompact = totalClosers >= 3;
    
    return {
      widthPercent: 100 / totalClosers,
      leftPercent: columnIndex >= 0 ? (columnIndex * 100 / totalClosers) : 0,
      totalClosers,
      isCompact,
      stackIndex: columnIndex
    };
  }, [getAllConfiguredClosersForDay]);

  const getCloserColor = (closerId: string | undefined, closerName: string | undefined) => {
    const closer = closers.find(c => c.id === closerId);
    if (closer?.color) return closer.color;
    if (closerName && DEFAULT_COLORS[closerName]) return DEFAULT_COLORS[closerName];
    return '#6B7280';
  };

  // Generate initials from full name: "Caroline Correa" → "CC"
  const getInitials = (name: string): string => {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Status config with short labels and colors
  const ATTENDEE_STATUS_CONFIG: Record<string, { shortLabel: string; colorClass: string }> = {
    scheduled: { shortLabel: 'Ag', colorClass: 'text-blue-400' },
    invited: { shortLabel: 'Ag', colorClass: 'text-blue-400' },
    completed: { shortLabel: 'OK', colorClass: 'text-green-500' },
    no_show: { shortLabel: 'NS', colorClass: 'text-red-500' },
    contract_paid: { shortLabel: 'CP', colorClass: 'text-emerald-500' },
    rescheduled: { shortLabel: 'RE', colorClass: 'text-yellow-500' },
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
  // Each visual slot is 15 minutes
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
          {['Sáb', 'Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex'].map(d => (
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

  // Get active closers for day view to create dedicated columns
  // Uses ALL closers with configured slots (not just those with meetings)
  const activeClosersForDayView = useMemo(() => {
    if (viewMode !== 'day') return [];
    const day = viewDays[0];
    if (!day) return [];
    
    // Use all closers configured for this day to ensure proper column separation
    return getAllConfiguredClosersForDay(day);
  }, [viewMode, viewDays, getAllConfiguredClosersForDay]);

  // Day or Week view rendering with drag-and-drop
  const numCloserColumns = activeClosersForDayView.length || 1;
  const gridCols = viewMode === 'day' 
    ? `grid-cols-[60px_repeat(${numCloserColumns},1fr)]`
    : `grid-cols-[60px_repeat(${viewDays.length},1fr)]`;
  const currentTimePos = getCurrentTimePosition();
  
  
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
            {/* Day view: show closer columns header */}
            {viewMode === 'day' && activeClosersForDayView.length > 0 ? (
              activeClosersForDayView.map(closerId => {
                const closer = closers.find(c => c.id === closerId);
                const closerColor = getCloserColor(closerId, closer?.name);
                return (
                  <div
                    key={closerId}
                    className={cn(
                      'h-[52px] flex flex-col items-center justify-center border-l bg-muted/50'
                    )}
                  >
                    <div 
                      className="w-3 h-3 rounded-full mb-1"
                      style={{ backgroundColor: closerColor }}
                    />
                    <div className="text-xs font-medium truncate px-1">
                      {closer?.name?.split(' ')[0] || 'Closer'}
                    </div>
                  </div>
                );
              })
            ) : viewMode === 'day' ? (
              <div
                className={cn(
                  'h-[52px] flex flex-col items-center justify-center border-l bg-muted/50',
                  isSameDay(viewDays[0], new Date()) && 'bg-primary/10'
                )}
              >
                <div className="text-xs text-muted-foreground uppercase">
                  {format(viewDays[0], 'EEE', { locale: ptBR })}
                </div>
                <div className={cn(
                  'text-sm font-semibold',
                  isSameDay(viewDays[0], new Date()) && 'text-primary'
                )}>
                  {format(viewDays[0], 'd')}
                </div>
              </div>
            ) : (
              viewDays.map(day => (
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
              ))
            )}
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
                {/* For day view with closer columns, render one cell per closer */}
                {viewMode === 'day' && activeClosersForDayView.length > 0 ? (
                  activeClosersForDayView.map(closerId => {
                    const day = viewDays[0];
                    const closerMeetings = getGroupedMeetingsInSlot(day, hour, minute).filter(g => g.closerId === closerId);
                    const isCurrent = isCurrentTimeSlot(day, hour, minute);
                    const droppableId = `${day.toISOString()}|${hour}|${minute}|${closerId}`;
                    const slotOccupancy = getSlotOccupancy(day, hour, minute, closerId);
                    const isSlotFull = slotOccupancy.isFull;
                    const isOccupied = closerMeetings.length === 0 && getMeetingCoveringSlot(day, hour, minute, closerId) !== null;
                    const closer = closers.find(c => c.id === closerId);
                    const closerColor = getCloserColor(closerId, closer?.name);

                    // Check if this closer is available at this slot
                    const availableClosersForSlot = getAvailableClosersForSlot(day, hour, minute);
                    const isCloserAvailable = availableClosersForSlot.includes(closerId);
                    const hasNoMeetings = closerMeetings.length === 0 && !isOccupied;

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
                            onClick={(e) => {
                              if (isOccupied) {
                                const coveringMeeting = getMeetingCoveringSlot(day, hour, minute, closerId);
                                if (coveringMeeting) {
                                  onSelectMeeting(coveringMeeting);
                                }
                              }
                            }}
                            className={cn(
                              'h-[40px] border-l relative overflow-visible',
                              isCurrent && 'bg-primary/15 ring-1 ring-primary/30',
                              snapshot.isDraggingOver && !isSlotFull && 'bg-primary/20',
                              isOccupied && 'cursor-pointer',
                              isSlotFull && 'bg-muted/40',
                              isCloserAvailable && hasNoMeetings && 'bg-white/80 dark:bg-white/5'
                            )}
                          >
                            {/* Available slot indicator for this closer */}
                            {hasNoMeetings && isCloserAvailable && onSelectSlot && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onSelectSlot(day, hour, minute, closerId);
                                }}
                                className="absolute inset-0.5 rounded text-[10px] font-medium flex items-center justify-center gap-1 border border-dashed hover:opacity-80 transition-all"
                                style={{ 
                                  backgroundColor: `${closerColor}15`,
                                  borderColor: closerColor,
                                  color: closerColor
                                }}
                              >
                                <Plus className="h-3 w-3" />
                                Agendar
                              </button>
                            )}
                            
                            {/* Meetings for this closer */}
                            {closerMeetings.map((group, groupIndex) => {
                              const slotsNeeded = getSlotsNeeded(group.duration);
                              const cardHeight = SLOT_HEIGHT * slotsNeeded - 4;
                              const meetings = group.meetings;
                              const firstMeeting = meetings[0];
                              
                              const STATUS_BORDER_COLORS: Record<string, string> = {
                                scheduled: 'border-l-green-500',
                                invited: 'border-l-green-500',
                                completed: 'border-l-blue-500',
                                no_show: 'border-l-red-500',
                                contract_paid: 'border-l-emerald-600',
                                cancelled: 'border-l-gray-400',
                                canceled: 'border-l-gray-400',
                                rescheduled: 'border-l-yellow-500',
                              };
                              
                              const STATUS_BG_COLORS: Record<string, string> = {
                                scheduled: 'bg-green-500/10',
                                invited: 'bg-green-500/10',
                                completed: 'bg-blue-500/10',
                                no_show: 'bg-red-500/10',
                                contract_paid: 'bg-emerald-600/10',
                                cancelled: 'bg-gray-400/10',
                                canceled: 'bg-gray-400/10',
                                rescheduled: 'bg-yellow-500/10',
                              };
                              
                              const allAttendees = meetings.flatMap(m => 
                                (m.attendees || []).map(att => ({ 
                                  ...att, 
                                  meetingSdr: att.booked_by_profile?.full_name || m.booked_by_profile?.full_name 
                                }))
                              );
                              const displayAttendees = allAttendees.slice(0, 3);
                              const remaining = allAttendees.length - displayAttendees.length;

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
onClick={(e) => { e.stopPropagation(); onSelectMeeting(firstMeeting); }}
                                            className={cn(
                                              'absolute text-left rounded-md shadow-sm hover:shadow-md transition-all overflow-hidden z-10 border-l-4 p-1.5',
                                              STATUS_BORDER_COLORS[firstMeeting.status] || 'border-l-gray-300',
                                              STATUS_BG_COLORS[firstMeeting.status] || 'bg-card',
                                              dragSnapshot.isDragging && 'shadow-lg ring-2 ring-primary'
                                            )}
                                            style={{ 
                                              height: `${cardHeight}px`,
                                              top: '2px',
                                              left: '2px',
                                              right: '2px',
                                              ...dragProvided.draggableProps.style,
                                            }}
                                          >
                                            <div className="flex items-center gap-1.5 mb-0.5">
                                              <span className="font-semibold text-xs">
                                                {format(parseISO(firstMeeting.scheduled_at), 'HH:mm')}
                                              </span>
                                            </div>
                                            <div className="space-y-0">
                                              {displayAttendees.map(att => (
                                                <div key={att.id} className="text-[11px] font-medium truncate leading-tight flex items-center gap-1">
                                                  {att.meetingSdr && (
                                                    <>
                                                      <span className="text-muted-foreground font-semibold">
                                                        {getInitials(att.meetingSdr)}
                                                      </span>
                                                      <span className="text-muted-foreground">•</span>
                                                    </>
                                                  )}
                                                  <span className="truncate flex-1">
                                                    {(att.attendee_name || att.contact?.name || att.deal?.name || 'Lead').split(' ')[0]}
                                                  </span>
                                                  {att.status && ATTENDEE_STATUS_CONFIG[att.status] && (
                                                    <span className={cn(
                                                      "text-[9px] font-bold",
                                                      ATTENDEE_STATUS_CONFIG[att.status].colorClass
                                                    )}>
                                                      {ATTENDEE_STATUS_CONFIG[att.status].shortLabel}
                                                    </span>
                                                  )}
                                                </div>
                                              ))}
                                              {remaining > 0 && (
                                                <span className="text-[10px] text-muted-foreground">
                                                  +{remaining}
                                                </span>
                                              )}
                                            </div>
                                          </button>
                                        </TooltipTrigger>
                                        <TooltipContent side="right">
                                          <div className="text-xs">
                                            <div className="font-semibold">{format(parseISO(firstMeeting.scheduled_at), 'HH:mm')} - {group.duration}min</div>
                                            <div>{allAttendees.length} participante{allAttendees.length > 1 ? 's' : ''}</div>
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
                  })
                ) : (
                  // Week view: render one cell per day
                  viewDays.map(day => {
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
                          onClick={(e) => {
                            // If slot is occupied by an earlier meeting, open that meeting
                            if (isOccupied) {
                              // Use allDayClosers grid to determine which column was clicked
                              const { allDayClosers, totalClosers } = getSlotGridInfo(day);
                              const rect = e.currentTarget.getBoundingClientRect();
                              const clickX = e.clientX - rect.left;
                              const widthPerCloser = rect.width / totalClosers;
                              const clickedCloserIndex = Math.min(
                                Math.floor(clickX / widthPerCloser),
                                totalClosers - 1
                              );
                              const clickedCloserId = allDayClosers[clickedCloserIndex];
                              
                              // Only open meeting if the clicked column's closer actually has a meeting covering this slot
                              if (clickedCloserId) {
                                const coveringMeeting = getMeetingCoveringSlot(day, hour, minute, clickedCloserId);
                                if (coveringMeeting) {
                                  onSelectMeeting(coveringMeeting);
                                }
                              }
                              // If no meeting in this column -> do nothing (empty space)
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
                          {/* CSS Grid container for proper column alignment */}
                          {!isOccupied && groupedSlots.length === 0 && onSelectSlot && (() => {
                            const { allDayClosers, totalClosers, isCompact } = getSlotGridInfo(day);
                            const availableClosers = getAvailableClosersForSlot(day, hour, minute);
                            if (availableClosers.length === 0) return null;
                            
                            return (
                              <div 
                                className="absolute inset-0 grid gap-0.5 p-0.5"
                                style={{ gridTemplateColumns: `repeat(${totalClosers}, 1fr)` }}
                              >
                                {allDayClosers.map(closerId => {
                                  const isAvailable = availableClosers.includes(closerId);
                                  if (!isAvailable) {
                                    // Empty placeholder to maintain grid column
                                    return <div key={closerId} />;
                                  }
                                  
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
                                      className={cn(
                                        "rounded font-medium flex items-center justify-center gap-0.5 border border-dashed hover:opacity-80 transition-all h-full",
                                        isCompact ? "text-[8px]" : "text-[9px]"
                                      )}
                                      style={{ 
                                        backgroundColor: `${closerColor}15`,
                                        borderColor: closerColor,
                                        color: closerColor,
                                      }}
                                    >
                                      <Plus className={cn(isCompact ? "h-2.5 w-2.5" : "h-3 w-3")} />
                                      {isCompact ? firstName.charAt(0) : firstName}
                                    </button>
                                  );
                                })}
                              </div>
                            );
                          })()}
                          {/* CSS Grid container for meetings */}
                          {groupedSlots.length > 0 && (() => {
                            const { allDayClosers, totalClosers, isCompact } = getSlotGridInfo(day);
                            
                            // Create a map of closerId -> group for this slot
                            const closerToGroup = new Map<string, typeof groupedSlots[0]>();
                            groupedSlots.forEach(group => {
                              if (group.closerId) {
                                closerToGroup.set(group.closerId, group);
                              }
                            });
                            
                            // Also get available closers for this slot
                            const availableClosers = getAvailableClosersForSlot(day, hour, minute);
                            
                            return (
                              <div 
                                className="absolute inset-0 grid gap-0.5 p-0.5"
                                style={{ gridTemplateColumns: `repeat(${totalClosers}, 1fr)` }}
                              >
                                {allDayClosers.map((closerId, colIndex) => {
                                  const group = closerToGroup.get(closerId);
                                  const isAvailable = availableClosers.includes(closerId);
                                  
                                  // If this closer has a meeting
                                  if (group) {
                                    const closerColor = getCloserColor(group.closerId, group.closer?.name);
                                    const slotsNeeded = getSlotsNeeded(group.duration);
                                    const cardHeight = SLOT_HEIGHT * slotsNeeded - 4;
                                    
                                    const meetings = group.meetings;
                                    const firstMeeting = meetings[0];
                                    
                                    const STATUS_BORDER_COLORS: Record<string, string> = {
                                      scheduled: 'border-l-green-500',
                                      invited: 'border-l-green-500',
                                      completed: 'border-l-blue-500',
                                      no_show: 'border-l-red-500',
                                      contract_paid: 'border-l-emerald-600',
                                      cancelled: 'border-l-gray-400',
                                      canceled: 'border-l-gray-400',
                                      rescheduled: 'border-l-yellow-500',
                                    };
                                    
                                    const STATUS_BG_COLORS: Record<string, string> = {
                                      scheduled: 'bg-green-500/10',
                                      invited: 'bg-green-500/10',
                                      completed: 'bg-blue-500/10',
                                      no_show: 'bg-red-500/10',
                                      contract_paid: 'bg-emerald-600/10',
                                      cancelled: 'bg-gray-400/10',
                                      canceled: 'bg-gray-400/10',
                                      rescheduled: 'bg-yellow-500/10',
                                    };
                                    
                                    const allAttendees = meetings.flatMap(m => 
                                      (m.attendees || []).map(att => ({ 
                                        ...att, 
                                        meetingSdr: att.booked_by_profile?.full_name || m.booked_by_profile?.full_name 
                                      }))
                                    );
                                    const displayAttendees = allAttendees.slice(0, isCompact ? 4 : 4);
                                    const remaining = allAttendees.length - displayAttendees.length;
                                    
                                    return (
                                      <Draggable 
                                        key={firstMeeting.id} 
                                        draggableId={firstMeeting.id} 
                                        index={colIndex}
                                      >
                                        {(dragProvided, dragSnapshot) => (
                                          <div className="relative h-full">
                                            <TooltipProvider>
                                              <Tooltip>
                                                <TooltipTrigger asChild>
                                                  <button
                                                    ref={dragProvided.innerRef}
                                                    {...dragProvided.draggableProps}
                                                    {...dragProvided.dragHandleProps}
                                                    onClick={(e) => { e.stopPropagation(); onSelectMeeting(firstMeeting); }}
                                                    className={cn(
                                                      'absolute inset-0 text-left rounded-md shadow-sm hover:shadow-md transition-all overflow-hidden z-10 border-l-4',
                                                      isCompact ? 'p-0.5 text-[10px]' : 'p-1.5',
                                                      STATUS_BORDER_COLORS[firstMeeting.status] || 'border-l-gray-300',
                                                      STATUS_BG_COLORS[firstMeeting.status] || 'bg-card',
                                                      dragSnapshot.isDragging && 'shadow-lg ring-2 ring-primary'
                                                    )}
                                                    style={{ 
                                                      height: `${cardHeight}px`,
                                                      ...dragProvided.draggableProps.style,
                                                    }}
                                                  >
                                          {/* Compact layout for 3+ closers: header + participants list */}
                                          {isCompact ? (
                                            <div className="flex flex-col h-full p-0.5 overflow-hidden">
                                              {/* Header: Bolinha + Horário + Closer */}
                                              <div className="flex items-center gap-1 text-[9px] mb-0.5">
                                                <div
                                                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                                  style={{ backgroundColor: closerColor }}
                                                />
                                                <span className="font-semibold">
                                                  {format(parseISO(firstMeeting.scheduled_at), 'HH:mm')}
                                                </span>
                                                <span className="text-muted-foreground truncate">
                                                  • {group.closer?.name?.split(' ')[0] || 'N/A'}
                                                </span>
                                              </div>
                                              {/* Lista de participantes: Sigla SDR • Nome Lead Status */}
                                              {/* Calcular quantos participantes cabem baseado na altura do card */}
                                              {(() => {
                                                const headerHeight = 16;
                                                const participantHeight = 11;
                                                const availableHeight = cardHeight - headerHeight - 2;
                                                const maxToShow = Math.max(2, Math.min(displayAttendees.length, Math.floor(availableHeight / participantHeight)));
                                                const remainingCount = allAttendees.length - maxToShow;
                                                
                                                return (
                                                  <div className="space-y-0 flex-1 overflow-hidden">
                                                    {displayAttendees.slice(0, maxToShow).map(att => (
                                                      <div key={att.id} className="text-[9px] truncate flex items-center gap-0.5">
                                                        {att.meetingSdr && (
                                                          <>
                                                            <span className="text-muted-foreground font-semibold">
                                                              {getInitials(att.meetingSdr)}
                                                            </span>
                                                            <span className="text-muted-foreground">•</span>
                                                          </>
                                                        )}
                                                        <span className="truncate flex-1">
                                                          {(att.attendee_name || att.contact?.name || 'Lead').split(' ')[0]}
                                                        </span>
                                                        {att.status && ATTENDEE_STATUS_CONFIG[att.status] && (
                                                          <span className={cn(
                                                            "text-[8px] font-bold",
                                                            ATTENDEE_STATUS_CONFIG[att.status].colorClass
                                                          )}>
                                                            {ATTENDEE_STATUS_CONFIG[att.status].shortLabel}
                                                          </span>
                                                        )}
                                                      </div>
                                                    ))}
                                                    {remainingCount > 0 && (
                                                      <span className="text-[8px] text-muted-foreground">+{remainingCount}</span>
                                                    )}
                                                  </div>
                                                );
                                              })()}
                                            </div>
                                          ) : (
                                            <>
                                              {/* Header: Bolinha do closer + Horário + Nome do Closer */}
                                              <div className="flex items-center gap-1.5 mb-0.5">
                                                <div
                                                  className="w-2 h-2 rounded-full flex-shrink-0"
                                                  style={{ backgroundColor: closerColor }}
                                                />
                                                <span className="font-semibold text-xs">
                                                  {format(parseISO(firstMeeting.scheduled_at), 'HH:mm')}
                                                </span>
                                                <span className="text-[10px] text-muted-foreground">•</span>
                                                <span className="text-[10px] font-medium text-foreground truncate">
                                                  {group.closer?.name || 'N/A'}
                                                </span>
                                              </div>

                                              {/* Lista de leads com sigla do SDR */}
                                              <div className="space-y-0">
                                                {displayAttendees.map(att => (
                                                  <div key={att.id} className="text-[11px] font-medium truncate leading-tight flex items-center gap-1">
                                                    {att.meetingSdr && (
                                                      <>
                                                        <span className="text-muted-foreground font-semibold">
                                                          {getInitials(att.meetingSdr)}
                                                        </span>
                                                        <span className="text-muted-foreground">•</span>
                                                      </>
                                                    )}
                                                    <span className="truncate flex-1">
                                                      {(att.attendee_name || att.contact?.name || att.deal?.name || 'Lead').split(' ')[0]}
                                                    </span>
                                                    {att.status && ATTENDEE_STATUS_CONFIG[att.status] && (
                                                      <span className={cn(
                                                        "text-[9px] font-bold",
                                                        ATTENDEE_STATUS_CONFIG[att.status].colorClass
                                                      )}>
                                                        {ATTENDEE_STATUS_CONFIG[att.status].shortLabel}
                                                      </span>
                                                    )}
                                                  </div>
                                                ))}
                                                {remaining > 0 && (
                                                  <span className="text-[10px] text-muted-foreground">
                                                    +{remaining}
                                                  </span>
                                                )}
                                              </div>
                                            </>
                                          )}
                                        </button>
                                      </TooltipTrigger>
                                        <TooltipContent side="right" className="max-w-[320px]">
                                        <div className="space-y-2">
                                          {/* Header com Closer e Status */}
                                          <div className="flex items-center justify-between text-xs border-b pb-1.5 mb-1.5">
                                            <div className="flex items-center gap-2">
                                              <div
                                                className="w-3 h-3 rounded-full flex-shrink-0"
                                                style={{ backgroundColor: closerColor }}
                                              />
                                              <span className="font-semibold">{group.closer?.name || 'N/A'}</span>
                                            </div>
                                            <Badge className={cn(
                                              'text-[9px] px-1.5 py-0 h-4 font-medium',
                                              STATUS_BADGE_STYLES[firstMeeting.status]?.className || 'bg-muted'
                                            )}>
                                              {STATUS_BADGE_STYLES[firstMeeting.status]?.label || firstMeeting.status}
                                            </Badge>
                                          </div>
                                          
                                          <div className="font-medium text-xs">
                                            {format(parseISO(firstMeeting.scheduled_at), 'HH:mm')} - {group.duration}min • {allAttendees.length} participante{allAttendees.length > 1 ? 's' : ''}
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
                                                        {activeBU === 'consorcio' ? (
                                                          partnerData[att.id]?.isPartner && (
                                                            <Badge variant="outline" className="text-[8px] px-1 py-0 bg-blue-100 text-blue-700 border-blue-300 gap-0.5">
                                                              <UserCircle className="h-2.5 w-2.5" />
                                                              Parceiro {partnerData[att.id]?.productLabel}
                                                            </Badge>
                                                          )
                                                        ) : (
                                                          outsideData[att.id]?.isOutside && (
                                                            <Badge variant="outline" className="text-[8px] px-1 py-0 bg-yellow-100 text-yellow-700 border-yellow-300 gap-0.5">
                                                              <DollarSign className="h-2.5 w-2.5" />
                                                              Outside
                                                            </Badge>
                                                          )
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
                                    {onAddToMeeting && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const meetingDate = parseISO(firstMeeting.scheduled_at);
                                          onAddToMeeting(
                                            day,
                                            meetingDate.getHours(),
                                            meetingDate.getMinutes(),
                                            group.closerId
                                          );
                                        }}
                                        className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 bg-white/90 rounded-full p-0.5 shadow hover:bg-green-100 transition-opacity z-20"
                                        title="Adicionar lead a esta reunião"
                                      >
                                        <UserPlus className="h-3.5 w-3.5 text-green-600" />
                                      </button>
                                    )}
                                  </div>
                                )}
                              </Draggable>
                            );
                                  }
                                  
                                  // If this closer is available (no meeting)
                                  if (isAvailable && onSelectSlot) {
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
                                        className={cn(
                                          "rounded font-medium flex items-center justify-center gap-0.5 border border-dashed hover:opacity-80 transition-all h-full",
                                          isCompact ? "text-[8px]" : "text-[9px]"
                                        )}
                                        style={{ 
                                          backgroundColor: `${closerColor}15`,
                                          borderColor: closerColor,
                                          color: closerColor,
                                        }}
                                      >
                                        <Plus className={cn(isCompact ? "h-2.5 w-2.5" : "h-3 w-3")} />
                                        {isCompact ? firstName.charAt(0) : firstName}
                                      </button>
                                    );
                                  }
                                  
                                  // Empty placeholder
                                  return <div key={closerId} />;
                                })}
                              </div>
                            );
                          })()}
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
                })
                )}
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
