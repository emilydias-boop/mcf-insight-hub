import { useState, useMemo } from 'react';
import { Calendar, Clock, User, Check, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAvailableSlots, useDealMeetings, AvailableSlot } from '@/hooks/useCloserScheduling';
import { useBookMeetingWithCalendly } from '@/hooks/useCalendlyIntegration';
import { MeetingLinkShare } from '@/components/crm/MeetingLinkShare';
import { format, addDays, startOfDay, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface CloserSchedulerProps {
  dealId: string;
  contactId?: string;
  contactPhone?: string;
  contactName?: string;
  leadType?: string;
  onScheduled?: () => void;
}

export function CloserScheduler({ 
  dealId, 
  contactId, 
  contactPhone,
  contactName,
  leadType = 'A',
  onScheduled 
}: CloserSchedulerProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()));
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [scheduledMeeting, setScheduledMeeting] = useState<{
    meetingLink: string;
    closerName: string;
    scheduledAt: string;
  } | null>(null);
  
  const startDate = addDays(startOfDay(new Date()), weekOffset * 7);
  const { slots, isLoading } = useAvailableSlots(startDate, 7);
  const { data: existingMeetings } = useDealMeetings(dealId);
  const bookMeeting = useBookMeetingWithCalendly();
  
  // Check if there's already a scheduled meeting
  const hasScheduledMeeting = existingMeetings?.some(m => m.status === 'scheduled');
  
  // Generate days for the week view
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(startDate, i));
  }, [startDate]);
  
  // Group slots by date
  const slotsByDate = useMemo(() => {
    const grouped: Record<string, AvailableSlot[]> = {};
    slots.forEach(slot => {
      const dateKey = format(slot.datetime, 'yyyy-MM-dd');
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(slot);
    });
    return grouped;
  }, [slots]);
  
  // Get slots for selected date
  const selectedDateSlots = useMemo(() => {
    const dateKey = format(selectedDate, 'yyyy-MM-dd');
    return slotsByDate[dateKey] || [];
  }, [selectedDate, slotsByDate]);
  
  // Group by closer for display
  const slotsByCloser = useMemo(() => {
    const grouped: Record<string, AvailableSlot[]> = {};
    selectedDateSlots.forEach(slot => {
      if (!grouped[slot.closerName]) grouped[slot.closerName] = [];
      grouped[slot.closerName].push(slot);
    });
    return grouped;
  }, [selectedDateSlots]);
  
  const handleBook = async () => {
    if (!selectedSlot) return;
    
    try {
      const result = await bookMeeting.mutateAsync({
        closerId: selectedSlot.closerId,
        dealId,
        contactId,
        scheduledAt: selectedSlot.datetime,
        durationMinutes: selectedSlot.duration,
        leadType,
      });
      
      toast.success('Reunião agendada com sucesso!', {
        description: `${format(selectedSlot.datetime, "dd/MM 'às' HH:mm", { locale: ptBR })} com ${selectedSlot.closerName}`,
      });
      
      // Show meeting link share
      setScheduledMeeting({
        meetingLink: result.meetingLink,
        closerName: selectedSlot.closerName,
        scheduledAt: selectedSlot.datetime.toISOString(),
      });
      
      setSelectedSlot(null);
      onScheduled?.();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao agendar reunião');
      console.error(error);
    }
  };
  
  // Show link share after scheduling
  if (scheduledMeeting) {
    return (
      <div className="space-y-3">
        <MeetingLinkShare
          meetingLink={scheduledMeeting.meetingLink}
          closerName={scheduledMeeting.closerName}
          scheduledAt={scheduledMeeting.scheduledAt}
          contactPhone={contactPhone}
          contactName={contactName}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => setScheduledMeeting(null)}
          className="w-full"
        >
          Agendar Outra Reunião
        </Button>
      </div>
    );
  }
  
  if (hasScheduledMeeting) {
    const scheduled = existingMeetings?.find(m => m.status === 'scheduled');
    return (
      <div className="space-y-3">
        <MeetingLinkShare
          meetingLink={scheduled?.meeting_link || ''}
          closerName={scheduled?.closers?.name || 'Closer'}
          scheduledAt={scheduled?.scheduled_at || new Date().toISOString()}
          contactPhone={contactPhone}
          contactName={contactName}
        />
      </div>
    );
  }
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      {/* Week Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setWeekOffset(Math.max(0, weekOffset - 1))}
          disabled={weekOffset === 0}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium">
          {format(weekDays[0], "dd MMM", { locale: ptBR })} - {format(weekDays[6], "dd MMM", { locale: ptBR })}
        </span>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setWeekOffset(weekOffset + 1)}
          disabled={weekOffset >= 3}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      
      {/* Day Selector */}
      <div className="flex gap-1">
        {weekDays.map(day => {
          const dateKey = format(day, 'yyyy-MM-dd');
          const hasSlots = slotsByDate[dateKey]?.length > 0;
          const isSelected = isSameDay(day, selectedDate);
          const isPast = day < startOfDay(new Date());
          
          return (
            <button
              key={dateKey}
              onClick={() => !isPast && setSelectedDate(day)}
              disabled={isPast || !hasSlots}
              className={cn(
                "flex-1 py-2 px-1 rounded-lg text-center transition-colors",
                isSelected && "bg-primary text-primary-foreground",
                !isSelected && hasSlots && "bg-muted hover:bg-muted/80",
                !isSelected && !hasSlots && "opacity-50",
                isPast && "opacity-30 cursor-not-allowed"
              )}
            >
              <div className="text-xs font-medium">
                {format(day, 'EEE', { locale: ptBR })}
              </div>
              <div className="text-lg font-bold">
                {format(day, 'd')}
              </div>
              {hasSlots && !isPast && (
                <div className={cn(
                  "w-1.5 h-1.5 rounded-full mx-auto mt-1",
                  isSelected ? "bg-primary-foreground" : "bg-green-500"
                )} />
              )}
            </button>
          );
        })}
      </div>
      
      {/* Time Slots */}
      <div className="border rounded-lg">
        <div className="p-2 bg-muted/50 border-b">
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">
              {format(selectedDate, "EEEE, d 'de' MMMM", { locale: ptBR })}
            </span>
          </div>
        </div>
        
        <ScrollArea className="h-[200px]">
          <div className="p-2 space-y-3">
            {Object.keys(slotsByCloser).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum horário disponível neste dia
              </p>
            ) : (
              Object.entries(slotsByCloser).map(([closerName, closerSlots]) => (
                <div key={closerName} className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <User className="h-3 w-3" />
                    <span>{closerName}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {closerSlots.map((slot, idx) => {
                      const isSelected = selectedSlot?.datetime.getTime() === slot.datetime.getTime() 
                        && selectedSlot?.closerId === slot.closerId;
                      
                      return (
                        <button
                          key={idx}
                          onClick={() => setSelectedSlot(isSelected ? null : slot)}
                          className={cn(
                            "px-2.5 py-1.5 text-xs rounded-md border transition-colors",
                            isSelected 
                              ? "bg-primary text-primary-foreground border-primary" 
                              : "bg-background hover:bg-muted border-border"
                          )}
                        >
                          <Clock className="h-3 w-3 inline mr-1" />
                          {format(slot.datetime, 'HH:mm')}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>
      
      {/* Confirm Button */}
      {selectedSlot && (
        <div className="space-y-2">
          <div className="p-2 bg-primary/5 rounded-lg border border-primary/20">
            <p className="text-sm">
              <span className="font-medium">{format(selectedSlot.datetime, "dd/MM 'às' HH:mm", { locale: ptBR })}</span>
              {' '}com <span className="font-medium">{selectedSlot.closerName}</span>
            </p>
          </div>
          <Button 
            className="w-full" 
            onClick={handleBook}
            disabled={bookMeeting.isPending}
          >
            {bookMeeting.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Agendando...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Confirmar Agendamento
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
