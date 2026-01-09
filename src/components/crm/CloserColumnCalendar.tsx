import { useMemo } from 'react';
import { format, parseISO, isSameDay, setHours, setMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Settings } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { MeetingSlot, CloserWithAvailability, BlockedDate } from '@/hooks/useAgendaData';
import { cn } from '@/lib/utils';
import { useCloserDaySlots } from '@/hooks/useCloserMeetingLinks';

interface CloserColumnCalendarProps {
  meetings: MeetingSlot[];
  closers: CloserWithAvailability[];
  blockedDates: BlockedDate[];
  selectedDate: Date;
  onSelectMeeting: (meeting: MeetingSlot) => void;
  onSelectSlot: (closerId: string, date: Date) => void;
  onEditHours?: () => void;
}

const STATUS_STYLES: Record<string, string> = {
  scheduled: 'bg-primary/90 hover:bg-primary',
  rescheduled: 'bg-yellow-500/90 hover:bg-yellow-500',
  completed: 'bg-green-500/80 hover:bg-green-500',
  no_show: 'bg-red-500/80 hover:bg-red-500',
  canceled: 'bg-muted/60 line-through',
  contract_paid: 'bg-emerald-600/90 hover:bg-emerald-600',
};

const ATTENDEE_STATUS_CONFIG: Record<string, { 
  label: string; 
  shortLabel: string; 
  bgClass: string;
  variant: 'default' | 'destructive' | 'outline' | 'secondary' 
}> = {
  invited: { 
    label: 'Agendado', 
    shortLabel: 'Agend.', 
    bgClass: 'bg-blue-600/80',
    variant: 'outline'
  },
  completed: { 
    label: 'Compareceu', 
    shortLabel: 'OK', 
    bgClass: 'bg-green-600/80',
    variant: 'default'
  },
  no_show: { 
    label: 'No-show', 
    shortLabel: 'NS', 
    bgClass: 'bg-red-600/80',
    variant: 'destructive'
  },
  contract_paid: { 
    label: 'Contrato Pago', 
    shortLabel: 'Contrato', 
    bgClass: 'bg-emerald-600/80',
    variant: 'default'
  },
  rescheduled: { 
    label: 'Reagendado', 
    shortLabel: 'Reag.', 
    bgClass: 'bg-yellow-600/80',
    variant: 'secondary'
  },
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
  
  // Buscar horários reais configurados em closer_meeting_links
  const { data: daySlots = [] } = useCloserDaySlots(dayOfWeek);

  // Gerar slots únicos baseado nos horários reais
  const timeSlots = useMemo(() => {
    const uniqueTimes = [...new Set(daySlots.map(s => s.start_time))].sort();
    
    return uniqueTimes.map(timeStr => {
      const [hour, minute] = timeStr.split(':').map(Number);
      return setMinutes(setHours(selectedDate, hour), minute);
    });
  }, [daySlots, selectedDate]);
  
  // Verificar se um closer tem horário configurado para este slot
  const isSlotConfigured = (closerId: string, slotTime: Date) => {
    const timeStr = format(slotTime, 'HH:mm:ss');
    return daySlots.some(s => s.closer_id === closerId && s.start_time === timeStr);
  };

  const isSlotAvailable = (closerId: string, slotTime: Date) => {
    // Check if date is blocked
    const isBlocked = blockedDates.some(
      bd => bd.closer_id === closerId && isSameDay(parseISO(bd.blocked_date), selectedDate)
    );
    if (isBlocked) return false;

    // Verificar se o closer tem este horário configurado
    return isSlotConfigured(closerId, slotTime);
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
            now.getMinutes() < slot.getMinutes() + 30;

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
                              <div className="space-y-0.5">
                                {meeting.attendees?.length ? (
                                  meeting.attendees.slice(0, 3).map((att, i) => (
                                    <div key={att.id} className="flex items-center justify-between gap-1">
                                      <span className="truncate font-medium">
                                        {att.attendee_name || att.contact?.name || 'Lead'}
                                      </span>
                                      <Badge 
                                        variant="outline" 
                                        className={cn(
                                          "text-[9px] px-1 py-0 border-white/30",
                                          ATTENDEE_STATUS_CONFIG[att.status]?.bgClass || 'bg-white/20'
                                        )}
                                      >
                                        {ATTENDEE_STATUS_CONFIG[att.status]?.shortLabel || att.status}
                                      </Badge>
                                    </div>
                                  ))
                                ) : (
                                  <div className="font-medium truncate">
                                    {meeting.deal?.contact?.name || meeting.deal?.name || 'Lead'}
                                  </div>
                                )}
                                {meeting.attendees && meeting.attendees.length > 3 && (
                                  <div className="text-[10px] opacity-80">
                                    +{meeting.attendees.length - 3} mais
                                  </div>
                                )}
                              </div>
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="right" className="max-w-xs">
                            <div className="space-y-1">
                              <div className="font-semibold text-xs mb-1">Participantes:</div>
                              {meeting.attendees?.length ? (
                                meeting.attendees.map(att => (
                                  <div key={att.id} className="text-xs flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-1">
                                      <span>• {att.attendee_name || att.contact?.name || 'Lead'}</span>
                                      {att.is_partner && <Badge variant="outline" className="text-[9px] px-1 py-0">Sócio</Badge>}
                                    </div>
                                    <Badge 
                                      variant={ATTENDEE_STATUS_CONFIG[att.status]?.variant || 'outline'}
                                      className="text-[9px] px-1 py-0"
                                    >
                                      {ATTENDEE_STATUS_CONFIG[att.status]?.label || att.status}
                                    </Badge>
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
                                {meeting.status === 'contract_paid' && 'Contrato Pago'}
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
