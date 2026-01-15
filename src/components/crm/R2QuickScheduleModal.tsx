import { useState, useMemo, useCallback, useEffect } from 'react';
import { format, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Search, Calendar, Clock, User, StickyNote, ExternalLink, Loader2, Link2, FileText, Tag, UserCheck, Mail, Phone, X } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { R2CloserWithAvailability, useCreateR2Meeting } from '@/hooks/useR2AgendaData';
import { useSearchDealsForSchedule, useSearchDealsByPhone, useSearchDealsByEmail } from '@/hooks/useAgendaData';
import { useR2CloserAvailableSlots, useR2MonthMeetings } from '@/hooks/useR2CloserAvailableSlots';
import { R2_BOOKERS_LIST } from '@/constants/team';
import { 
  R2StatusOption, 
  R2ThermometerOption, 
  LEAD_PROFILE_OPTIONS, 
  ATTENDANCE_STATUS_OPTIONS,
  VIDEO_STATUS_OPTIONS 
} from '@/types/r2Agenda';
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
  const [nameQuery, setNameQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState<DealOption | null>(null);
  const [selectedCloser, setSelectedCloser] = useState(preselectedCloserId || '');
  const [bookedBy, setBookedBy] = useState<string>(''); // Quem agendou
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(preselectedDate);
  const [selectedTime, setSelectedTime] = useState('');
  const [calendarMonth, setCalendarMonth] = useState<Date>(preselectedDate || new Date());

  // Phone search state
  const [phoneQuery, setPhoneQuery] = useState('');
  const [showPhoneResults, setShowPhoneResults] = useState(false);

  // Email search state
  const [emailQuery, setEmailQuery] = useState('');
  const [showEmailResults, setShowEmailResults] = useState(false);

  // Selected contact fields (auto-filled after selection)
  const [selectedEmail, setSelectedEmail] = useState('');
  const [selectedPhone, setSelectedPhone] = useState('');

  // R2-specific fields
  const [leadProfile, setLeadProfile] = useState<string>('');
  const [attendanceStatus, setAttendanceStatus] = useState<string>('invited');
  const [videoStatus, setVideoStatus] = useState<string>('pendente');
  const [r2StatusId, setR2StatusId] = useState<string>('');
  const [thermometerIds, setThermometerIds] = useState<string[]>([]);
  const [meetingLink, setMeetingLink] = useState<string>('');
  const [r2Confirmation, setR2Confirmation] = useState<string>('');
  const [r2Observations, setR2Observations] = useState<string>('');

  const { data: searchResults = [], isLoading: searching } = useSearchDealsForSchedule(nameQuery);
  const { data: phoneSearchResults = [], isLoading: searchingPhone } = useSearchDealsByPhone(phoneQuery);
  const { data: emailSearchResults = [], isLoading: searchingEmail } = useSearchDealsByEmail(emailQuery);
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
    setSelectedEmail(deal.contact?.email || '');
    setSelectedPhone(deal.contact?.phone || '');
    setPhoneQuery('');
    setEmailQuery('');
    setShowResults(false);
    setShowPhoneResults(false);
    setShowEmailResults(false);
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedDeal(null);
    setNameQuery('');
    setSelectedEmail('');
    setSelectedPhone('');
    setPhoneQuery('');
    setEmailQuery('');
    setShowResults(false);
    setShowPhoneResults(false);
    setShowEmailResults(false);
  }, []);

  const toggleThermometer = (id: string) => {
    setThermometerIds(prev => 
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    );
  };

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
      attendeeName: selectedDeal.contact?.name || selectedDeal.name,
      attendeePhone: selectedDeal.contact?.phone || undefined,
      // R2-specific fields
      leadProfile: leadProfile || undefined,
      attendanceStatus: attendanceStatus || 'invited',
      videoStatus: (videoStatus as 'ok' | 'pendente') || 'pendente',
      r2StatusId: r2StatusId || undefined,
      thermometerIds: thermometerIds.length > 0 ? thermometerIds : undefined,
      meetingLink: meetingLink || undefined,
      r2Confirmation: r2Confirmation || undefined,
      r2Observations: r2Observations || undefined,
      bookedBy: bookedBy || undefined,
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
    setBookedBy('');
    setSelectedDate(undefined);
    setSelectedTime('');
    setCalendarMonth(new Date());
    // Reset phone/email search
    setPhoneQuery('');
    setEmailQuery('');
    setSelectedEmail('');
    setSelectedPhone('');
    setShowPhoneResults(false);
    setShowEmailResults(false);
    // Reset R2-specific fields
    setLeadProfile('');
    setAttendanceStatus('invited');
    setVideoStatus('pendente');
    setR2StatusId('');
    setThermometerIds([]);
    setMeetingLink('');
    setR2Confirmation('');
    setR2Observations('');
  };

  const isSelected = !!selectedDeal;

  // Get placeholder text for time select
  const getTimePlaceholder = () => {
    if (!selectedCloser) return 'Selecione closer';
    if (!selectedDate) return 'Selecione data';
    if (loadingSlots) return 'Carregando...';
    if (allConfiguredSlots.length === 0) return 'Sem horários';
    if (availableTimeSlots.length === 0) return 'Todos ocupados';
    return 'Selecione';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg flex flex-col max-h-[90vh]">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-purple-600" />
            Agendar Reunião R2
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 h-[calc(90vh-120px)]">
          <div className="space-y-4 pr-4 pb-4">
            {/* Search Section - 3 Fields like R1 */}
            <div className="space-y-3">
              {/* Name Search */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Nome</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome..."
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
                    className={cn("pl-9 h-9", isSelected && "bg-green-50 border-green-500 dark:bg-green-950/30")}
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
                {showResults && !isSelected && (
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
                      searchResults.slice(0, 8).map(deal => (
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

              {/* Email Search */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por email..."
                    value={isSelected ? selectedEmail : emailQuery}
                    onChange={(e) => {
                      if (!isSelected) {
                        setEmailQuery(e.target.value);
                        setShowEmailResults(e.target.value.length >= 3);
                      }
                    }}
                    className={cn("pl-9 h-9", isSelected && "bg-green-50 border-green-500 dark:bg-green-950/30")}
                    readOnly={isSelected}
                  />
                </div>
                {showEmailResults && !isSelected && (
                  <div className="border rounded-md max-h-40 overflow-y-auto bg-popover">
                    {searchingEmail ? (
                      <div className="p-2 space-y-2">
                        <Skeleton className="h-10 w-full" />
                      </div>
                    ) : emailSearchResults.length === 0 ? (
                      <p className="p-3 text-sm text-muted-foreground text-center">
                        Nenhum resultado
                      </p>
                    ) : (
                      emailSearchResults.slice(0, 8).map(deal => (
                        <button
                          key={deal.id}
                          onClick={() => handleSelectDeal(deal)}
                          className="w-full text-left px-3 py-2 hover:bg-accent border-b last:border-b-0"
                        >
                          <div className="font-medium text-sm">{deal.contact?.name || deal.name}</div>
                          <div className="text-xs text-muted-foreground">{deal.contact?.email}</div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Phone Search */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Telefone</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por telefone..."
                    value={isSelected ? selectedPhone : phoneQuery}
                    onChange={(e) => {
                      if (!isSelected) {
                        setPhoneQuery(e.target.value);
                        setShowPhoneResults(e.target.value.length >= 4);
                      }
                    }}
                    className={cn("pl-9 h-9", isSelected && "bg-green-50 border-green-500 dark:bg-green-950/30")}
                    readOnly={isSelected}
                  />
                </div>
                {showPhoneResults && !isSelected && (
                  <div className="border rounded-md max-h-40 overflow-y-auto bg-popover">
                    {searchingPhone ? (
                      <div className="p-2 space-y-2">
                        <Skeleton className="h-10 w-full" />
                      </div>
                    ) : phoneSearchResults.length === 0 ? (
                      <p className="p-3 text-sm text-muted-foreground text-center">
                        Nenhum resultado
                      </p>
                    ) : (
                      phoneSearchResults.slice(0, 8).map(deal => (
                        <button
                          key={deal.id}
                          onClick={() => handleSelectDeal(deal)}
                          className="w-full text-left px-3 py-2 hover:bg-accent border-b last:border-b-0"
                        >
                          <div className="font-medium text-sm">{deal.contact?.name || deal.name}</div>
                          <div className="text-xs text-muted-foreground">{deal.contact?.phone}</div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Closer R2 */}
            <div className="space-y-2">
              <Label className="text-xs">Closer R2</Label>
              <Select value={selectedCloser} onValueChange={setSelectedCloser}>
                <SelectTrigger className="h-9">
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

            {/* Quem Agendou (booked_by) */}
            <div className="space-y-2">
              <Label className="text-xs">Quem Agendou</Label>
              <Select value={bookedBy} onValueChange={setBookedBy}>
                <SelectTrigger className="h-9">
                  <UserCheck className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Selecione quem agendou" />
                </SelectTrigger>
                <SelectContent>
                  {R2_BOOKERS_LIST.map(booker => (
                    <SelectItem key={booker.id} value={booker.id}>
                      {booker.nome}
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
                  disabled={!selectedCloser || !selectedDate || loadingSlots || availableTimeSlots.length === 0}
                >
                  <SelectTrigger className="h-9">
                    <Clock className="mr-2 h-4 w-4" />
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
              </div>
            </div>

            {selectedCloser && selectedDate && !loadingSlots && allConfiguredSlots.length === 0 && (
              <p className="text-xs text-amber-600">
                Closer sem horários configurados para {format(selectedDate, 'EEEE', { locale: ptBR })}.
              </p>
            )}

            {/* Separator */}
            <Separator className="my-2" />

            {/* R2-Specific Fields */}
            <div className="space-y-3">
              {/* Row: Lead Profile + Video Status */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs">Perfil do Lead</Label>
                  <Select value={leadProfile} onValueChange={setLeadProfile}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {LEAD_PROFILE_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Status do Vídeo</Label>
                  <Select value={videoStatus} onValueChange={setVideoStatus}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {VIDEO_STATUS_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Status Final */}
              <div className="space-y-2">
                <Label className="text-xs">Status Final</Label>
                <Select value={r2StatusId} onValueChange={setR2StatusId}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="— Sem status —" />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.filter(s => s.is_active).map(status => (
                      <SelectItem key={status.id} value={status.id}>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-2 h-2 rounded-full" 
                            style={{ backgroundColor: status.color }}
                          />
                          {status.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Thermometer Tags */}
              {thermometerOptions.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs flex items-center gap-1">
                    <Tag className="h-3 w-3" />
                    Termômetro / Tags
                  </Label>
                  <div className="flex flex-wrap gap-1.5">
                    {thermometerOptions.filter(t => t.is_active).map(therm => (
                      <Badge
                        key={therm.id}
                        variant={thermometerIds.includes(therm.id) ? "default" : "outline"}
                        className="cursor-pointer transition-all text-xs"
                        style={{
                          backgroundColor: thermometerIds.includes(therm.id) ? therm.color : 'transparent',
                          borderColor: therm.color,
                          color: thermometerIds.includes(therm.id) ? '#fff' : therm.color,
                        }}
                        onClick={() => toggleThermometer(therm.id)}
                      >
                        {therm.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Meeting Link */}
              <div className="space-y-2">
                <Label className="text-xs flex items-center gap-1">
                  <Link2 className="h-3 w-3" />
                  Link da Reunião
                </Label>
                <Input
                  value={meetingLink}
                  onChange={(e) => setMeetingLink(e.target.value)}
                  placeholder="https://meet.google.com/..."
                  className="h-9"
                />
              </div>

              {/* R2 Confirmation */}
              <div className="space-y-2">
                <Label className="text-xs flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  Confirmação R2
                </Label>
                <Input
                  value={r2Confirmation}
                  onChange={(e) => setR2Confirmation(e.target.value)}
                  placeholder="Confirmado p/ R2, etc."
                  className="h-9"
                />
              </div>

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
            </div>

            {/* Submit */}
            <Button 
              className="w-full bg-purple-600 hover:bg-purple-700 mt-4" 
              onClick={handleSubmit}
              disabled={!selectedDeal || !selectedCloser || !selectedDate || !selectedTime || createMeeting.isPending}
            >
              {createMeeting.isPending ? 'Agendando...' : 'Agendar R2'}
            </Button>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
