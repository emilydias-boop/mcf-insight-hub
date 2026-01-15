import { useState, useMemo, useCallback, useEffect } from 'react';
import { format, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Search, Calendar, Clock, User, StickyNote, ExternalLink, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Skeleton } from '@/components/ui/skeleton';
import { R2CloserWithAvailability, useCreateR2Meeting } from '@/hooks/useR2AgendaData';
import { useSearchDealsForSchedule } from '@/hooks/useAgendaData';
import { useR2CloserAvailableSlots, useR2MonthMeetings } from '@/hooks/useR2CloserAvailableSlots';
import { cn } from '@/lib/utils';

interface DealForSchedule {
  id: string;
  name: string;
  contact?: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
  } | null;
}

interface R2QuickScheduleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  closers: R2CloserWithAvailability[];
  preselectedCloserId?: string;
  preselectedDate?: Date;
  preselectedDeal?: DealForSchedule;
}

interface DealOption {
  id: string;
  name: string;
  contact?: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
  } | null;
}

export function R2QuickScheduleModal({ 
  open, 
  onOpenChange, 
  closers,
  preselectedCloserId,
  preselectedDate,
  preselectedDeal
}: R2QuickScheduleModalProps) {
  const [nameQuery, setNameQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState<DealOption | null>(null);
  const [selectedCloser, setSelectedCloser] = useState(preselectedCloserId || '');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(preselectedDate);
  const [selectedTime, setSelectedTime] = useState('');
  const [notes, setNotes] = useState('');
  const [calendarMonth, setCalendarMonth] = useState<Date>(preselectedDate || new Date());

  const { data: searchResults = [], isLoading: searching } = useSearchDealsForSchedule(nameQuery);
  const createMeeting = useCreateR2Meeting();

  // Fetch available slots for selected closer + date
  const { data: closerSlots, isLoading: loadingSlots } = useR2CloserAvailableSlots(
    selectedCloser || undefined,
    selectedDate
  );

  // Fetch month meetings for calendar indicators
  const { data: monthMeetingDates = [] } = useR2MonthMeetings(
    selectedCloser || undefined,
    calendarMonth
  );

  // Available time slots based on closer configuration
  const availableTimeSlots = useMemo(() => {
    if (!closerSlots) return [];
    return closerSlots.availableSlots.filter(s => s.isAvailable);
  }, [closerSlots]);

  // All configured slots (for showing occupied ones too)
  const allConfiguredSlots = useMemo(() => {
    if (!closerSlots) return [];
    return closerSlots.availableSlots;
  }, [closerSlots]);

  useEffect(() => {
    if (open) {
      if (preselectedCloserId) setSelectedCloser(preselectedCloserId);
      if (preselectedDate) {
        setSelectedDate(preselectedDate);
        setCalendarMonth(startOfMonth(preselectedDate));
        setSelectedTime(format(preselectedDate, 'HH:mm'));
      }
      if (preselectedDeal) {
        setSelectedDeal(preselectedDeal);
        setNameQuery(preselectedDeal.contact?.name || preselectedDeal.name);
      }
    }
  }, [open, preselectedCloserId, preselectedDate, preselectedDeal]);

  // Reset time when closer or date changes
  useEffect(() => {
    setSelectedTime('');
  }, [selectedCloser, selectedDate]);

  const handleSelectDeal = useCallback((deal: DealOption) => {
    setSelectedDeal(deal);
    setNameQuery(deal.contact?.name || deal.name);
    setShowResults(false);
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedDeal(null);
    setNameQuery('');
    setShowResults(false);
  }, []);

  const handleSubmit = () => {
    if (!selectedDeal || !selectedCloser || !selectedDate || !selectedTime) return;

    const [hours, minutes] = selectedTime.split(':').map(Number);
    const scheduledAt = new Date(selectedDate);
    scheduledAt.setHours(hours, minutes, 0, 0);

    createMeeting.mutate({
      closerId: selectedCloser,
      dealId: selectedDeal.id,
      contactId: selectedDeal.contact?.id,
      scheduledAt,
      notes,
      attendeeName: selectedDeal.contact?.name || selectedDeal.name,
      attendeePhone: selectedDeal.contact?.phone || undefined,
    }, {
      onSuccess: () => {
        onOpenChange(false);
        resetForm();
      },
    });
  };

  const resetForm = () => {
    setNameQuery('');
    setSelectedDeal(null);
    setShowResults(false);
    setSelectedCloser(preselectedCloserId || '');
    setSelectedDate(undefined);
    setSelectedTime('');
    setNotes('');
    setCalendarMonth(new Date());
  };

  const isSelected = !!selectedDeal;

  // Get placeholder text for time select
  const getTimePlaceholder = () => {
    if (!selectedCloser) return 'Selecione closer primeiro';
    if (!selectedDate) return 'Selecione data primeiro';
    if (loadingSlots) return 'Carregando...';
    if (allConfiguredSlots.length === 0) return 'Sem horários configurados';
    if (availableTimeSlots.length === 0) return 'Todos ocupados';
    return 'Selecione horário';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-purple-600" />
            Agendar Reunião R2
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search Section */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Buscar Lead</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Digite o nome do lead..."
                value={nameQuery}
                onChange={(e) => {
                  setNameQuery(e.target.value);
                  if (selectedDeal) {
                    setSelectedDeal(null);
                  }
                  setShowResults(e.target.value.length >= 2);
                }}
                className={cn("pl-9", isSelected && "bg-muted border-purple-500/50")}
                readOnly={isSelected}
              />
              {isSelected && (
                <button
                  onClick={handleClearSelection}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  ×
                </button>
              )}
            </div>

            {/* Search Results */}
            {showResults && !isSelected && (
              <div className="border rounded-md max-h-48 overflow-y-auto bg-popover">
                {searching ? (
                  <div className="p-2 space-y-2">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : searchResults.length === 0 ? (
                  <p className="p-3 text-sm text-muted-foreground text-center">
                    Nenhum resultado encontrado
                  </p>
                ) : (
                  searchResults.slice(0, 10).map(deal => (
                    <button
                      key={deal.id}
                      onClick={() => handleSelectDeal(deal)}
                      className="w-full text-left px-3 py-2 hover:bg-accent border-b last:border-b-0"
                    >
                      <div className="font-medium text-sm">{deal.contact?.name || deal.name}</div>
                      {deal.contact?.phone && (
                        <div className="text-xs text-muted-foreground">{deal.contact.phone}</div>
                      )}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Closer Selection */}
          <div className="space-y-2">
            <Label>Closer R2</Label>
            <Select value={selectedCloser} onValueChange={setSelectedCloser}>
              <SelectTrigger>
                <User className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Selecione um closer" />
              </SelectTrigger>
              <SelectContent>
                {closers.map(closer => (
                  <SelectItem key={closer.id} value={closer.id}>
                    {closer.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Calendar - Full Month View */}
          <div className="space-y-2">
            <Label>Data</Label>
            <div className="border rounded-md p-3">
              <CalendarComponent
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                month={calendarMonth}
                onMonthChange={setCalendarMonth}
                locale={ptBR}
                showOutsideDays={true}
                disabled={!selectedCloser}
                modifiers={{
                  hasBookings: monthMeetingDates,
                }}
                modifiersStyles={{
                  hasBookings: {
                    backgroundColor: 'hsl(var(--primary) / 0.2)',
                    fontWeight: 'bold',
                  },
                }}
                className="w-full"
              />
              {selectedCloser && monthMeetingDates.length > 0 && (
                <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <div className="w-3 h-3 rounded bg-primary/20" />
                  <span>Dias com reuniões agendadas</span>
                </div>
              )}
            </div>
          </div>

          {/* Time Selection - Dynamic based on closer config */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Horário
              {loadingSlots && <Loader2 className="h-3 w-3 animate-spin" />}
            </Label>
            <Select 
              value={selectedTime} 
              onValueChange={setSelectedTime}
              disabled={!selectedCloser || !selectedDate || loadingSlots || availableTimeSlots.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder={getTimePlaceholder()} />
              </SelectTrigger>
              <SelectContent>
                {allConfiguredSlots.map(slot => (
                  <SelectItem 
                    key={slot.time} 
                    value={slot.time}
                    disabled={!slot.isAvailable}
                    className={cn(!slot.isAvailable && "opacity-50")}
                  >
                    <span className="flex items-center gap-2">
                      {slot.time}
                      {slot.link && <ExternalLink className="h-3 w-3 text-muted-foreground" />}
                      {!slot.isAvailable && <span className="text-xs text-destructive">(ocupado)</span>}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedCloser && selectedDate && !loadingSlots && allConfiguredSlots.length === 0 && (
              <p className="text-xs text-amber-600">
                Este closer não tem horários configurados para {format(selectedDate, 'EEEE', { locale: ptBR })}.
              </p>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <StickyNote className="h-4 w-4" />
              Observações
            </Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas sobre a reunião R2..."
              rows={2}
            />
          </div>

          {/* Submit */}
          <Button 
            className="w-full bg-purple-600 hover:bg-purple-700" 
            onClick={handleSubmit}
            disabled={!selectedDeal || !selectedCloser || !selectedDate || !selectedTime || createMeeting.isPending}
          >
            {createMeeting.isPending ? 'Agendando...' : 'Agendar R2'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
