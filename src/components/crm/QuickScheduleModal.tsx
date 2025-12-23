import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Search, Calendar, Clock, User } from 'lucide-react';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  CloserWithAvailability, 
  useSearchDealsForSchedule, 
  useCreateMeeting 
} from '@/hooks/useAgendaData';
import { cn } from '@/lib/utils';

interface QuickScheduleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  closers: CloserWithAvailability[];
  preselectedCloserId?: string;
  preselectedDate?: Date;
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

export function QuickScheduleModal({ 
  open, 
  onOpenChange, 
  closers,
  preselectedCloserId,
  preselectedDate 
}: QuickScheduleModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDeal, setSelectedDeal] = useState<DealOption | null>(null);
  const [selectedCloser, setSelectedCloser] = useState(preselectedCloserId || '');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(preselectedDate);
  const [selectedTime, setSelectedTime] = useState(preselectedDate ? format(preselectedDate, 'HH:mm') : '09:00');
  const [notes, setNotes] = useState('');

  const { data: searchResults = [], isLoading: searching } = useSearchDealsForSchedule(searchQuery);
  const createMeeting = useCreateMeeting();

  const handleSelectDeal = (deal: DealOption) => {
    setSelectedDeal(deal);
    setSearchQuery(deal.contact?.name || deal.name);
  };

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
    }, {
      onSuccess: () => {
        onOpenChange(false);
        resetForm();
      },
    });
  };

  const resetForm = () => {
    setSearchQuery('');
    setSelectedDeal(null);
    setSelectedCloser(preselectedCloserId || '');
    setSelectedDate(undefined);
    setSelectedTime('09:00');
    setNotes('');
  };

  const timeSlots = Array.from({ length: 20 }, (_, i) => {
    const hour = Math.floor(i / 2) + 8;
    const minute = (i % 2) * 30;
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Agendar Reunião
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Deal Search */}
          <div className="space-y-2">
            <Label>Buscar Lead/Negócio</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Digite o nome do lead..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (selectedDeal) setSelectedDeal(null);
                }}
                className="pl-9"
              />
            </div>
            
            {/* Search Results */}
            {searchQuery.length >= 2 && !selectedDeal && (
              <div className="border rounded-md max-h-40 overflow-y-auto">
                {searching ? (
                  <div className="p-2 space-y-2">
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                  </div>
                ) : searchResults.length === 0 ? (
                  <p className="p-3 text-sm text-muted-foreground text-center">
                    Nenhum resultado
                  </p>
                ) : (
                  searchResults.map(deal => (
                    <button
                      key={deal.id}
                      onClick={() => handleSelectDeal(deal as DealOption)}
                      className="w-full text-left px-3 py-2 hover:bg-accent text-sm border-b last:border-b-0"
                    >
                      <div className="font-medium">{deal.contact?.name || deal.name}</div>
                      {deal.contact?.phone && (
                        <div className="text-xs text-muted-foreground">{deal.contact.phone}</div>
                      )}
                    </button>
                  ))
                )}
              </div>
            )}

            {selectedDeal && (
              <div className="bg-muted/50 rounded-md p-3">
                <div className="font-medium text-sm">{selectedDeal.contact?.name || selectedDeal.name}</div>
                {selectedDeal.contact?.phone && (
                  <div className="text-xs text-muted-foreground">{selectedDeal.contact.phone}</div>
                )}
              </div>
            )}
          </div>

          {/* Closer Selection */}
          <div className="space-y-2">
            <Label>Closer</Label>
            <Select value={selectedCloser} onValueChange={setSelectedCloser}>
              <SelectTrigger>
                <User className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Selecione o closer" />
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
              <Label>Data</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn('w-full justify-start text-left', !selectedDate && 'text-muted-foreground')}>
                    <Calendar className="h-4 w-4 mr-2" />
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

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notas (opcional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Adicione observações..."
              rows={2}
            />
          </div>

          {/* Submit */}
          <Button 
            className="w-full" 
            onClick={handleSubmit}
            disabled={!selectedDeal || !selectedCloser || !selectedDate || createMeeting.isPending}
          >
            {createMeeting.isPending ? 'Agendando...' : 'Agendar Reunião'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
