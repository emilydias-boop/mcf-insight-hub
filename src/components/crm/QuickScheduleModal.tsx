import { useState, useMemo, useCallback } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Search, Calendar, Clock, User, Tag, Send } from 'lucide-react';
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
import { Switch } from '@/components/ui/switch';
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
  useCreateMeeting,
  useCheckSlotAvailability,
  useSendMeetingNotification,
} from '@/hooks/useAgendaData';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

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
  tags?: string[];
  contact?: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
  } | null;
}

type LeadType = 'A' | 'B';

// Helper to detect lead type from tags
function detectLeadType(tags?: string[]): LeadType {
  if (!tags || tags.length === 0) return 'A';
  const tagsLower = tags.map(t => t.toLowerCase());
  if (tagsLower.some(t => t.includes('lead b') || t.includes('tipo b') || t === 'b')) {
    return 'B';
  }
  return 'A';
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
  const [autoSendWhatsApp, setAutoSendWhatsApp] = useState(true);

  const { data: searchResults = [], isLoading: searching } = useSearchDealsForSchedule(searchQuery);
  const createMeeting = useCreateMeeting();
  const sendNotification = useSendMeetingNotification();

  // Detect lead type from selected deal
  const detectedLeadType = useMemo(() => {
    return detectLeadType(selectedDeal?.tags);
  }, [selectedDeal?.tags]);

  // Check slot availability
  const scheduledAtForCheck = useMemo(() => {
    if (!selectedDate) return undefined;
    const [hours, minutes] = selectedTime.split(':').map(Number);
    const date = new Date(selectedDate);
    date.setHours(hours, minutes, 0, 0);
    return date;
  }, [selectedDate, selectedTime]);

  const { data: slotAvailability } = useCheckSlotAvailability(
    selectedCloser,
    scheduledAtForCheck,
    detectedLeadType
  );

  const handleSelectDeal = (deal: DealOption) => {
    setSelectedDeal(deal);
    setSearchQuery(deal.contact?.name || deal.name);
  };

  const handleSubmit = () => {
    if (!selectedDeal || !selectedCloser || !selectedDate) return;

    // Check if slot is available
    if (slotAvailability && !slotAvailability.available) {
      toast.error(`Horário cheio: ${slotAvailability.currentCount}/${slotAvailability.maxSlots} Lead ${detectedLeadType}`);
      return;
    }

    const [hours, minutes] = selectedTime.split(':').map(Number);
    const scheduledAt = new Date(selectedDate);
    scheduledAt.setHours(hours, minutes, 0, 0);

    createMeeting.mutate({
      closerId: selectedCloser,
      dealId: selectedDeal.id,
      contactId: selectedDeal.contact?.id,
      scheduledAt,
      notes,
      leadType: detectedLeadType,
      sendNotification: autoSendWhatsApp,
    }, {
      onSuccess: (data) => {
        // Send WhatsApp notification if enabled
        if (autoSendWhatsApp && data?.id) {
          sendNotification.mutate({ meetingSlotId: data.id });
        }
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
    setAutoSendWhatsApp(true);
  };

  const timeSlots = useMemo(() => {
    return Array.from({ length: 22 }, (_, i) => {
      const hour = Math.floor(i / 2) + 8;
      const minute = (i % 2) * 30;
      return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    });
  }, []);

  // Check which time slots are full
  const getTimeSlotStatus = useCallback((time: string) => {
    if (!slotAvailability) return { isFull: false };
    // Only check the selected time
    if (time === selectedTime) {
      return { 
        isFull: !slotAvailability.available,
        count: slotAvailability.currentCount,
        max: slotAvailability.maxSlots,
      };
    }
    return { isFull: false };
  }, [slotAvailability, selectedTime]);

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
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm">{selectedDeal.contact?.name || selectedDeal.name}</div>
                    {selectedDeal.contact?.phone && (
                      <div className="text-xs text-muted-foreground">{selectedDeal.contact.phone}</div>
                    )}
                  </div>
                  <Badge 
                    variant="outline" 
                    className={cn(
                      "font-semibold",
                      detectedLeadType === 'A' ? 'border-blue-500 text-blue-600' : 'border-purple-500 text-purple-600'
                    )}
                  >
                    <Tag className="h-3 w-3 mr-1" />
                    Lead {detectedLeadType}
                  </Badge>
                </div>
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
                <SelectTrigger className={cn(slotAvailability && !slotAvailability.available && 'border-destructive')}>
                  <Clock className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {timeSlots.map(time => {
                    const status = getTimeSlotStatus(time);
                    return (
                      <SelectItem 
                        key={time} 
                        value={time}
                        className={cn(status.isFull && 'opacity-50')}
                      >
                        <span className={cn(status.isFull && 'line-through')}>
                          {time}
                        </span>
                        {status.isFull && (
                          <span className="ml-2 text-destructive text-xs">(cheio)</span>
                        )}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Slot availability indicator */}
          {selectedCloser && selectedDate && slotAvailability && (
            <div className={cn(
              "flex items-center justify-between p-2 rounded-md text-sm",
              slotAvailability.available ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300" : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
            )}>
              <span>
                Lead {detectedLeadType} às {selectedTime}
              </span>
              <span className="font-medium">
                {slotAvailability.currentCount}/{slotAvailability.maxSlots} slots
              </span>
            </div>
          )}

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

          {/* Auto-send WhatsApp Toggle */}
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2">
              <Send className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium">Enviar link via WhatsApp</span>
            </div>
            <Switch 
              checked={autoSendWhatsApp} 
              onCheckedChange={setAutoSendWhatsApp} 
            />
          </div>

          {/* Submit */}
          <Button 
            className="w-full" 
            onClick={handleSubmit}
            disabled={!selectedDeal || !selectedCloser || !selectedDate || createMeeting.isPending || (slotAvailability && !slotAvailability.available)}
          >
            {createMeeting.isPending ? 'Agendando...' : (slotAvailability && !slotAvailability.available) ? 'Horário Cheio' : 'Agendar Reunião'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
