import { useState } from 'react';
import { format, addDays, startOfToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, Clock, Users, ArrowRight, User } from 'lucide-react';
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
import { useMeetingsForDate, useMoveAttendeeToMeeting } from '@/hooks/useAgendaData';
import { cn } from '@/lib/utils';

interface MoveAttendeeModalProps {
  attendee: {
    id: string;
    name: string;
    isPartner: boolean;
  } | null;
  currentMeetingId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MoveAttendeeModal({ 
  attendee, 
  currentMeetingId, 
  open, 
  onOpenChange 
}: MoveAttendeeModalProps) {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  
  const { data: meetings, isLoading } = useMeetingsForDate(selectedDate);
  const moveAttendee = useMoveAttendeeToMeeting();

  // Filter out the current meeting
  const availableMeetings = meetings?.filter(m => m.id !== currentMeetingId) || [];

  const handleMove = (targetMeetingId: string) => {
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

  const handleClose = () => {
    onOpenChange(false);
    setSelectedDate(null);
  };

  if (!attendee) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
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

          {/* Available Meetings */}
          {selectedDate && (
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Reuniões Disponíveis
              </label>
              
              {isLoading ? (
                <div className="text-center py-4 text-muted-foreground">
                  Carregando reuniões...
                </div>
              ) : availableMeetings.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground border rounded-lg">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Nenhuma reunião disponível nesta data</p>
                </div>
              ) : (
                <ScrollArea className="h-[200px]">
                  <div className="space-y-2 pr-4">
                    {availableMeetings.map((meeting) => {
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
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: meeting.closer?.color || '#3B82F6' }}
                              />
                              <div>
                                <div className="flex items-center gap-2">
                                  <Clock className="h-3 w-3 text-muted-foreground" />
                                  <span className="font-medium text-sm">
                                    {format(scheduledAt, 'HH:mm')}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    ({meeting.duration_minutes}min)
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <User className="h-3 w-3" />
                                  <span>{meeting.closer?.name}</span>
                                  <span>•</span>
                                  <span>{attendeeCount} participante{attendeeCount !== 1 ? 's' : ''}</span>
                                </div>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              onClick={() => handleMove(meeting.id)}
                              disabled={moveAttendee.isPending}
                            >
                              Mover
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
