import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, Clock, User } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { MeetingSlot, CloserWithAvailability, useRescheduleMeeting } from '@/hooks/useAgendaData';
import { cn } from '@/lib/utils';

interface RescheduleModalProps {
  meeting: MeetingSlot | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  closers: CloserWithAvailability[];
}

export function RescheduleModal({ meeting, open, onOpenChange, closers }: RescheduleModalProps) {
  const [selectedCloser, setSelectedCloser] = useState(meeting?.closer_id || '');
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedTime, setSelectedTime] = useState('09:00');

  const rescheduleMeeting = useRescheduleMeeting();

  if (!meeting) return null;

  const handleSubmit = () => {
    if (!selectedDate) return;

    const [hours, minutes] = selectedTime.split(':').map(Number);
    const newDate = new Date(selectedDate);
    newDate.setHours(hours, minutes, 0, 0);

    rescheduleMeeting.mutate({
      meetingId: meeting.id,
      newDate,
      closerId: selectedCloser !== meeting.closer_id ? selectedCloser : undefined,
    }, {
      onSuccess: () => onOpenChange(false),
    });
  };

  const timeSlots = Array.from({ length: 20 }, (_, i) => {
    const hour = Math.floor(i / 2) + 8;
    const minute = (i % 2) * 30;
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Reagendar Reunião
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current Info */}
          <div className="bg-muted/50 rounded-lg p-3 text-sm">
            <div className="font-medium">
              {meeting.deal?.contact?.name || meeting.deal?.name || 'Lead'}
            </div>
            <div className="text-muted-foreground">
              Atual: {format(new Date(meeting.scheduled_at), "dd/MM 'às' HH:mm", { locale: ptBR })} com {meeting.closer?.name}
            </div>
          </div>

          {/* New Closer */}
          <div className="space-y-2">
            <Label>Closer</Label>
            <Select value={selectedCloser} onValueChange={setSelectedCloser}>
              <SelectTrigger>
                <User className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {closers.map(closer => (
                  <SelectItem key={closer.id} value={closer.id}>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: closer.color }}
                      />
                      {closer.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date and Time */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nova Data</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button 
                    variant="outline" 
                    className={cn('w-full justify-start text-left', !selectedDate && 'text-muted-foreground')}
                  >
                    {selectedDate ? format(selectedDate, 'dd/MM/yyyy') : 'Selecione'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    disabled={(date) => date < new Date(new Date().setHours(0,0,0,0))}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Horário</Label>
              <Select value={selectedTime} onValueChange={setSelectedTime}>
                <SelectTrigger>
                  <Clock className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {timeSlots.map(time => (
                    <SelectItem key={time} value={time}>
                      {time}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Submit */}
          <Button 
            className="w-full" 
            onClick={handleSubmit}
            disabled={!selectedDate || rescheduleMeeting.isPending}
          >
            {rescheduleMeeting.isPending ? 'Reagendando...' : 'Reagendar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
