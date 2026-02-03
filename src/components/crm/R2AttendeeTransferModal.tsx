import { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowRightLeft, User, Calendar as CalendarIcon, Clock, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useActiveR2Closers } from '@/hooks/useR2Closers';
import { useR2CloserAvailableSlots } from '@/hooks/useR2CloserAvailableSlots';
import { useTransferR2Attendee } from '@/hooks/useTransferR2Attendee';
import { R2AttendeeExtended, R2MeetingRow } from '@/types/r2Agenda';
import { useAuth } from '@/contexts/AuthContext';

interface R2AttendeeTransferModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  attendee: R2AttendeeExtended;
  meeting: R2MeetingRow;
  buFilter?: string;
  onSuccess?: () => void;
}

export function R2AttendeeTransferModal({
  open,
  onOpenChange,
  attendee,
  meeting,
  buFilter = 'incorporador',
  onSuccess,
}: R2AttendeeTransferModalProps) {
  const [selectedCloserId, setSelectedCloserId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [reason, setReason] = useState<string>('');

  const { role } = useAuth();
  const isAdmin = role === 'admin';

  const { data: closers = [], isLoading: loadingClosers } = useActiveR2Closers(buFilter);
  const { data: slotsData, isLoading: loadingSlots } = useR2CloserAvailableSlots(
    selectedCloserId || undefined,
    selectedDate,
    isAdmin // Admin pode ultrapassar limite de capacidade
  );
  const transferMutation = useTransferR2Attendee();

  // Initialize with current values
  useEffect(() => {
    if (open && meeting) {
      setSelectedCloserId(meeting.closer?.id || '');
      setSelectedDate(parseISO(meeting.scheduled_at));
      setSelectedTime(format(parseISO(meeting.scheduled_at), 'HH:mm'));
      setReason('');
    }
  }, [open, meeting]);

  // Reset time when date or closer changes
  useEffect(() => {
    if (selectedCloserId && selectedDate) {
      // Keep time only if it's still available
      const availableSlot = slotsData?.availableSlots?.find(s => s.time === selectedTime);
      if (!availableSlot) {
        setSelectedTime('');
      }
    }
  }, [selectedCloserId, selectedDate, slotsData?.availableSlots]);

  const handleTransfer = () => {
    if (!selectedCloserId || !selectedDate || !selectedTime) {
      return;
    }

    transferMutation.mutate(
      {
        attendeeId: attendee.id,
        targetCloserId: selectedCloserId,
        targetDate: selectedDate,
        targetTime: selectedTime,
        reason: reason || undefined,
        originalSlotId: meeting.id,
        originalCloserId: meeting.closer?.id,
        originalCloserName: meeting.closer?.name,
        originalScheduledAt: meeting.scheduled_at,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          onSuccess?.();
        },
      }
    );
  };

  const attendeeName = attendee.name || attendee.deal?.contact?.name || 'Lead';
  const attendeePhone = attendee.phone || attendee.deal?.contact?.phone;

  // Check if anything changed
  const hasChanges =
    selectedCloserId !== meeting.closer?.id ||
    (selectedDate && format(selectedDate, 'yyyy-MM-dd') !== format(parseISO(meeting.scheduled_at), 'yyyy-MM-dd')) ||
    selectedTime !== format(parseISO(meeting.scheduled_at), 'HH:mm');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-primary" />
            Transferir Participante
          </DialogTitle>
          <DialogDescription>
            Mova este participante para outro dia, horário ou closer
          </DialogDescription>
        </DialogHeader>

        {/* Participant Info */}
        <div className="bg-muted/30 rounded-lg p-3 space-y-1">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{attendeeName}</span>
          </div>
          {attendeePhone && (
            <div className="text-sm text-muted-foreground ml-6">{attendeePhone}</div>
          )}
          <div className="text-xs text-muted-foreground ml-6">
            Atual: {format(parseISO(meeting.scheduled_at), "dd/MM 'às' HH:mm")} com {meeting.closer?.name}
          </div>
        </div>

        <div className="space-y-4">
          {/* Closer Selection */}
          <div className="space-y-2">
            <Label>Closer R2</Label>
            <Select value={selectedCloserId} onValueChange={setSelectedCloserId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o closer" />
              </SelectTrigger>
              <SelectContent>
                {loadingClosers ? (
                  <div className="p-2 text-center text-sm text-muted-foreground">
                    Carregando...
                  </div>
                ) : (
                  closers.map((closer) => (
                    <SelectItem key={closer.id} value={closer.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: closer.color || '#8B5CF6' }}
                        />
                        {closer.name}
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Date Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Data</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !selectedDate && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, 'dd/MM/yyyy') : 'Selecione'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                    initialFocus
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Time Selection */}
            <div className="space-y-2">
              <Label>Horário</Label>
              <Select
                value={selectedTime}
                onValueChange={setSelectedTime}
                disabled={!selectedCloserId || !selectedDate || loadingSlots}
              >
                <SelectTrigger>
                  <SelectValue placeholder={loadingSlots ? 'Carregando...' : 'Selecione'}>
                    {selectedTime && (
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        {selectedTime}
                      </div>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {!slotsData?.availableSlots?.length ? (
                    <div className="p-2 text-center text-sm text-muted-foreground">
                      {loadingSlots ? 'Carregando...' : 'Nenhum horário configurado'}
                    </div>
                  ) : (
                    slotsData.availableSlots.map((slot) => {
                      const isFull = slot.currentCount >= slot.maxCount;
                      const isAdminOverride = isFull && isAdmin;
                      
                      return (
                        <SelectItem
                          key={slot.time}
                          value={slot.time}
                          disabled={!slot.isAvailable}
                        >
                          <div className="flex items-center justify-between gap-3 w-full">
                            <span>{slot.time}</span>
                            <Badge
                              variant={slot.isAvailable ? 'outline' : 'secondary'}
                              className={cn(
                                'text-xs',
                                isAdminOverride
                                  ? 'text-amber-600 border-amber-300'
                                  : slot.isAvailable
                                    ? 'text-green-600 border-green-300'
                                    : 'text-muted-foreground'
                              )}
                            >
                              {slot.currentCount}/{slot.maxCount}
                              {isAdminOverride && ' (Admin)'}
                            </Badge>
                          </div>
                        </SelectItem>
                      );
                    })
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <Label>Motivo (opcional)</Label>
            <Textarea
              placeholder="Ex: Cliente mudou de disponibilidade"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleTransfer}
            disabled={
              !selectedCloserId ||
              !selectedDate ||
              !selectedTime ||
              !hasChanges ||
              transferMutation.isPending
            }
          >
            {transferMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Transferindo...
              </>
            ) : (
              <>
                <ArrowRightLeft className="h-4 w-4 mr-2" />
                Transferir
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
