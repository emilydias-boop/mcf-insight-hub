import { useState, useEffect } from 'react';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Phone, Calendar, CheckCircle, XCircle, 
  ExternalLink, Clock, User, Users, Video,
  MessageSquare, History, RotateCcw, ShoppingCart,
  FileText, ChevronDown, Trash2
} from 'lucide-react';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, 
  SelectTrigger, SelectValue
} from '@/components/ui/select';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { 
  R2MeetingRow, R2StatusOption, R2ThermometerOption,
  LEAD_PROFILE_OPTIONS, VIDEO_STATUS_OPTIONS, DECISION_MAKER_TYPE_OPTIONS
} from '@/types/r2Agenda';
import { useUpdateR2Attendee, useRemoveR2Attendee } from '@/hooks/useR2AttendeeUpdate';
import { useUpdateAttendeeAndSlotStatus } from '@/hooks/useAgendaData';
import { useLeadNotes, NoteType } from '@/hooks/useLeadNotes';
import { useLeadPurchaseHistory } from '@/hooks/useLeadPurchaseHistory';
import { RefundModal } from './RefundModal';

interface R2MeetingDetailDrawerProps {
  meeting: R2MeetingRow | null;
  statusOptions: R2StatusOption[];
  thermometerOptions: R2ThermometerOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReschedule: (meeting: R2MeetingRow) => void;
}

const MEETING_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  scheduled: { label: 'Agendada', color: 'bg-purple-500' },
  rescheduled: { label: 'Reagendada', color: 'bg-yellow-500' },
  completed: { label: 'Realizada', color: 'bg-green-500' },
  no_show: { label: 'No-show', color: 'bg-red-500' },
  canceled: { label: 'Cancelada', color: 'bg-muted' },
  contract_paid: { label: 'Contrato Pago', color: 'bg-emerald-600' },
  refunded: { label: 'Reembolsado', color: 'bg-orange-500' },
};

const NOTE_TYPE_STYLES: Record<NoteType, { bg: string; label: string }> = {
  manual: { bg: 'bg-blue-50 border-blue-200', label: 'Nota SDR' },
  scheduling: { bg: 'bg-purple-50 border-purple-200', label: 'Agendamento' },
  call: { bg: 'bg-amber-50 border-amber-200', label: 'Ligação' },
  closer: { bg: 'bg-green-50 border-green-200', label: 'Closer' },
  r2: { bg: 'bg-indigo-50 border-indigo-200', label: 'R2' },
};

const PURCHASE_STATUS_ICONS: Record<string, { icon: string; color: string }> = {
  completed: { icon: '✓', color: 'text-green-600' },
  refunded: { icon: '↩', color: 'text-orange-500' },
  pending: { icon: '⏳', color: 'text-yellow-600' },
};

export function R2MeetingDetailDrawer({
  meeting,
  statusOptions,
  thermometerOptions,
  open,
  onOpenChange,
  onReschedule
}: R2MeetingDetailDrawerProps) {
  const [selectedAttendeeId, setSelectedAttendeeId] = useState<string | null>(null);
  const [showNotes, setShowNotes] = useState(false);
  const [showPurchases, setShowPurchases] = useState(false);
  const [refundModalOpen, setRefundModalOpen] = useState(false);
  
  // Optimistic UI state for all editable fields
  const [localDecisionMaker, setLocalDecisionMaker] = useState<boolean | null>(null);
  const [localDecisionMakerType, setLocalDecisionMakerType] = useState<string | null>(null);
  const [localLeadProfile, setLocalLeadProfile] = useState<string | null>(null);
  const [localVideoStatus, setLocalVideoStatus] = useState<string>('pendente');
  const [localR2StatusId, setLocalR2StatusId] = useState<string | null>(null);
  const [localThermometerId, setLocalThermometerId] = useState<string | null>(null);
  const [localMeetingLink, setLocalMeetingLink] = useState<string>('');
  const [localR2Observations, setLocalR2Observations] = useState<string>('');
  
  const updateAttendee = useUpdateR2Attendee();
  const updateAttendeeAndSlotStatus = useUpdateAttendeeAndSlotStatus();
  const removeAttendee = useRemoveR2Attendee();
  
  const attendee = meeting?.attendees?.find(a => a.id === selectedAttendeeId) || meeting?.attendees?.[0];
  const contactEmail = attendee?.deal?.contact?.email;
  
  const { data: leadNotes } = useLeadNotes(attendee?.deal_id, attendee?.id);
  const { data: purchaseHistory } = useLeadPurchaseHistory(contactEmail);
  
  // Initialize selection when meeting changes
  useEffect(() => {
    if (meeting?.attendees?.length && !selectedAttendeeId) {
      setSelectedAttendeeId(meeting.attendees[0].id);
    }
  }, [meeting?.id, meeting?.attendees, selectedAttendeeId]);
  
  // Sync local state with server data when attendee changes
  useEffect(() => {
    if (attendee) {
      setLocalDecisionMaker(attendee.is_decision_maker ?? null);
      setLocalDecisionMakerType(attendee.decision_maker_type ?? null);
      setLocalLeadProfile(attendee.lead_profile ?? null);
      setLocalVideoStatus(attendee.video_status ?? 'pendente');
      setLocalR2StatusId(attendee.r2_status_id ?? null);
      setLocalThermometerId(attendee.thermometer_ids?.[0] ?? null);
      setLocalMeetingLink(attendee.meeting_link ?? '');
      setLocalR2Observations(attendee.r2_observations ?? '');
    }
  }, [attendee?.id, attendee?.is_decision_maker, attendee?.decision_maker_type,
      attendee?.lead_profile, attendee?.video_status, attendee?.r2_status_id,
      attendee?.thermometer_ids, attendee?.meeting_link, attendee?.r2_observations]);
  
  // Computed value for UI (local state takes precedence)
  const isDecisionMaker = localDecisionMaker ?? attendee?.is_decision_maker ?? true;

  if (!meeting) return null;

  const statusInfo = MEETING_STATUS_LABELS[meeting.status] || MEETING_STATUS_LABELS.scheduled;
  const isPending = meeting.status === 'scheduled' || meeting.status === 'rescheduled';
  const contactPhone = attendee?.phone || attendee?.deal?.contact?.phone;

  const handleAttendeeUpdate = (field: string, value: unknown) => {
    if (!attendee) return;
    updateAttendee.mutate({
      attendeeId: attendee.id,
      updates: { [field]: value }
    });
  };

  // Handler para atualizar status INDIVIDUAL do participante selecionado
  const handleParticipantStatusChange = (newStatus: string) => {
    if (!attendee) return;
    
    // Para R2, sincronizar slot apenas em completed/contract_paid do participante principal
    // Um participante é "principal" se não tiver partner_name (não é parceiro de outro lead)
    const statusesToSyncSlot = ['completed', 'contract_paid'];
    const isPrincipal = !attendee.partner_name;
    const shouldSyncSlot = statusesToSyncSlot.includes(newStatus) && isPrincipal;

    updateAttendeeAndSlotStatus.mutate({
      attendeeId: attendee.id,
      status: newStatus,
      meetingId: meeting.id,
      syncSlot: shouldSyncSlot,
      meetingType: 'r2',
    });
  };

  const handleWhatsApp = () => {
    if (contactPhone) {
      const phone = contactPhone.replace(/\D/g, '');
      window.open(`https://wa.me/55${phone}`, '_blank');
    }
  };

  const handleRemoveAttendee = (attendeeId: string) => {
    if (confirm('Deseja remover este participante da reunião?')) {
      removeAttendee.mutate(attendeeId);
      // Select another attendee if available
      const remaining = meeting?.attendees?.filter(a => a.id !== attendeeId);
      if (remaining?.length) {
        setSelectedAttendeeId(remaining[0].id);
      }
    }
  };

  const handleDecisionMakerChange = (value: boolean) => {
    if (!attendee) return;
    
    // Optimistic UI update
    setLocalDecisionMaker(value);
    if (value) {
      setLocalDecisionMakerType(null);
    }
    
    // Single mutation call with both fields
    updateAttendee.mutate({
      attendeeId: attendee.id,
      updates: { 
        is_decision_maker: value,
        ...(value && { decision_maker_type: null })
      }
    });
  };
  
  const handleDecisionMakerTypeChange = (type: string | null) => {
    if (!attendee) return;
    
    // Optimistic UI update
    setLocalDecisionMakerType(type);
    
    updateAttendee.mutate({
      attendeeId: attendee.id,
      updates: { decision_maker_type: type }
    });
  };
  
  // Generic optimistic update handler for select fields
  const handleOptimisticSelectUpdate = (
    field: string, 
    value: unknown, 
    setLocalState: (v: any) => void
  ) => {
    if (!attendee) return;
    setLocalState(value);
    updateAttendee.mutate({
      attendeeId: attendee.id,
      updates: { [field]: value }
    });
  };
  
  // Handler for thermometer (array field)
  const handleThermometerChange = (value: string | null) => {
    if (!attendee) return;
    setLocalThermometerId(value);
    updateAttendee.mutate({
      attendeeId: attendee.id,
      updates: { thermometer_ids: value ? [value] : [] }
    });
  };
  
  // Handlers for text fields (save on blur)
  const handleMeetingLinkBlur = () => {
    if (!attendee) return;
    updateAttendee.mutate({
      attendeeId: attendee.id,
      updates: { meeting_link: localMeetingLink || null }
    });
  };
  
  const handleObservationsBlur = () => {
    if (!attendee) return;
    updateAttendee.mutate({
      attendeeId: attendee.id,
      updates: { r2_observations: localR2Observations || null }
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:w-[40vw] sm:min-w-[400px] sm:max-w-none p-0 flex flex-col">
        <SheetHeader className="border-b p-4">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-lg flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-purple-500" />
              Detalhes R2
            </SheetTitle>
            <Badge className={cn(statusInfo.color, 'text-white')}>
              {statusInfo.label}
            </Badge>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-4">
            {/* Participant Selection - Clickable List */}
            {meeting.attendees && meeting.attendees.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    <span className="font-medium text-sm">
                      Participantes ({meeting.attendees.length})
                    </span>
                  </div>
                </div>
                
                <div className="space-y-2">
                  {meeting.attendees.map((att) => {
                    const isSelected = selectedAttendeeId === att.id || (!selectedAttendeeId && att.id === meeting.attendees[0].id);
                    const attStatusInfo = MEETING_STATUS_LABELS[att.status || 'scheduled'];
                    
                    return (
                      <div
                        key={att.id}
                        className={cn(
                          "flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all",
                          isSelected
                            ? "bg-primary/20 ring-2 ring-primary"
                            : "bg-muted/30 hover:bg-muted/50"
                        )}
                        onClick={() => setSelectedAttendeeId(att.id)}
                      >
                        <div className="flex items-center gap-3">
                          {/* Avatar */}
                          <div
                            className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shrink-0"
                            style={{ backgroundColor: meeting.closer?.color || '#8B5CF6' }}
                          >
                            {(att.name || att.deal?.contact?.name || 'L').charAt(0).toUpperCase()}
                          </div>
                          
                          {/* Info */}
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm truncate">
                                {att.name || att.deal?.contact?.name || 'Lead'}
                              </span>
                              {isSelected && (
                                <Badge className="text-xs bg-primary text-primary-foreground shrink-0">
                                  Selecionado
                                </Badge>
                              )}
                              {att.status && att.status !== 'scheduled' && attStatusInfo && (
                                <Badge className={cn('text-xs text-white shrink-0', attStatusInfo.color)}>
                                  {attStatusInfo.label}
                                </Badge>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {att.phone || att.deal?.contact?.phone || 'Sem telefone'}
                            </span>
                          </div>
                        </div>
                        
                        {/* Remove Button */}
                        {meeting.attendees.length > 1 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:bg-destructive/10 shrink-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveAttendee(att.id);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
                
                <p className="text-xs text-muted-foreground text-center">
                  Clique em um participante para ver detalhes e ações
                </p>
              </div>
            )}

            <Separator />
            {attendee && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground flex items-center gap-2">
                  <User className="h-3 w-3" />
                  Informações do Lead
                </Label>
                <div className="bg-muted/30 rounded-lg p-4 space-y-3">
                  <div className="font-medium text-lg">
                    {attendee.name || attendee.deal?.contact?.name || 'Lead'}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground text-xs">Email</span>
                      <div>{attendee.deal?.contact?.email || '—'}</div>
                    </div>
                    
                    <div>
                      <span className="text-muted-foreground text-xs">Telefone</span>
                      <div className="flex items-center gap-2">
                        {contactPhone ? (
                          <>
                            <a href={`tel:${contactPhone}`} className="hover:underline">
                              {contactPhone}
                            </a>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={handleWhatsApp}>
                              <ExternalLink className="h-3 w-3" />
                            </Button>
                          </>
                        ) : '—'}
                      </div>
                    </div>
                    
                    {attendee.deal?.custom_fields?.estado && (
                      <div>
                        <span className="text-muted-foreground text-xs">📍 Estado</span>
                        <div>{attendee.deal.custom_fields.estado}</div>
                      </div>
                    )}
                    
                    {attendee.deal?.custom_fields?.profissao && (
                      <div>
                        <span className="text-muted-foreground text-xs">👤 Profissão</span>
                        <div>{attendee.deal.custom_fields.profissao}</div>
                      </div>
                    )}
                    
                    {attendee.deal?.custom_fields?.renda && (
                      <div>
                        <span className="text-muted-foreground text-xs">💰 Renda</span>
                        <div>{attendee.deal.custom_fields.renda}</div>
                      </div>
                    )}
                    
                    {(attendee.deal?.custom_fields?.terreno || attendee.deal?.custom_fields?.possui_imovel) && (
                      <div>
                        <span className="text-muted-foreground text-xs">🏡 Terreno/Imóvel</span>
                        <div>{attendee.deal.custom_fields.terreno || attendee.deal.custom_fields.possui_imovel}</div>
                      </div>
                    )}
                    
                    {attendee.deal?.custom_fields?.investimento && (
                      <div>
                        <span className="text-muted-foreground text-xs">💵 Investimento</span>
                        <div>{attendee.deal.custom_fields.investimento}</div>
                      </div>
                    )}
                    
                    {attendee.deal?.custom_fields?.tem_socio && (
                      <div>
                        <span className="text-muted-foreground text-xs">🤝 Sócio</span>
                        <div>{attendee.deal.custom_fields.nome_socio || attendee.deal.custom_fields.tem_socio}</div>
                      </div>
                    )}
                  </div>
                  
                  {attendee.deal?.custom_fields?.solucao && (
                    <div className="pt-2 border-t text-sm">
                      <span className="text-muted-foreground text-xs">🎯 Solução que busca</span>
                      <div>{attendee.deal.custom_fields.solucao}</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <Separator />

            {/* 2. Histórico do Funil */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground flex items-center gap-2">
                <History className="h-3 w-3" />
                Histórico do Funil
              </Label>
              <div className="bg-muted/30 rounded-lg p-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">SDR:</span>
                  <span className="font-medium">
                    {meeting.sdr?.name || meeting.sdr?.email || '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Closer R1:</span>
                  <span className="font-medium">
                    {meeting.r1_closer ? (
                      <>
                        {meeting.r1_closer.name}
                        {meeting.r1_closer.scheduled_at && (
                          <span className="text-muted-foreground ml-1">
                            ({format(parseISO(meeting.r1_closer.scheduled_at), "dd/MM 'às' HH:mm")})
                          </span>
                        )}
                      </>
                    ) : '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Agendou R2:</span>
                  <span className="font-medium">
                    {meeting.booked_by?.name || '—'}
                    {meeting.created_at && (
                      <span className="text-muted-foreground ml-1">
                        ({format(parseISO(meeting.created_at), "dd/MM 'às' HH:mm")})
                      </span>
                    )}
                  </span>
                </div>
              </div>
            </div>

            <Separator />

            {/* 3. Agendamento R2 */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="font-medium">
                    {format(parseISO(meeting.scheduled_at), "EEEE, d 'de' MMMM", { locale: ptBR })}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {format(parseISO(meeting.scheduled_at), 'HH:mm')} - 30min
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-sm text-muted-foreground">Closer R2</div>
                  <div className="font-medium">{meeting.closer?.name}</div>
                </div>
              </div>
            </div>

            <Separator />

            {/* 4. Editable Fields - Side by Side Layout */}
            {attendee && (
              <div className="space-y-4">
                {/* Row 1: Sócio Decisor */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">É o Decisor?</Label>
                    <Select
                      value={isDecisionMaker === false ? 'nao' : 'sim'}
                      onValueChange={(v) => handleDecisionMakerChange(v === 'sim')}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sim">Sim</SelectItem>
                        <SelectItem value="nao">Não</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {isDecisionMaker === false && (
                    <div className="space-y-1.5">
                      <Label className="text-xs">Quem é o Decisor?</Label>
                      <Select
                        value={localDecisionMakerType || ''}
                        onValueChange={(v) => handleDecisionMakerTypeChange(v || null)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          {DECISION_MAKER_TYPE_OPTIONS.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                {/* Row 2: Perfil do Lead + Status do Vídeo */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Perfil do Lead</Label>
                    <Select
                      value={localLeadProfile || ''}
                      onValueChange={(v) => handleOptimisticSelectUpdate('lead_profile', v || null, setLocalLeadProfile)}
                    >
                      <SelectTrigger>
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

                  <div className="space-y-1.5">
                    <Label className="text-xs flex items-center gap-1">
                      <Video className="h-3 w-3" />
                      Status do Vídeo
                    </Label>
                    <Select
                      value={localVideoStatus}
                      onValueChange={(v) => handleOptimisticSelectUpdate('video_status', v, setLocalVideoStatus)}
                    >
                      <SelectTrigger>
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

                {/* Row 3: Status Final + Termômetro */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Status Final</Label>
                    <Select
                      value={localR2StatusId || '__none__'}
                      onValueChange={(v) => handleOptimisticSelectUpdate('r2_status_id', v === '__none__' ? null : v, setLocalR2StatusId)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— Sem status —</SelectItem>
                        {statusOptions.map(opt => (
                          <SelectItem key={opt.id} value={opt.id}>
                            <div className="flex items-center gap-2">
                              <div 
                                className="h-2 w-2 rounded-full" 
                                style={{ backgroundColor: opt.color }} 
                              />
                              {opt.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Termômetro</Label>
                    <Select
                      value={localThermometerId || '__none__'}
                      onValueChange={(v) => handleThermometerChange(v === '__none__' ? null : v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— Nenhum —</SelectItem>
                        {thermometerOptions.map(opt => (
                          <SelectItem key={opt.id} value={opt.id}>
                            <div className="flex items-center gap-2">
                              <div 
                                className="h-2 w-2 rounded-full" 
                                style={{ backgroundColor: opt.color }} 
                              />
                              {opt.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Link da Reunião */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Link da Reunião</Label>
                  <Input
                    value={localMeetingLink}
                    onChange={(e) => setLocalMeetingLink(e.target.value)}
                    onBlur={handleMeetingLinkBlur}
                    placeholder="https://..."
                  />
                </div>

                {/* Observações */}
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1">
                    <MessageSquare className="h-3 w-3" />
                    Observações R2
                  </Label>
                  <Textarea
                    value={localR2Observations}
                    onChange={(e) => setLocalR2Observations(e.target.value)}
                    onBlur={handleObservationsBlur}
                    placeholder="Anotações sobre a reunião..."
                    rows={3}
                  />
                </div>

                <Separator />

                {/* 5. Notas do Lead */}
                <Collapsible open={showNotes} onOpenChange={setShowNotes}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="w-full justify-between">
                      <span className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        📝 Notas do Lead
                      </span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{leadNotes?.length || 0}</Badge>
                        <ChevronDown className={cn("h-4 w-4 transition-transform", showNotes && "rotate-180")} />
                      </div>
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2">
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {(!leadNotes || leadNotes.length === 0) && (
                        <p className="text-xs text-muted-foreground text-center py-2">
                          Nenhuma nota encontrada
                        </p>
                      )}
                      {leadNotes?.map(note => {
                        const style = NOTE_TYPE_STYLES[note.type] || NOTE_TYPE_STYLES.manual;
                        return (
                          <div key={note.id} className={cn("rounded-lg p-2 border text-sm", style.bg)}>
                            <div className="flex justify-between items-center text-xs text-muted-foreground mb-1">
                              <span className="font-medium">{style.label}</span>
                              <span>
                                {note.author && `${note.author} • `}
                                {formatDistanceToNow(parseISO(note.created_at), { addSuffix: true, locale: ptBR })}
                              </span>
                            </div>
                            <p className="text-foreground">{note.content}</p>
                          </div>
                        );
                      })}
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                {/* 6. Histórico de Compras */}
                <Collapsible open={showPurchases} onOpenChange={setShowPurchases}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="w-full justify-between">
                      <span className="flex items-center gap-2">
                        <ShoppingCart className="h-4 w-4" />
                        🛒 Histórico de Compras
                      </span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{purchaseHistory?.length || 0}</Badge>
                        <ChevronDown className={cn("h-4 w-4 transition-transform", showPurchases && "rotate-180")} />
                      </div>
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2">
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {(!purchaseHistory || purchaseHistory.length === 0) && (
                        <p className="text-xs text-muted-foreground text-center py-2">
                          Nenhuma compra encontrada
                        </p>
                      )}
                      {purchaseHistory?.map(purchase => {
                        const statusStyle = PURCHASE_STATUS_ICONS[purchase.sale_status] || PURCHASE_STATUS_ICONS.pending;
                        return (
                          <div key={purchase.id} className="flex justify-between items-center p-2 border rounded-lg text-sm">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className={statusStyle.color}>{statusStyle.icon}</span>
                                <span className="font-medium">{purchase.product_name}</span>
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {format(parseISO(purchase.sale_date), 'dd/MM/yyyy')} • {purchase.sale_status}
                              </div>
                            </div>
                            <div className="font-medium">
                              R$ {purchase.product_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer Actions - Grid 2x2 */}
        <div className="border-t p-4 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Button 
              variant="outline" 
              className="text-green-600 border-green-200 hover:bg-green-50 dark:hover:bg-green-950"
              onClick={() => handleParticipantStatusChange('completed')}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Realizada
            </Button>
            <Button 
              variant="outline"
              className="text-red-600 border-red-200 hover:bg-red-50 dark:hover:bg-red-950"
              onClick={() => handleParticipantStatusChange('no_show')}
            >
              <XCircle className="h-4 w-4 mr-2" />
              No-show
            </Button>
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            <Button 
              variant="outline"
              onClick={() => onReschedule(meeting)}
            >
              <Clock className="h-4 w-4 mr-2" />
              Reagendar
            </Button>
            <Button 
              variant="outline"
              className="text-orange-600 border-orange-200 hover:bg-orange-50 dark:hover:bg-orange-950"
              onClick={() => setRefundModalOpen(true)}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reembolso
            </Button>
          </div>
        </div>
      </SheetContent>

      {/* Refund Modal */}
      {meeting && attendee && (
        <RefundModal
          open={refundModalOpen}
          onOpenChange={setRefundModalOpen}
          meetingId={meeting.id}
          dealId={attendee.deal_id}
          dealName={attendee.name || attendee.deal?.contact?.name}
          originId={(attendee.deal as any)?.origin_id}
          currentCustomFields={attendee.deal?.custom_fields as Record<string, any>}
          onSuccess={() => onOpenChange(false)}
        />
      )}
    </Sheet>
  );
}
