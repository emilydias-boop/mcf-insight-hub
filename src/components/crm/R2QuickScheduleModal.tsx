import { useState, useMemo, useCallback, useEffect } from 'react';
import { format, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Search, Calendar, Clock, User, StickyNote, ExternalLink, Loader2, UserCheck, Mail, Phone, X } from 'lucide-react';
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
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { R2CloserWithAvailability, useCreateR2Meeting } from '@/hooks/useR2AgendaData';
import { useSearchDealsForSchedule } from '@/hooks/useAgendaData';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useR2CloserAvailableSlots, useR2MonthMeetings } from '@/hooks/useR2CloserAvailableSlots';
import { useR2Bookers } from '@/hooks/useR2Bookers';
import { R2StatusOption, R2ThermometerOption } from '@/types/r2Agenda';
import { cn } from '@/lib/utils';
import { BlockedLeadCard } from './BlockedLeadCard';

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
  statusOptions: R2StatusOption[];
  thermometerOptions: R2ThermometerOption[];
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
  leadState?: 'open' | 'scheduled_future' | 'completed' | 'contract_paid' | 'won' | 'no_show';
  scheduledInfo?: {
    scheduledAt: string;
    closerName: string | null;
    meetingType: 'r1' | 'r2';
  } | null;
  blockReason?: string | null;
}

export function R2QuickScheduleModal({
  open, 
  onOpenChange, 
  closers,
  statusOptions,
  thermometerOptions,
  preselectedCloserId,
  preselectedDate,
  preselectedDeal
}: R2QuickScheduleModalProps) {
  // Basic scheduling fields
  const [searchQuery, setSearchQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState<DealOption | null>(null);
  const [selectedCloser, setSelectedCloser] = useState(preselectedCloserId || '');
  const [bookedBy, setBookedBy] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(preselectedDate);
  const [selectedTime, setSelectedTime] = useState('');
  const [calendarMonth, setCalendarMonth] = useState<Date>(preselectedDate || new Date());

  // R2-specific fields
  const [r2Observations, setR2Observations] = useState<string>('');
  const [isPreSchedule, setIsPreSchedule] = useState(false);

  const { data: searchResults = [], isLoading: searching } = useSearchDealsForSchedule(
    searchQuery,
    undefined,
    undefined,
    true,
    'r2',
  );
  const createMeeting = useCreateR2Meeting();
  const { data: r2Bookers = [] } = useR2Bookers();

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

  const MAX_PRE_SCHEDULE_PER_SLOT = 2;

  // Generate 09:00-20:00 time slots for pre-schedule mode
  const allFreeTimeSlots = useMemo(() => {
    const slots: string[] = [];
    for (let h = 9; h <= 20; h++) {
      slots.push(`${String(h).padStart(2, '0')}:00`);
      if (h < 20) slots.push(`${String(h).padStart(2, '0')}:30`);
    }
    return slots;
  }, []);

  // Pre-scheduled counts from hook
  const preScheduledCounts = useMemo(() => {
    return closerSlots?.preScheduledCounts || {};
  }, [closerSlots]);

  // Check if selected time is configured in the grid
  const isTimeConfigured = useMemo(() => {
    if (!selectedTime || !allConfiguredSlots.length) return false;
    return allConfiguredSlots.some(s => s.time === selectedTime);
  }, [selectedTime, allConfiguredSlots]);

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
        setSearchQuery(preselectedDeal.contact?.name || preselectedDeal.name);
      }
    }
  }, [open, preselectedCloserId, preselectedDate, preselectedDeal]);

  // Reset time when closer or date changes
  useEffect(() => {
    setSelectedTime('');
  }, [selectedCloser, selectedDate]);

  // Auto-detect R1 Closer for pre-scheduling
  useEffect(() => {
    if (!bookedBy) return;
    const booker = r2Bookers.find(b => b.id === bookedBy);
    setIsPreSchedule(booker?.isR1Closer ?? false);
  }, [bookedBy, r2Bookers]);

  const handleSelectDeal = useCallback((deal: DealOption) => {
    // Selecionar mesmo leads bloqueados — o form some e mostramos o
    // BlockedLeadCard explicando por que não pode agendar.
    setSelectedDeal(deal);
    setSearchQuery(deal.contact?.name || deal.name);
    setShowResults(false);
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedDeal(null);
    setSearchQuery('');
    setShowResults(false);
  }, []);

  const handleSubmit = () => {
    if (!selectedDeal || !selectedCloser || !selectedDate || !selectedTime) return;
    // Defesa adicional: nunca submeter para leads bloqueados.
    if (isLeadBlocked) return;

    const [hours, minutes] = selectedTime.split(':').map(Number);
    const scheduledAt = new Date(selectedDate);
    scheduledAt.setHours(hours, minutes, 0, 0);

    createMeeting.mutate({
      closerId: selectedCloser,
      dealId: selectedDeal.id,
      contactId: selectedDeal.contact?.id,
      scheduledAt,
      attendeeName: selectedDeal.contact?.name || selectedDeal.name,
      attendeePhone: selectedDeal.contact?.phone || undefined,
      r2Observations: r2Observations || undefined,
      bookedBy: bookedBy || undefined,
      isPreSchedule,
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
    setShowResults(false);
    setSelectedCloser(preselectedCloserId || '');
    setBookedBy('');
    setSelectedDate(undefined);
    setSelectedTime('');
    setCalendarMonth(new Date());
    setR2Observations('');
    setIsPreSchedule(false);
  };

  const isSelected = !!selectedDeal;

  // Estado bloqueado do lead selecionado (usado para mostrar o card grande
  // de aviso no lugar dos campos de form e do botão de agendar).
  const blockedLeadState = useMemo<
    'scheduled_future' | 'completed' | 'contract_paid' | 'won' | null
  >(() => {
    const state = selectedDeal?.leadState;
    if (
      state === 'scheduled_future' ||
      state === 'completed' ||
      state === 'contract_paid' ||
      state === 'won'
    ) {
      return state;
    }
    return null;
  }, [selectedDeal?.leadState]);
  const isLeadBlocked = blockedLeadState !== null;

  // Get placeholder text for time select
  const getTimePlaceholder = () => {
    if (!selectedCloser) return 'Selecione closer';
    if (!selectedDate) return 'Selecione data';
    if (loadingSlots) return 'Carregando...';
    if (isPreSchedule) return 'Selecione';
    if (allConfiguredSlots.length === 0) return 'Sem horários';
    if (availableTimeSlots.length === 0) return 'Todos ocupados';
    return 'Selecione';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg flex flex-col max-h-[90vh]">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Agendar Reunião R2
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 h-[calc(90vh-120px)]">
          <div className="space-y-4 pr-4 pb-4">
            {/* Unified Search Field */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Buscar Lead</Label>
              {!isSelected ? (
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por nome, email ou telefone..."
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setShowResults(e.target.value.length >= 2);
                      }}
                      className="pl-9 h-9"
                    />
                  </div>
                  {showResults && (
                    <div className="border rounded-md max-h-40 overflow-y-auto bg-popover">
                      {searching ? (
                        <div className="p-2 space-y-2">
                          <Skeleton className="h-10 w-full" />
                          <Skeleton className="h-10 w-full" />
                        </div>
                      ) : searchResults.length === 0 ? (
                        <p className="p-3 text-sm text-muted-foreground text-center">
                          Nenhum resultado
                        </p>
                      ) : (
                        searchResults.slice(0, 8).map((deal: any) => {
                          const leadState = deal.leadState as DealOption['leadState'];
                          const scheduledInfo = deal.scheduledInfo as DealOption['scheduledInfo'];
                          const isBlocked =
                            leadState && leadState !== 'open' && leadState !== 'no_show';

                          let stateBadge: { label: string; className: string } | null = null;
                          if (leadState === 'scheduled_future' && scheduledInfo) {
                            const dt = new Date(scheduledInfo.scheduledAt);
                            const dd = String(dt.getDate()).padStart(2, '0');
                            const mm = String(dt.getMonth() + 1).padStart(2, '0');
                            const hh = String(dt.getHours()).padStart(2, '0');
                            const mi = String(dt.getMinutes()).padStart(2, '0');
                            const closerLabel = scheduledInfo.closerName
                              ? ` c/ ${scheduledInfo.closerName}`
                              : '';
                            stateBadge = {
                              label: `📅 R2 já agendada p/ ${dd}/${mm} ${hh}:${mi}${closerLabel}`,
                              className:
                                'border-yellow-500/60 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400',
                            };
                          } else if (leadState === 'contract_paid' || leadState === 'won') {
                            stateBadge = {
                              label: '💰 Contrato pago',
                              className:
                                'border-green-500/60 bg-green-500/10 text-green-700 dark:text-green-400',
                            };
                          }

                          return (
                            <button
                              key={deal.id}
                              onClick={() => handleSelectDeal(deal)}
                              className={cn(
                                'w-full text-left px-3 py-2 border-b last:border-b-0',
                                isBlocked
                                  ? 'opacity-70 hover:bg-muted/30 border-l-[3px] ' +
                                      (leadState === 'scheduled_future'
                                        ? 'border-l-yellow-500'
                                        : 'border-l-green-500')
                                  : 'hover:bg-accent',
                              )}
                            >
                              <div className="font-medium text-sm">
                                {deal.contact?.name || deal.name}
                              </div>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                {deal.contact?.phone && <span>{deal.contact.phone}</span>}
                                {deal.contact?.email && <span>{deal.contact.email}</span>}
                              </div>
                              {stateBadge && (
                                <div className="mt-1.5">
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      'text-[11px] font-medium px-2 py-0.5 whitespace-normal text-left leading-tight w-full justify-start',
                                      stateBadge.className,
                                    )}
                                  >
                                    {stateBadge.label}
                                  </Badge>
                                </div>
                              )}
                            </button>
                          );
                        })
                      )}
                    </div>
                  )}
                </>
              ) : (
                /* Selected Lead Info Card */
                <div className="flex items-center justify-between rounded-md border border-primary/30 bg-primary/5 px-3 py-2">
                  <div className="space-y-0.5 min-w-0">
                    <div className="font-medium text-sm truncate flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-primary shrink-0" />
                      {selectedDeal.contact?.name || selectedDeal.name}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {selectedDeal.contact?.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {selectedDeal.contact.phone}
                        </span>
                      )}
                      {selectedDeal.contact?.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {selectedDeal.contact.email}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={handleClearSelection}
                    className="text-muted-foreground hover:text-foreground shrink-0 ml-2"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Responsável pelo agendamento (booked_by) */}
            <div className="space-y-2">
              <Label className="text-xs">Responsável pelo agendamento</Label>
              <Select value={bookedBy} onValueChange={setBookedBy}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Selecione responsável" />
                </SelectTrigger>
                <SelectContent>
                  {r2Bookers.map(booker => (
                    <SelectItem key={booker.id} value={booker.id}>
                      {booker.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Sócio */}
            <div className="space-y-2">
              <Label className="text-xs">Sócio</Label>
              <Select value={selectedCloser} onValueChange={setSelectedCloser}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Selecione um sócio" />
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

            {/* Date + Time - Side by Side with Popovers */}
            <div className="grid grid-cols-2 gap-3">
              {/* Date - Popover */}
              <div className="space-y-2">
                <Label className="text-xs">Data</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button 
                      variant="outline" 
                      className={cn(
                        "w-full justify-start h-9 text-left font-normal",
                        !selectedDate && "text-muted-foreground"
                      )}
                      disabled={!selectedCloser}
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {selectedDate ? format(selectedDate, 'dd/MM/yyyy') : 'Selecione'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={selectedDate}
                      onSelect={setSelectedDate}
                      month={calendarMonth}
                      onMonthChange={setCalendarMonth}
                      locale={ptBR}
                      showOutsideDays={true}
                      modifiers={{
                        hasBookings: monthMeetingDates,
                      }}
                      modifiersStyles={{
                        hasBookings: {
                          backgroundColor: 'hsl(var(--primary) / 0.2)',
                          fontWeight: 'bold',
                        },
                      }}
                    />
                    {selectedCloser && monthMeetingDates.length > 0 && (
                      <div className="p-2 border-t flex items-center gap-2 text-xs text-muted-foreground">
                        <div className="w-3 h-3 rounded bg-primary/20" />
                        <span>Dias com reuniões</span>
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
              </div>

              {/* Time */}
              <div className="space-y-2">
                <Label className="text-xs flex items-center gap-1">
                  Horário
                  {loadingSlots && <Loader2 className="h-3 w-3 animate-spin" />}
                </Label>
                <Select 
                  value={selectedTime} 
                  onValueChange={setSelectedTime}
                  disabled={!selectedCloser || !selectedDate || (loadingSlots && !isPreSchedule) || (!isPreSchedule && availableTimeSlots.length === 0)}
                >
                  <SelectTrigger className="h-9">
                    <Clock className="mr-2 h-4 w-4" />
                    <SelectValue placeholder={getTimePlaceholder()} />
                  </SelectTrigger>
                  <SelectContent>
                    {isPreSchedule ? (
                      allFreeTimeSlots.map(time => {
                        const configured = allConfiguredSlots.find(s => s.time === time);
                        const isOccupied = configured && !configured.isAvailable;
                        const count = preScheduledCounts[time] || 0;
                        const isFull = count >= MAX_PRE_SCHEDULE_PER_SLOT;
                        return (
                          <SelectItem key={time} value={time} disabled={isFull}>
                            <span className="flex items-center gap-2">
                              {time}
                              {isFull && <span className="text-xs text-destructive font-medium">(lotado)</span>}
                              {!isFull && count > 0 && <span className="text-xs text-amber-600">({count}/{MAX_PRE_SCHEDULE_PER_SLOT})</span>}
                              {!isFull && isOccupied && <span className="text-xs text-amber-600">(ocupado)</span>}
                              {!isFull && !configured && <span className="text-xs text-amber-600">(encaixe)</span>}
                            </span>
                          </SelectItem>
                        );
                      })
                    ) : (
                      allConfiguredSlots.map(slot => (
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
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {selectedCloser && selectedDate && !loadingSlots && !isPreSchedule && allConfiguredSlots.length === 0 && (
              <p className="text-xs text-amber-600">
                Closer sem horários configurados para {format(selectedDate, 'EEEE', { locale: ptBR })}.
              </p>
            )}

            {/* Warning for unconfigured time slot in pre-schedule */}
            {isPreSchedule && selectedTime && !isTimeConfigured && selectedCloser && selectedDate && (
              <div className="flex items-center gap-2 rounded-md border border-amber-400 bg-amber-50 dark:bg-amber-950/20 px-3 py-2">
                <Clock className="h-4 w-4 text-amber-600 shrink-0" />
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Horário não configurado na grade — será um encaixe. A coordenação precisará confirmar.
                </p>
              </div>
            )}

            {/* Separator */}
            <Separator className="my-2" />

            {/* R2 Observations */}
            <div className="space-y-2">
              <Label className="text-xs flex items-center gap-1">
                <StickyNote className="h-3 w-3" />
                Observações R2
              </Label>
              <Textarea
                value={r2Observations}
                onChange={(e) => setR2Observations(e.target.value)}
                placeholder="Anotações sobre a reunião..."
                rows={2}
              />
            </div>

            {/* Pre-schedule toggle */}
            {(() => {
              const selectedBooker = r2Bookers.find(b => b.id === bookedBy);
              const isAutoDetected = selectedBooker?.isR1Closer ?? false;
              return (
                <div className={cn(
                  "flex items-center justify-between rounded-lg border p-3",
                  isAutoDetected && "border-amber-400 bg-amber-50 dark:bg-amber-950/20"
                )}>
                  <div className="space-y-0.5">
                    <Label className="text-xs font-medium flex items-center gap-1.5">
                      Pré-agendamento
                      {isAutoDetected && (
                        <span className="text-[10px] font-normal text-amber-600 bg-amber-100 dark:bg-amber-900/40 px-1.5 py-0.5 rounded">
                          Closer R1
                        </span>
                      )}
                    </Label>
                    <p className="text-xs text-muted-foreground">Aguarda confirmação antes de ficar oficial</p>
                  </div>
                  <Switch checked={isPreSchedule} onCheckedChange={setIsPreSchedule} />
                </div>
              );
            })()}

            {/* Submit */}
            <Button 
              className="w-full bg-primary hover:bg-primary/90 mt-4" 
              onClick={handleSubmit}
              disabled={!selectedDeal || !selectedCloser || !selectedDate || !selectedTime || createMeeting.isPending}
            >
              {createMeeting.isPending ? 'Agendando...' : isPreSchedule ? 'Pré-agendar R2' : 'Agendar R2'}
            </Button>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
