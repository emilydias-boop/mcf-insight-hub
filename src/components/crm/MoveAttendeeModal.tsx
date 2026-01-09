import { useState, useMemo } from 'react';
import { format, startOfToday, setHours, setMinutes, addMinutes, isBefore, isAfter, startOfDay, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, Clock, Users, ArrowRight, User, AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useMeetingsForDate, useMoveAttendeeToMeeting } from '@/hooks/useAgendaData';
import { useClosers, useCloserAvailability, useBookedSlots } from '@/hooks/useCloserScheduling';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface MoveAttendeeModalProps {
  attendee: {
    id: string;
    name: string;
    isPartner: boolean;
  } | null;
  currentMeetingId: string | null;
  currentMeetingDate?: Date; // Data atual da reunião para validação
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface AvailableSlot {
  closerId: string;
  closerName: string;
  closerColor: string;
  datetime: Date;
  duration: number;
}

export function MoveAttendeeModal({ 
  attendee, 
  currentMeetingId,
  currentMeetingDate,
  open, 
  onOpenChange 
}: MoveAttendeeModalProps) {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [selectedCloser, setSelectedCloser] = useState<string | null>(null);
  const queryClient = useQueryClient();
  
  const { data: closers } = useClosers();
  const { data: availability } = useCloserAvailability();
  const { data: bookedSlots } = useBookedSlots(
    selectedDate || new Date(), 
    selectedDate || new Date()
  );
  const { data: meetings, isLoading: meetingsLoading } = useMeetingsForDate(selectedDate);
  const moveAttendee = useMoveAttendeeToMeeting();

  // Calculate available slots for the selected date
  const availableSlots = useMemo(() => {
    if (!selectedDate || !closers || !availability) return [];
    
    const dayOfWeek = selectedDate.getDay();
    const dayAvailability = availability.filter(a => a.day_of_week === dayOfWeek);
    
    const slots: AvailableSlot[] = [];
    
    for (const avail of dayAvailability) {
      const closer = closers.find(c => c.id === avail.closer_id);
      if (!closer) continue;
      
      // Parse start and end times
      const [startHour, startMin] = avail.start_time.split(':').map(Number);
      const [endHour, endMin] = avail.end_time.split(':').map(Number);
      
      let slotTime = setMinutes(setHours(startOfDay(selectedDate), startHour), startMin);
      const endTime = setMinutes(setHours(startOfDay(selectedDate), endHour), endMin);
      
      // Generate slots
      while (isBefore(slotTime, endTime)) {
        // Check if slot is in the future
        if (isAfter(slotTime, new Date())) {
          // Check if slot is not already booked
          const isBooked = bookedSlots?.some(booked => {
            const bookedTime = new Date(booked.scheduled_at);
            return booked.closer_id === closer.id && 
              Math.abs(bookedTime.getTime() - slotTime.getTime()) < avail.slot_duration_minutes * 60 * 1000;
          });
          
          if (!isBooked) {
            slots.push({
              closerId: closer.id,
              closerName: closer.name,
              closerColor: (closer as any).color || '#3B82F6',
              datetime: new Date(slotTime),
              duration: avail.slot_duration_minutes,
            });
          }
        }
        
        slotTime = addMinutes(slotTime, avail.slot_duration_minutes);
      }
    }
    
    return slots.sort((a, b) => a.datetime.getTime() - b.datetime.getTime());
  }, [selectedDate, closers, availability, bookedSlots]);

  // Filter out the current meeting
  const existingMeetings = meetings?.filter(m => m.id !== currentMeetingId) || [];

  // Verificar se a data selecionada é diferente da data atual da reunião
  const isDifferentDay = useMemo(() => {
    if (!selectedDate || !currentMeetingDate) return false;
    return !isSameDay(selectedDate, currentMeetingDate);
  }, [selectedDate, currentMeetingDate]);

  // Apply closer filter
  const filteredSlots = useMemo(() => {
    if (!selectedCloser) return availableSlots;
    return availableSlots.filter(slot => slot.closerId === selectedCloser);
  }, [availableSlots, selectedCloser]);

  const filteredMeetings = useMemo(() => {
    if (!selectedCloser) return existingMeetings;
    return existingMeetings.filter(m => m.closer?.id === selectedCloser);
  }, [existingMeetings, selectedCloser]);

  // Mutation para atualizar o slot existente (remanejamento mesmo dia - NÃO cria novo agendamento)
  const updateExistingSlot = useMutation({
    mutationFn: async ({ slot }: { slot: AvailableSlot }) => {
      if (!currentMeetingId) throw new Error('No meeting ID');

      // Atualiza o slot existente com novo horário/closer (não cria registro novo)
      const { error } = await supabase
        .from('meeting_slots')
        .update({
          closer_id: slot.closerId,
          scheduled_at: slot.datetime.toISOString(),
          duration_minutes: slot.duration,
        })
        .eq('id', currentMeetingId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agenda-meetings'] });
      queryClient.invalidateQueries({ queryKey: ['agenda-stats'] });
      queryClient.invalidateQueries({ queryKey: ['meeting_slots'] });
      queryClient.invalidateQueries({ queryKey: ['booked-slots'] });
      toast.success('Reunião remanejada com sucesso');
      onOpenChange(false);
      setSelectedDate(null);
    },
    onError: () => {
      toast.error('Erro ao remanejar reunião');
    },
  });

  const handleMoveToExisting = (targetMeetingId: string) => {
    if (!attendee) return;
    
    moveAttendee.mutate(
      { attendeeId: attendee.id, targetMeetingSlotId: targetMeetingId },
      {
        onSuccess: () => {
          onOpenChange(false);
          setSelectedDate(null);
        }
      }
    );
  };

  const handleMoveToNewSlot = (slot: AvailableSlot) => {
    // Remanejamento no mesmo dia: atualiza slot existente (não conta como novo agendamento)
    updateExistingSlot.mutate({ slot });
  };

  const handleClose = () => {
    onOpenChange(false);
    setSelectedDate(null);
    setSelectedCloser(null);
  };

  const isLoading = meetingsLoading || updateExistingSlot.isPending || moveAttendee.isPending;

  if (!attendee) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRight className="h-5 w-5" />
            Mover Participante
          </DialogTitle>
          <DialogDescription>
            Movendo <strong>{attendee.name}</strong> para outra reunião.
            {attendee.isPartner && (
              <Badge variant="outline" className="ml-2">Sócio</Badge>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Date Picker */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Selecionar Data</label>
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left">
                  <Calendar className="h-4 w-4 mr-2" />
                  {selectedDate 
                    ? format(selectedDate, "EEEE, dd 'de' MMMM", { locale: ptBR })
                    : 'Escolha uma data'
                  }
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={selectedDate || undefined}
                  onSelect={(date) => {
                    setSelectedDate(date || null);
                    setCalendarOpen(false);
                  }}
                  disabled={(date) => date < startOfToday()}
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Closer Filter */}
          {selectedDate && closers && closers.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Filtrar por Closer</label>
              <Select
                value={selectedCloser || 'all'}
                onValueChange={(value) => setSelectedCloser(value === 'all' ? null : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos os closers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os closers</SelectItem>
                  {closers.map((closer) => (
                    <SelectItem key={closer.id} value={closer.id}>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: (closer as any).color || '#3B82F6' }}
                        />
                        {closer.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Alerta para dias diferentes */}
          {selectedDate && isDifferentDay && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Para mover para outro dia, primeiro marque como <strong>"No-Show"</strong>. 
                Apenas remanejamentos no mesmo dia (horário ou closer) são permitidos.
              </AlertDescription>
            </Alert>
          )}

          {/* Available Slots & Meetings */}
          {selectedDate && !isDifferentDay && (
            <ScrollArea className="h-[300px]">
              <div className="space-y-4 pr-4">
                {/* Available Slots Section */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">
                    Slots Disponíveis
                  </label>
                  
                  {filteredSlots.length === 0 ? (
                    <div className="text-center py-4 text-muted-foreground border rounded-lg">
                      <Clock className="h-6 w-6 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Nenhum slot disponível</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filteredSlots.map((slot, idx) => (
                        <div
                          key={`slot-${slot.closerId}-${slot.datetime.getTime()}-${idx}`}
                          className="border rounded-lg p-3 hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div 
                                className="w-3 h-3 rounded-full shrink-0"
                                style={{ backgroundColor: slot.closerColor }}
                              />
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-sm">
                                    {slot.closerName}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <Clock className="h-3 w-3" />
                                  <span>{format(slot.datetime, 'HH:mm')}</span>
                                  <span>•</span>
                                  <span>{slot.duration}min</span>
                                </div>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              onClick={() => handleMoveToNewSlot(slot)}
                              disabled={isLoading}
                            >
                              Mover
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Existing Meetings Section */}
                {filteredMeetings.length > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-muted-foreground">
                        Encaixar em Reunião Existente
                      </label>
                      
                      <div className="space-y-2">
                        {filteredMeetings.map((meeting) => {
                          const attendeeCount = meeting.attendees?.filter(a => !a.is_partner).length || 0;
                          const scheduledAt = new Date(meeting.scheduled_at);
                          
                          return (
                            <div
                              key={meeting.id}
                              className="border rounded-lg p-3 hover:bg-muted/50 transition-colors"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div 
                                    className="w-3 h-3 rounded-full shrink-0"
                                    style={{ backgroundColor: meeting.closer?.color || '#3B82F6' }}
                                  />
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium text-sm">
                                        {meeting.closer?.name}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                      <Clock className="h-3 w-3" />
                                      <span>{format(scheduledAt, 'HH:mm')}</span>
                                      <span>•</span>
                                      <Users className="h-3 w-3" />
                                      <span>{attendeeCount} participante{attendeeCount !== 1 ? 's' : ''}</span>
                                    </div>
                                  </div>
                                </div>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleMoveToExisting(meeting.id)}
                                  disabled={isLoading}
                                >
                                  Encaixar
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </ScrollArea>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
