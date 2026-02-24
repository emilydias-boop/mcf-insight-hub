import { useState, useMemo, useCallback, useEffect } from 'react';
import { format, getDay } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import type { DayContentProps } from 'react-day-picker';
import { ptBR } from 'date-fns/locale';
import { Search, Calendar, Clock, User, Tag, Send, Phone, Mail, X, Check, CalendarDays, StickyNote } from 'lucide-react';
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
  useSearchDealsByEmail,
  useCreateMeeting,
  useCheckSlotAvailability,
  useSendMeetingNotification,
  useSearchWeeklyMeetingLeads,
  useAvailableSlotsCountByDate,
  useClosersWithAvailability,
} from '@/hooks/useAgendaData';
import { useSdrsByBU } from '@/hooks/useSdrFechamento';
import { useCloserDaySlots } from '@/hooks/useCloserMeetingLinks';
import { useActiveBU } from '@/hooks/useActiveBU';
import { useBUOriginIds } from '@/hooks/useBUPipelineMap';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface QuickScheduleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  closers: CloserWithAvailability[];
  preselectedCloserId?: string;
  preselectedDate?: Date;
  prefilledDealId?: string;
  prefilledNotes?: string;
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
  stage?: {
    id: string;
    stage_name: string;
  } | null;
  lastAttendee?: {
    id: string;
    status: string;
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
  preselectedDate,
  prefilledDealId,
  prefilledNotes,
}: QuickScheduleModalProps) {
  const { role } = useAuth();
  const activeBU = useActiveBU();
  // Usar hook que expande grupos para origens filhas
  const { data: buOriginIds = [] } = useBUOriginIds(activeBU);
  const originIds = buOriginIds.length > 0 ? buOriginIds : undefined;
  const isCoordinatorOrAbove = ['admin', 'manager', 'coordenador'].includes(role || '');
  
  // Fetch SDRs filtered by BU
  const { data: buSdrs = [] } = useSdrsByBU(activeBU);
  
  // Get closer IDs for BU filtering (weekly leads)
  const closerIdsForBU = useMemo(() => closers.map(c => c.id), [closers]);
  
  // Search mode state
  const [searchMode, setSearchMode] = useState<'normal' | 'weekly'>('normal');
  const [weeklyStatusFilter] = useState('no_show');
  
  // Search state
  const [nameQuery, setNameQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  
  // Phone search state
  const [phoneQuery, setPhoneQuery] = useState('');
  const [showPhoneResults, setShowPhoneResults] = useState(false);
  
  // Email search state
  const [emailQuery, setEmailQuery] = useState('');
  const [showEmailResults, setShowEmailResults] = useState(false);
  
  // Selected deal and auto-filled fields
  const [selectedDeal, setSelectedDeal] = useState<DealOption | null>(null);
  const [selectedEmail, setSelectedEmail] = useState('');
  const [selectedPhone, setSelectedPhone] = useState('');
  
  // SDR selection
  const [selectedSdr, setSelectedSdr] = useState('');
  
  // Form state
  const [selectedCloser, setSelectedCloser] = useState(preselectedCloserId || '');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(preselectedDate);
  const [selectedTime, setSelectedTime] = useState(preselectedDate ? format(preselectedDate, 'HH:mm') : '09:00');
  const [notes, setNotes] = useState(prefilledNotes || '');

  // Sync internal state when preselected values change and modal opens
  useEffect(() => {
    if (open) {
      if (preselectedCloserId) {
        setSelectedCloser(preselectedCloserId);
      }
      if (preselectedDate) {
        setSelectedDate(preselectedDate);
        setSelectedTime(format(preselectedDate, 'HH:mm'));
      }
      if (prefilledNotes) {
        setNotes(prefilledNotes);
      }
    }
  }, [open, preselectedCloserId, preselectedDate, prefilledNotes]);
  
  // Fetch prefilled deal if provided
  const { data: prefilledDealData } = useQuery({
    queryKey: ['prefilled-deal', prefilledDealId],
    queryFn: async () => {
      if (!prefilledDealId) return null;
      const { data } = await supabase
        .from('crm_deals')
        .select(`
          id, name, tags,
          crm_contacts:contact_id (id, name, phone, email),
          crm_stages:stage_id (id, stage_name)
        `)
        .eq('id', prefilledDealId)
        .single();
      return data;
    },
    enabled: !!prefilledDealId && open,
  });
  
  // Auto-select prefilled deal when data loads
  useEffect(() => {
    if (prefilledDealData && open && !selectedDeal) {
      const contact = prefilledDealData.crm_contacts as any;
      setSelectedDeal({
        id: prefilledDealData.id,
        name: prefilledDealData.name,
        tags: prefilledDealData.tags || [],
        contact: contact ? {
          id: contact.id,
          name: contact.name,
          phone: contact.phone,
          email: contact.email,
        } : null,
        stage: prefilledDealData.crm_stages as any,
      });
      setNameQuery(contact?.name || prefilledDealData.name);
      setSelectedEmail(contact?.email || '');
      setSelectedPhone(contact?.phone || '');
    }
  }, [prefilledDealData, open]);
  const [alreadyBuilds, setAlreadyBuilds] = useState<boolean | null>(null);
  const [autoSendWhatsApp, setAutoSendWhatsApp] = useState(true);
  
  // State for retroactive booking date
  const [customBookedAt, setCustomBookedAt] = useState<Date | undefined>(undefined);
  
  // State to store weekly lead data for reschedule note concatenation
  const [weeklyLeadData, setWeeklyLeadData] = useState<{
    originalNotes?: string;
    originalDate?: string;
    closerName?: string;
  } | null>(null);

  const { data: searchResults = [], isLoading: searching } = useSearchDealsForSchedule(nameQuery, originIds && originIds.length > 0 ? originIds : undefined);
  const { data: phoneSearchResults = [], isLoading: searchingPhone } = useSearchDealsByPhone(phoneQuery, originIds && originIds.length > 0 ? originIds : undefined);
  const { data: emailSearchResults = [], isLoading: searchingEmail } = useSearchDealsByEmail(emailQuery, originIds && originIds.length > 0 ? originIds : undefined);
  const { data: weeklyLeads = [], isLoading: weeklyLeadsLoading } = useSearchWeeklyMeetingLeads(weeklyStatusFilter, closerIdsForBU);
  const createMeeting = useCreateMeeting();
  const sendNotification = useSendMeetingNotification();

  // Detect lead type from selected deal
  const detectedLeadType = useMemo(() => {
    return detectLeadType(selectedDeal?.tags);
  }, [selectedDeal?.tags]);

  // Detect if booking is retroactive (meeting date is in the past)
  const isRetroactiveBooking = useMemo(() => {
    if (!selectedDate) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const meetingDate = new Date(selectedDate);
    meetingDate.setHours(0, 0, 0, 0);
    return meetingDate < today;
  }, [selectedDate]);

  // Reset/set customBookedAt when retroactive status changes
  useEffect(() => {
    if (isRetroactiveBooking && !customBookedAt) {
      setCustomBookedAt(selectedDate);
    } else if (!isRetroactiveBooking) {
      setCustomBookedAt(undefined);
    }
  }, [isRetroactiveBooking, selectedDate]);

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

  // Calculate allowed dates for non-coordinators
  const allowedDates = useMemo(() => {
    if (isCoordinatorOrAbove) return []; // Don't show for coordinators
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayOfWeek = getDay(today);
    const dates: Date[] = [today];
    
    if (dayOfWeek === 5) { // Friday
      dates.push(new Date(today.getTime() + 86400000)); // Saturday
      dates.push(new Date(today.getTime() + 3 * 86400000)); // Monday
    } else if (dayOfWeek === 6) { // Saturday
      dates.push(new Date(today.getTime() + 2 * 86400000)); // Monday
    } else {
      dates.push(new Date(today.getTime() + 86400000)); // Tomorrow
    }
    
    return dates;
  }, [isCoordinatorOrAbove]);

  // Fetch slot counts for allowed dates
  const { data: slotsCountByDate } = useAvailableSlotsCountByDate(
    selectedCloser,
    allowedDates,
    detectedLeadType
  );

  // Handle selecting a deal from search results
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

  // Clear selection to search again
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

  // Handle selecting a lead from weekly list
  const handleSelectWeeklyLead = useCallback((item: any) => {
    if (!item.deal) return;
    
    setSelectedDeal({
      id: item.deal.id,
      name: item.deal.name,
      tags: item.deal.tags,
      contact: item.deal.contact,
      // Usar o ID do attendee atual como parent para o novo agendamento
      lastAttendee: { id: item.id, status: item.status },
    });
    setNameQuery(item.deal.contact?.name || item.deal.name);
    setSelectedEmail(item.deal.contact?.email || '');
    setSelectedPhone(item.deal.contact?.phone || '');
    
    // Store original appointment data for note history
    setWeeklyLeadData({
      originalNotes: item.original_notes,
      originalDate: item.scheduled_at,
      closerName: item.closer_name,
    });
    
    setSearchMode('normal');
  }, []);

  const handleSubmit = () => {
    if (!selectedDeal || !selectedCloser || !selectedDate) return;

    const [hours, minutes] = selectedTime.split(':').map(Number);
    const scheduledAt = new Date(selectedDate);
    scheduledAt.setHours(hours, minutes, 0, 0);

    // Build notes with history if rescheduling from weekly no-show
    let finalNotes = notes;
    if (weeklyLeadData) {
      const oldDate = weeklyLeadData.originalDate 
        ? format(new Date(weeklyLeadData.originalDate), "dd/MM 'às' HH:mm", { locale: ptBR })
        : 'N/A';
      const newDateFormatted = format(scheduledAt, "dd/MM 'às' HH:mm", { locale: ptBR });
      
      const historyEntry = `--- Reagendado em ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR })} ---\nDe: ${oldDate} (${weeklyLeadData.closerName}) → Para: ${newDateFormatted}\nMotivo: ${notes || 'Não informado'}`;
      
      finalNotes = weeklyLeadData.originalNotes 
        ? `${weeklyLeadData.originalNotes}\n\n${historyEntry}`
        : historyEntry;
    }

    // Determinar parentAttendeeId se for reagendamento/remanejamento
    // Usa o lastAttendee do deal se existir (com status no_show, invited ou scheduled)
    const parentAttendeeId = selectedDeal.lastAttendee?.id || undefined;

    createMeeting.mutate({
      closerId: selectedCloser,
      dealId: selectedDeal.id,
      contactId: selectedDeal.contact?.id,
      scheduledAt,
      notes: finalNotes,
      leadType: detectedLeadType,
      sendNotification: autoSendWhatsApp,
      sdrEmail: selectedSdr || undefined,
      alreadyBuilds,
      parentAttendeeId,
      bookedAt: isRetroactiveBooking ? customBookedAt : undefined,
    }, {
      onSuccess: (data) => {
        // Send WhatsApp notification if enabled
        if (autoSendWhatsApp && data?.id) {
          sendNotification.mutate({ meetingSlotId: data.id });
        }
        onOpenChange(false);
        resetForm();
      },
      onError: (error: any) => {
        console.log('🚨 Create meeting error:', error);
        // Errors are handled by the hook's onError
      },
    });
  };

  const resetForm = () => {
    setSearchMode('normal');
    setNameQuery('');
    setPhoneQuery('');
    setEmailQuery('');
    setSelectedDeal(null);
    setSelectedEmail('');
    setSelectedPhone('');
    setSelectedSdr('');
    setShowResults(false);
    setShowPhoneResults(false);
    setShowEmailResults(false);
    setSelectedCloser(preselectedCloserId || '');
    setSelectedDate(undefined);
    setSelectedTime('09:00');
    setNotes('');
    setAutoSendWhatsApp(true);
    setWeeklyLeadData(null);
    setAlreadyBuilds(null);
    setCustomBookedAt(undefined);
  };

  // Get day of week for selected date (0=Sunday, 1=Monday, etc.)
  const dayOfWeek = selectedDate ? getDay(selectedDate) : undefined;
  
  // Fetch configured time slots for this day
  const { data: closerDaySlots } = useCloserDaySlots(dayOfWeek ?? 0);

  // Build time slots from configured meeting links for selected closer
  const timeSlots = useMemo(() => {
    if (!selectedCloser || !closerDaySlots || dayOfWeek === undefined) {
      return [];
    }
    
    // Filter slots for selected closer and get unique times
    const closerSlots = closerDaySlots
      .filter(s => s.closer_id === selectedCloser)
      .map(s => s.start_time.substring(0, 5)); // "09:00:00" → "09:00"
    
    return [...new Set(closerSlots)].sort();
  }, [closerDaySlots, selectedCloser, dayOfWeek]);

  // Get time slot status (count only, no limit)
  const getTimeSlotStatus = useCallback((time: string) => {
    if (!slotAvailability || time !== selectedTime) return { isFull: false };
    return { 
      isFull: false,
      count: slotAvailability.currentCount,
    };
  }, [slotAvailability, selectedTime]);

  const isSelected = !!selectedDeal;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Agendar Reunião
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
          {/* Search Mode Toggle */}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={searchMode === 'normal' ? 'default' : 'outline'}
              onClick={() => setSearchMode('normal')}
              className="flex-1"
            >
              <Search className="h-4 w-4 mr-1" />
              Busca Normal
            </Button>
            <Button
              size="sm"
              variant={searchMode === 'weekly' ? 'default' : 'outline'}
              onClick={() => setSearchMode('weekly')}
              className="flex-1"
            >
              <CalendarDays className="h-4 w-4 mr-1" />
              Leads da Semana
            </Button>
          </div>

          {/* Weekly Leads Mode - Only No-Show */}
          {searchMode === 'weekly' && (
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <Badge variant="destructive" className="text-xs">No-Show</Badge>
                Leads para reagendar
              </div>
              
              <div className="border rounded-md max-h-64 overflow-y-auto">
                {weeklyLeadsLoading ? (
                  <div className="p-2 space-y-2">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : weeklyLeads.length === 0 ? (
                  <p className="p-3 text-sm text-muted-foreground text-center">
                    Nenhum lead encontrado com este filtro
                  </p>
                ) : (
                  weeklyLeads.map(item => (
                    <button
                      key={item.id}
                      onClick={() => handleSelectWeeklyLead(item)}
                      className="w-full text-left px-3 py-2.5 hover:bg-accent border-b last:border-b-0"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">
                            {item.deal?.contact?.name || item.deal?.name || 'Sem nome'}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(item.scheduled_at), "dd/MM HH:mm")} - {item.closer_name}
                          </div>
                        </div>
                        <Badge variant={
                          item.status === 'completed' ? 'default' :
                          item.status === 'no_show' ? 'destructive' :
                          'secondary'
                        }>
                          {item.status === 'completed' ? 'Realizada' :
                           item.status === 'no_show' ? 'No-Show' :
                           item.status === 'invited' ? 'Agendada' : 
                           item.status === 'cancelled' ? 'Cancelada' : item.status}
                        </Badge>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Normal Search Section */}
          {searchMode === 'normal' && (
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
                    searchResults.map(deal => {
                      const contact = deal.contact;
                      const stageName = (deal as any).stage?.stage_name;
                      return (
                        <button
                          key={deal.id}
                          onClick={() => handleSelectDeal(deal as DealOption)}
                          className="w-full text-left px-3 py-2.5 hover:bg-accent border-b last:border-b-0 flex items-center justify-between gap-2"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">
                              {contact?.name || deal.name}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span className="truncate">{contact?.email || '(sem email)'}</span>
                              {stageName && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 shrink-0 bg-muted/50">
                                  {stageName}
                                </Badge>
                              )}
                            </div>
                          </div>
                          {contact?.phone && (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0 bg-muted px-2 py-1 rounded">
                              <Phone className="h-3 w-3" />
                              <span>{formatPhoneDisplay(contact.phone)}</span>
                            </div>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            {/* Email Field (searchable or read-only when selected) */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={isSelected ? "Auto-preenchido" : "Digite o email para buscar..."}
                  value={isSelected ? selectedEmail : emailQuery}
                  onChange={(e) => {
                    if (!isSelected) {
                      const value = e.target.value;
                      setEmailQuery(value);
                      setShowEmailResults(value.length >= 3);
                    }
                  }}
                  onFocus={() => {
                    if (emailQuery.length >= 3 && !isSelected) {
                      setShowEmailResults(true);
                    }
                  }}
                  readOnly={isSelected}
                  className={cn(
                    "pl-9 pr-9",
                    isSelected && selectedEmail && "bg-muted border-green-500/50"
                  )}
                />
                {isSelected && selectedEmail && (
                  <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
                )}
              </div>

              {/* Email Search Results */}
              {showEmailResults && emailQuery.length >= 3 && !selectedDeal && (
                <div className="border rounded-md max-h-48 overflow-y-auto shadow-sm bg-popover">
                  {searchingEmail ? (
                    <div className="p-2 space-y-2">
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  ) : emailSearchResults.length === 0 ? (
                    <p className="p-3 text-sm text-muted-foreground text-center">
                      Nenhum lead encontrado com esse email
                    </p>
                  ) : (
                    emailSearchResults.map(deal => {
                      const stageName = (deal as any).stage?.stage_name;
                      return (
                        <button
                          key={deal.id}
                          onClick={() => handleSelectDeal(deal as DealOption)}
                          className="w-full text-left px-3 py-2.5 hover:bg-accent border-b last:border-b-0 flex items-center justify-between gap-2"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">
                              {deal.contact?.name || deal.name}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span className="truncate">{deal.contact?.email || '(sem email)'}</span>
                              {stageName && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 shrink-0 bg-muted/50">
                                  {stageName}
                                </Badge>
                              )}
                            </div>
                          </div>
                          {deal.contact?.phone && (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0 bg-muted px-2 py-1 rounded">
                              <Phone className="h-3 w-3" />
                              <span>{formatPhoneDisplay(deal.contact.phone)}</span>
                            </div>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              )}
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
                    phoneSearchResults.map(deal => {
                      const stageName = (deal as any).stage?.stage_name;
                      return (
                        <button
                          key={deal.id}
                          onClick={() => handleSelectDeal(deal as DealOption)}
                          className="w-full text-left px-3 py-2.5 hover:bg-accent border-b last:border-b-0 flex items-center justify-between gap-2"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">
                              {deal.contact?.name || deal.name}
                            </div>
                            {stageName && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 shrink-0 bg-muted/50">
                                {stageName}
                              </Badge>
                            )}
                          </div>
                          {deal.contact?.phone && (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0 bg-muted px-2 py-1 rounded">
                              <Phone className="h-3 w-3" />
                              <span>{formatPhoneDisplay(deal.contact.phone)}</span>
                            </div>
                          )}
                        </button>
                      );
                    })
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
          )}

          {/* SDR Responsável Selection */}
          <div className="space-y-2">
            <Label>SDR Responsável (opcional)</Label>
            <Select value={selectedSdr} onValueChange={setSelectedSdr}>
              <SelectTrigger>
                <User className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Atribuir ao usuário logado" />
              </SelectTrigger>
              <SelectContent>
                {buSdrs.map(sdr => (
                  <SelectItem key={sdr.email} value={sdr.email}>
                    {sdr.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Se não selecionado, será atribuído a você
            </p>
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

          {/* Já Constrói / Conhece Consórcio Toggle (dynamic by BU) */}
          <div className="space-y-2">
            <Label>{activeBU === 'consorcio' ? 'Conhece consórcio?' : 'Já constrói?'}</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={alreadyBuilds === true ? 'default' : 'outline'}
                size="sm"
                onClick={() => setAlreadyBuilds(alreadyBuilds === true ? null : true)}
                className={cn(
                  "flex-1",
                  alreadyBuilds === true && "bg-blue-600 hover:bg-blue-700"
                )}
              >
                <Check className="h-4 w-4 mr-1" />
                {activeBU === 'consorcio' ? 'Sim, já conhece' : 'Sim, já constrói'}
              </Button>
              <Button
                type="button"
                variant={alreadyBuilds === false ? 'default' : 'outline'}
                size="sm"
                onClick={() => setAlreadyBuilds(alreadyBuilds === false ? null : false)}
                className={cn(
                  "flex-1",
                  alreadyBuilds === false && "bg-orange-600 hover:bg-orange-700"
                )}
              >
                <X className="h-4 w-4 mr-1" />
                {activeBU === 'consorcio' ? 'Não conhece' : 'Não constrói'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {activeBU === 'consorcio' 
                ? 'Agrupar leads que já conhecem consórcio juntos'
                : 'Agrupar leads que constroem juntos e os que não constroem separados'
              }
            </p>
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
                    className="pointer-events-auto"
                    components={{
                      DayContent: (props: DayContentProps) => {
                        const dateKey = format(props.date, 'yyyy-MM-dd');
                        const slots = slotsCountByDate?.[dateKey];
                        const isAllowed = allowedDates.some(d => 
                          format(d, 'yyyy-MM-dd') === dateKey
                        );
                        
                        return (
                          <div className="relative w-full h-full flex flex-col items-center justify-center">
                            <span>{props.date.getDate()}</span>
                            {isAllowed && slots && selectedCloser && (
                              <span className={cn(
                                "text-[9px] font-medium leading-none",
                                slots.available > 0 ? "text-green-600" : "text-red-500"
                              )}>
                                {slots.available}
                              </span>
                            )}
                          </div>
                        );
                      }
                    }}
                    disabled={(date) => {
                      // Coordenador ou superior: pode agendar qualquer data
                      if (isCoordinatorOrAbove) {
                        return false;
                      }
                      
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      
                      const targetDate = new Date(date);
                      targetDate.setHours(0, 0, 0, 0);
                      
                      const dayOfWeek = getDay(today); // 0=Domingo, 4=Quinta, 5=Sexta, 6=Sábado
                      
                      // Não pode agendar no passado
                      if (targetDate < today) return true;
                      
                      // Se hoje é quinta (4): pode quinta, sexta, sábado
                      if (dayOfWeek === 4) {
                        const friday = new Date(today);
                        friday.setDate(today.getDate() + 1);
                        
                        const saturday = new Date(today);
                        saturday.setDate(today.getDate() + 2);
                        
                        const isToday = targetDate.getTime() === today.getTime();
                        const isFriday = targetDate.getTime() === friday.getTime();
                        const isSaturday = targetDate.getTime() === saturday.getTime();
                        
                        return !(isToday || isFriday || isSaturday);
                      }
                      
                      // Se hoje é sexta (5): pode sexta, sábado, segunda
                      if (dayOfWeek === 5) {
                        const saturday = new Date(today);
                        saturday.setDate(today.getDate() + 1);
                        
                        const monday = new Date(today);
                        monday.setDate(today.getDate() + 3);
                        
                        const isToday = targetDate.getTime() === today.getTime();
                        const isSaturday = targetDate.getTime() === saturday.getTime();
                        const isMonday = targetDate.getTime() === monday.getTime();
                        
                        return !(isToday || isSaturday || isMonday);
                      }
                      
                      // Se hoje é sábado (6): pode sábado, segunda
                      if (dayOfWeek === 6) {
                        const monday = new Date(today);
                        monday.setDate(today.getDate() + 2);
                        
                        const isToday = targetDate.getTime() === today.getTime();
                        const isMonday = targetDate.getTime() === monday.getTime();
                        
                        return !(isToday || isMonday);
                      }
                      
                      // Dias normais: só hoje ou amanhã
                      const tomorrow = new Date(today);
                      tomorrow.setDate(today.getDate() + 1);
                      
                      const isToday = targetDate.getTime() === today.getTime();
                      const isTomorrow = targetDate.getTime() === tomorrow.getTime();
                      
                      return !(isToday || isTomorrow);
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Horário</Label>
              <Select 
                value={selectedTime} 
                onValueChange={setSelectedTime}
                disabled={!selectedCloser || !selectedDate}
              >
                <SelectTrigger>
                  <Clock className="h-4 w-4 mr-2" />
                  <SelectValue placeholder={
                    !selectedCloser 
                      ? "Selecione o closer" 
                      : !selectedDate 
                        ? "Selecione a data"
                        : timeSlots.length === 0 
                          ? "Sem horários" 
                          : "Horário"
                  } />
                </SelectTrigger>
                <SelectContent>
                  {timeSlots.length === 0 ? (
                    <div className="p-2 text-sm text-muted-foreground text-center">
                      {!selectedCloser 
                        ? "Selecione um closer primeiro"
                        : !selectedDate
                          ? "Selecione uma data primeiro"
                          : "Nenhum horário configurado para este dia"
                      }
                    </div>
                  ) : (
                    timeSlots.map(time => (
                      <SelectItem key={time} value={time}>
                        {time}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Retroactive Booking Date Field */}
          {isRetroactiveBooking && (
            <div className="space-y-2 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                <CalendarDays className="h-4 w-4" />
                <Label className="font-medium text-amber-700 dark:text-amber-400">Data do Agendamento (retroativo)</Label>
              </div>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left">
                    <Calendar className="h-4 w-4 mr-2" />
                    {customBookedAt ? format(customBookedAt, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecione a data'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={customBookedAt}
                    onSelect={setCustomBookedAt}
                    className="pointer-events-auto"
                    locale={ptBR}
                    disabled={(date) => {
                      const today = new Date();
                      today.setHours(23, 59, 59, 999);
                      // Cannot be in the future
                      if (date > today) return true;
                      // Cannot be after the meeting date
                      if (selectedDate && date > selectedDate) return true;
                      return false;
                    }}
                  />
                </PopoverContent>
              </Popover>
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Quando este agendamento foi feito? (não pode ser após a data da reunião)
              </p>
            </div>
          )}

          {/* Slot availability indicator with already_builds breakdown */}
          {selectedCloser && selectedDate && slotAvailability && (
            <div className="p-2 rounded-md text-sm bg-muted space-y-1">
              <div className="flex items-center justify-between">
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
              {slotAvailability.currentCount > 0 && slotAvailability.attendees && (
                <div className="flex gap-2 text-xs">
                  {(() => {
                    const buildsCount = slotAvailability.attendees.filter((a: any) => a.already_builds === true).length;
                    const notBuildsCount = slotAvailability.attendees.filter((a: any) => a.already_builds === false).length;
                    const unknownCount = slotAvailability.attendees.filter((a: any) => a.already_builds === null).length;
                    return (
                      <>
                        {buildsCount > 0 && (
                          <Badge className="bg-blue-600 text-white text-[10px] px-1.5 py-0">
                            {buildsCount} já constrói
                          </Badge>
                        )}
                        {notBuildsCount > 0 && (
                          <Badge className="bg-orange-600 text-white text-[10px] px-1.5 py-0">
                            {notBuildsCount} não constrói
                          </Badge>
                        )}
                        {unknownCount > 0 && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            {unknownCount} sem info
                          </Badge>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          )}

          {/* Original Booking Info (when coming from weekly no-show) */}
          {weeklyLeadData && (
            <div className="space-y-3">
              {/* Original appointment info */}
              <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-3 space-y-1">
                <div className="flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-400">
                  <CalendarDays className="h-4 w-4" />
                  Agendamento Anterior (No-Show)
                </div>
                <p className="text-xs text-muted-foreground">
                  {weeklyLeadData.originalDate 
                    ? format(new Date(weeklyLeadData.originalDate), "dd/MM 'às' HH:mm", { locale: ptBR })
                    : 'Data não disponível'
                  } com {weeklyLeadData.closerName}
                </p>
              </div>
              
              {/* Original note */}
              {weeklyLeadData.originalNotes && (
                <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3 space-y-1">
                  <div className="flex items-center gap-2 text-sm font-medium text-blue-700 dark:text-blue-400">
                    <StickyNote className="h-4 w-4" />
                    Nota do Agendamento Original
                  </div>
                  <p className="text-sm whitespace-pre-wrap text-muted-foreground max-h-24 overflow-y-auto">
                    {weeklyLeadData.originalNotes}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label>{weeklyLeadData ? 'Motivo do Reagendamento' : 'Notas'} <span className="text-destructive">*</span></Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={weeklyLeadData ? 'Ex: Cliente pediu para remarcar, não atendeu, etc...' : 'Adicione observações sobre o lead...'}
              rows={2}
              className={cn(!notes.trim() && "border-destructive/50")}
            />
            {!notes.trim() && (
              <p className="text-xs text-destructive">Nota obrigatória para agendar</p>
            )}
          </div>

          {/* Auto-send WhatsApp Toggle - hidden for now
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
          */}

        </div>

        {/* Submit - Fixed at bottom */}
        <div className="flex-shrink-0 pt-4 border-t">
          <Button 
            className="w-full" 
            onClick={handleSubmit}
            disabled={!selectedDeal || !selectedCloser || !selectedDate || !notes.trim() || createMeeting.isPending}
          >
            {createMeeting.isPending ? 'Agendando...' : 'Agendar Reunião'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
