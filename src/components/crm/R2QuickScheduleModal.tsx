import { useState, useMemo, useCallback, useEffect } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Search, Calendar, Clock, User, StickyNote } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { R2CloserWithAvailability, useCreateR2Meeting } from '@/hooks/useR2AgendaData';
import { useSearchDealsForSchedule } from '@/hooks/useAgendaData';
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

// Fixed time slots for R2 (9:00 to 18:00, 30-min intervals)
const TIME_SLOTS = Array.from({ length: 19 }, (_, i) => {
  const hour = Math.floor(i / 2) + 9;
  const minute = (i % 2) * 30;
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
});

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
  const [selectedTime, setSelectedTime] = useState(preselectedDate ? format(preselectedDate, 'HH:mm') : '09:00');
  const [notes, setNotes] = useState('');

  const { data: searchResults = [], isLoading: searching } = useSearchDealsForSchedule(nameQuery);
  const createMeeting = useCreateR2Meeting();

  useEffect(() => {
    if (open) {
      if (preselectedCloserId) setSelectedCloser(preselectedCloserId);
      if (preselectedDate) {
        setSelectedDate(preselectedDate);
        setSelectedTime(format(preselectedDate, 'HH:mm'));
      }
      // Pre-fill with preselectedDeal if provided
      if (preselectedDeal) {
        setSelectedDeal(preselectedDeal);
        setNameQuery(preselectedDeal.contact?.name || preselectedDeal.name);
      }
    }
  }, [open, preselectedCloserId, preselectedDate]);

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
    if (!selectedDeal || !selectedCloser || !selectedDate) return;

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
    setSelectedTime('09:00');
    setNotes('');
  };

  const isSelected = !!selectedDeal;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
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

          {/* Date and Time */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Data</Label>
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
                    locale={ptBR}
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
                  {TIME_SLOTS.map(time => (
                    <SelectItem key={time} value={time}>
                      {time}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
            disabled={!selectedDeal || !selectedCloser || !selectedDate || createMeeting.isPending}
          >
            {createMeeting.isPending ? 'Agendando...' : 'Agendar R2'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
