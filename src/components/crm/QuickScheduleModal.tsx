import { useState, useMemo, useCallback } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Search, Calendar, Clock, User, Tag, Send, Phone, Mail, X, Check } from 'lucide-react';
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
  useSearchDealsByPhone,
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

// Helper to format phone for display
function formatPhoneDisplay(phone: string | null | undefined): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

export function QuickScheduleModal({ 
  open, 
  onOpenChange, 
  closers,
  preselectedCloserId,
  preselectedDate 
}: QuickScheduleModalProps) {
  // Search state
  const [nameQuery, setNameQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  
  // Phone search state
  const [phoneQuery, setPhoneQuery] = useState('');
  const [showPhoneResults, setShowPhoneResults] = useState(false);
  
  // Selected deal and auto-filled fields
  const [selectedDeal, setSelectedDeal] = useState<DealOption | null>(null);
  const [selectedEmail, setSelectedEmail] = useState('');
  const [selectedPhone, setSelectedPhone] = useState('');
  
  // Form state
  const [selectedCloser, setSelectedCloser] = useState(preselectedCloserId || '');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(preselectedDate);
  const [selectedTime, setSelectedTime] = useState(preselectedDate ? format(preselectedDate, 'HH:mm') : '09:00');
  const [notes, setNotes] = useState('');
  const [autoSendWhatsApp, setAutoSendWhatsApp] = useState(true);

  const { data: searchResults = [], isLoading: searching } = useSearchDealsForSchedule(nameQuery);
  const { data: phoneSearchResults = [], isLoading: searchingPhone } = useSearchDealsByPhone(phoneQuery);
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

  // Handle selecting a deal from search results
  const handleSelectDeal = useCallback((deal: DealOption) => {
    setSelectedDeal(deal);
    setNameQuery(deal.contact?.name || deal.name);
    setSelectedEmail(deal.contact?.email || '');
    setSelectedPhone(deal.contact?.phone || '');
    setPhoneQuery('');
    setShowResults(false);
    setShowPhoneResults(false);
  }, []);

  // Clear selection to search again
  const handleClearSelection = useCallback(() => {
    setSelectedDeal(null);
    setNameQuery('');
    setSelectedEmail('');
    setSelectedPhone('');
    setPhoneQuery('');
    setShowResults(false);
    setShowPhoneResults(false);
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
    setNameQuery('');
    setPhoneQuery('');
    setSelectedDeal(null);
    setSelectedEmail('');
    setSelectedPhone('');
    setShowResults(false);
    setShowPhoneResults(false);
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

  const isSelected = !!selectedDeal;

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
          {/* 3-Field Search Section */}
          <div className="space-y-3">
            {/* Nome Field with Search */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Nome</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Digite o nome do lead..."
                  value={nameQuery}
                  onChange={(e) => {
                    setNameQuery(e.target.value);
                    if (selectedDeal) {
                      setSelectedDeal(null);
                      setSelectedEmail('');
                      setSelectedPhone('');
                    }
                    setShowResults(e.target.value.length >= 2);
                  }}
                  onFocus={() => {
                    if (nameQuery.length >= 2 && !selectedDeal) {
                      setShowResults(true);
                    }
                  }}
                  className={cn(
                    "pl-9 pr-9",
                    isSelected && "bg-muted border-green-500/50"
                  )}
                  readOnly={isSelected}
                />
                {isSelected && (
                  <button
                    onClick={handleClearSelection}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              
              {/* Search Results with Phone for Differentiation */}
              {showResults && nameQuery.length >= 2 && !selectedDeal && (
                <div className="border rounded-md max-h-48 overflow-y-auto shadow-sm bg-popover">
                  {searching ? (
                    <div className="p-2 space-y-2">
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  ) : searchResults.length === 0 ? (
                    <p className="p-3 text-sm text-muted-foreground text-center">
                      Nenhum lead encontrado
                    </p>
                  ) : (
                    searchResults.map(deal => (
                      <button
                        key={deal.id}
                        onClick={() => handleSelectDeal(deal as DealOption)}
                        className="w-full text-left px-3 py-2.5 hover:bg-accent border-b last:border-b-0 flex items-center justify-between gap-2"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">
                            {deal.contact?.name || deal.name}
                          </div>
                          {deal.contact?.email && (
                            <div className="text-xs text-muted-foreground truncate">
                              {deal.contact.email}
                            </div>
                          )}
                        </div>
                        {deal.contact?.phone && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0 bg-muted px-2 py-1 rounded">
                            <Phone className="h-3 w-3" />
                            <span>{formatPhoneDisplay(deal.contact.phone)}</span>
                          </div>
                        )}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Email Field (read-only, auto-filled) */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Auto-preenchido ao selecionar lead"
                  value={selectedEmail}
                  readOnly
                  className={cn(
                    "pl-9 pr-9",
                    isSelected && selectedEmail && "bg-muted border-green-500/50"
                  )}
                />
                {isSelected && selectedEmail && (
                  <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
                )}
              </div>
            </div>

            {/* Telefone Field (searchable or read-only when selected) */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Telefone</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={isSelected ? "Auto-preenchido" : "Digite o telefone para buscar..."}
                  value={isSelected ? formatPhoneDisplay(selectedPhone) : phoneQuery}
                  onChange={(e) => {
                    if (!isSelected) {
                      const value = e.target.value;
                      setPhoneQuery(value);
                      setShowPhoneResults(value.replace(/\D/g, '').length >= 4);
                    }
                  }}
                  onFocus={() => {
                    if (phoneQuery.replace(/\D/g, '').length >= 4 && !isSelected) {
                      setShowPhoneResults(true);
                    }
                  }}
                  readOnly={isSelected}
                  className={cn(
                    "pl-9 pr-9",
                    isSelected && selectedPhone && "bg-muted border-green-500/50"
                  )}
                />
                {isSelected && selectedPhone && (
                  <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
                )}
              </div>

              {/* Phone Search Results */}
              {showPhoneResults && phoneQuery.replace(/\D/g, '').length >= 4 && !selectedDeal && (
                <div className="border rounded-md max-h-48 overflow-y-auto shadow-sm bg-popover">
                  {searchingPhone ? (
                    <div className="p-2 space-y-2">
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  ) : phoneSearchResults.length === 0 ? (
                    <p className="p-3 text-sm text-muted-foreground text-center">
                      Nenhum lead encontrado com esse telefone
                    </p>
                  ) : (
                    phoneSearchResults.map(deal => (
                      <button
                        key={deal.id}
                        onClick={() => handleSelectDeal(deal as DealOption)}
                        className="w-full text-left px-3 py-2.5 hover:bg-accent border-b last:border-b-0 flex items-center justify-between gap-2"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">
                            {deal.contact?.name || deal.name}
                          </div>
                        </div>
                        {deal.contact?.phone && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0 bg-muted px-2 py-1 rounded">
                            <Phone className="h-3 w-3" />
                            <span>{formatPhoneDisplay(deal.contact.phone)}</span>
                          </div>
                        )}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Lead Type Badge */}
            {selectedDeal && (
              <div className="flex items-center gap-2 pt-1">
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
                <span className="text-xs text-muted-foreground">
                  Detectado automaticamente pelas tags
                </span>
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

          {/* Slot availability indicator */}
          {selectedCloser && selectedDate && slotAvailability && (
            <div className="flex items-center justify-between p-2 rounded-md text-sm bg-muted">
              <span>
                Lead {detectedLeadType} às {selectedTime}
              </span>
              <span className="font-medium">
                {slotAvailability.currentCount === 0 
                  ? 'Ainda não possui agendamento'
                  : `Já possui ${slotAvailability.currentCount} agendamento${slotAvailability.currentCount !== 1 ? 's' : ''}`
                }
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
            disabled={!selectedDeal || !selectedCloser || !selectedDate || createMeeting.isPending}
          >
            {createMeeting.isPending ? 'Agendando...' : 'Agendar Reunião'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
