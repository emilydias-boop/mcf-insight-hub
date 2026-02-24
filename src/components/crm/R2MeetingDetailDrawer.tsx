import { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Phone, Mail, Calendar, CheckCircle, XCircle, 
  ExternalLink, User, Users, History, RotateCcw, Trash2, ArrowRightLeft, Pencil, Edit2, Check, X
} from 'lucide-react';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { R2MeetingRow, R2StatusOption, R2ThermometerOption, R2AttendeeExtended } from '@/types/r2Agenda';
import { useRemoveR2Attendee, useCancelR2Meeting, useRestoreR2Meeting, useUpdateR2Attendee } from '@/hooks/useR2AttendeeUpdate';
import { useUpdateAttendeeAndSlotStatus } from '@/hooks/useAgendaData';
import { useUpdateCRMContact } from '@/hooks/useCRMData';
import { RefundModal } from './RefundModal';
import { R2QualificationTab } from './r2-drawer/R2QualificationTab';
import { R2EvaluationTab } from './r2-drawer/R2EvaluationTab';
import { R2NotesTab } from './r2-drawer/R2NotesTab';
import { R2AttendeeTransferModal } from './R2AttendeeTransferModal';
import { useAuth } from '@/contexts/AuthContext';

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

export function R2MeetingDetailDrawer({
  meeting,
  statusOptions,
  thermometerOptions,
  open,
  onOpenChange,
  onReschedule
}: R2MeetingDetailDrawerProps) {
  const [selectedAttendeeId, setSelectedAttendeeId] = useState<string | null>(null);
  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [attendeeToTransfer, setAttendeeToTransfer] = useState<R2AttendeeExtended | null>(null);
  const [editingPhone, setEditingPhone] = useState(false);
  const [editingEmail, setEditingEmail] = useState(false);
  const [phoneValue, setPhoneValue] = useState('');
  const [emailValue, setEmailValue] = useState('');
  
  const { role } = useAuth();
  const canTransfer = ['admin', 'manager', 'coordenador'].includes(role || '');
  
  // Debug log - remove after testing
  console.log('[R2Drawer] role:', role, '| canTransfer:', canTransfer);
  
  const updateAttendeeAndSlotStatus = useUpdateAttendeeAndSlotStatus();
  const removeAttendee = useRemoveR2Attendee();
  const cancelMeeting = useCancelR2Meeting();
  const restoreMeeting = useRestoreR2Meeting();
  const updateR2Attendee = useUpdateR2Attendee();
  const updateCRMContact = useUpdateCRMContact();
  
  const attendee = meeting?.attendees?.find(a => a.id === selectedAttendeeId) || meeting?.attendees?.[0];

  // Initialize selection when meeting changes
  useEffect(() => {
    if (meeting?.attendees?.length && !selectedAttendeeId) {
      setSelectedAttendeeId(meeting.attendees[0].id);
    }
  }, [meeting?.id, meeting?.attendees, selectedAttendeeId]);

  if (!meeting) return null;

  const statusInfo = MEETING_STATUS_LABELS[meeting.status] || MEETING_STATUS_LABELS.scheduled;
  const contactPhone = attendee?.phone || attendee?.deal?.contact?.phone;
  const contactEmail = attendee?.deal?.contact?.email;
  const contactId = (attendee?.deal as any)?.contact_id || (attendee?.deal?.contact as any)?.id;

  const handleStartEditPhone = () => {
    setPhoneValue(contactPhone || '');
    setEditingPhone(true);
  };

  const handleSavePhone = async () => {
    if (!phoneValue.trim()) {
      toast.error('Digite um número de telefone');
      setEditingPhone(false);
      return;
    }
    try {
      // Update attendee phone
      if (attendee) {
        await updateR2Attendee.mutateAsync({
          attendeeId: attendee.id,
          updates: { attendee_phone: phoneValue }
        });
      }
      // Update CRM contact phone if linked
      if (contactId) {
        await updateCRMContact.mutateAsync({ id: contactId, phone: phoneValue });
      }
      setEditingPhone(false);
    } catch {
      toast.error('Erro ao salvar telefone');
    }
  };

  const handleStartEditEmail = () => {
    setEmailValue(contactEmail || '');
    setEditingEmail(true);
  };

  const handleSaveEmail = async () => {
    if (!emailValue.trim()) {
      toast.error('Digite um email');
      setEditingEmail(false);
      return;
    }
    try {
      if (contactId) {
        await updateCRMContact.mutateAsync({ id: contactId, email: emailValue });
      } else {
        toast.error('Sem contato vinculado para salvar email');
      }
      setEditingEmail(false);
    } catch {
      toast.error('Erro ao salvar email');
    }
  };
  // Handler para atualizar status INDIVIDUAL do participante selecionado
  const handleParticipantStatusChange = (newStatus: string) => {
    if (!attendee) return;
    
    const statusesToSyncSlot = ['completed', 'contract_paid'];
    const isPrincipal = !attendee.partner_name;
    const shouldSyncSlot = statusesToSyncSlot.includes(newStatus) && isPrincipal;

    updateAttendeeAndSlotStatus.mutate({
      attendeeId: attendee.id,
      status: newStatus,
      meetingId: meeting.id,
      syncSlot: shouldSyncSlot,
      meetingType: 'r2',
    }, {
      onSuccess: () => {
        if (newStatus === 'completed') {
          toast.info(
            'Lembre-se de preencher o Status Final na aba "Avaliação R2"',
            { duration: 5000 }
          );
        }
      }
    });
  };

  const handleWhatsApp = () => {
    if (contactPhone) {
      const phone = contactPhone.replace(/\D/g, '');
      window.open(`https://wa.me/55${phone}`, '_blank');
    }
  };

  const handleRemoveAttendee = (attendeeId: string) => {
    const isLastAttendee = meeting?.attendees?.length === 1;
    
    const confirmMessage = isLastAttendee
      ? 'Ao remover o único participante, a reunião será cancelada. Deseja continuar?'
      : 'Deseja remover este participante da reunião?';
    
    if (confirm(confirmMessage)) {
      removeAttendee.mutate(attendeeId, {
        onSuccess: () => {
          if (isLastAttendee) {
            cancelMeeting.mutate(meeting.id);
            onOpenChange(false);
          } else {
            const remaining = meeting?.attendees?.filter(a => a.id !== attendeeId);
            if (remaining?.length) {
              setSelectedAttendeeId(remaining[0].id);
            }
          }
        }
      });
    }
  };

  const handleCancelMeeting = () => {
    if (confirm('Deseja cancelar esta reunião? Todos os participantes serão afetados.')) {
      cancelMeeting.mutate(meeting.id);
      onOpenChange(false);
    }
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
            {/* Participant Selection */}
            {meeting.attendees && meeting.attendees.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  <span className="font-medium text-sm">
                    Participantes ({meeting.attendees.length})
                  </span>
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
                          <div
                            className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shrink-0"
                            style={{ backgroundColor: meeting.closer?.color || '#8B5CF6' }}
                          >
                            {(att.name || att.deal?.contact?.name || 'L').charAt(0).toUpperCase()}
                          </div>
                          
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm truncate">
                                {att.name || att.deal?.contact?.name || 'Lead'}
                              </span>
                              {att.is_reschedule && 
                               !['contract_paid', 'completed', 'refunded', 'approved', 'rejected'].includes(att.status || '') && (
                                <Badge variant="outline" className="text-xs px-1.5 py-0.5 bg-orange-100 text-orange-700 border-orange-300 gap-1 shrink-0">
                                  <ArrowRightLeft className="h-3 w-3" />
                                  Reagendado
                                </Badge>
                              )}
                              {isSelected && (
                                <Badge className="text-xs bg-primary text-primary-foreground shrink-0">
                                  Em foco
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
                        
                        <div className="flex items-center gap-1 shrink-0">
                          {canTransfer && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-primary hover:bg-primary/10"
                              onClick={(e) => {
                                e.stopPropagation();
                                setAttendeeToTransfer(att);
                                setTransferModalOpen(true);
                              }}
                              title="Transferir participante"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:bg-destructive/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveAttendee(att.id);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <Separator />

            {/* Meeting Info */}
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
              
              {/* Telefone editável */}
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-muted-foreground" />
                {editingPhone ? (
                  <div className="flex items-center gap-1 flex-1">
                    <Input
                      value={phoneValue}
                      onChange={(e) => setPhoneValue(e.target.value)}
                      placeholder="+5511999990001"
                      className="h-7 text-sm bg-background"
                    />
                    <Button size="icon" variant="ghost" className="h-6 w-6 text-primary" onClick={handleSavePhone} disabled={updateR2Attendee.isPending || updateCRMContact.isPending}>
                      <Check className="h-3 w-3" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => setEditingPhone(false)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{contactPhone || 'Sem telefone'}</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleStartEditPhone}>
                      <Edit2 className="h-3 w-3" />
                    </Button>
                    {contactPhone && (
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={handleWhatsApp}>
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {/* Email editável */}
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-muted-foreground" />
                {editingEmail ? (
                  <div className="flex items-center gap-1 flex-1">
                    <Input
                      value={emailValue}
                      onChange={(e) => setEmailValue(e.target.value)}
                      placeholder="email@exemplo.com"
                      type="email"
                      className="h-7 text-sm bg-background"
                    />
                    <Button size="icon" variant="ghost" className="h-6 w-6 text-primary" onClick={handleSaveEmail} disabled={updateCRMContact.isPending}>
                      <Check className="h-3 w-3" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => setEditingEmail(false)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{contactEmail || 'Sem email'}</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleStartEditEmail}>
                      <Edit2 className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Histórico do Funil */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <History className="h-3 w-3" />
                Histórico do Funil
              </div>
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

            {/* Tabbed Content */}
            {attendee && (
              <Tabs defaultValue="qualificacao" className="w-full">
                <TabsList className="w-full grid grid-cols-3">
                  <TabsTrigger value="qualificacao" className="text-xs">Qualificação</TabsTrigger>
                  <TabsTrigger value="avaliacao" className="text-xs">Avaliação R2</TabsTrigger>
                  <TabsTrigger value="notas" className="text-xs">Notas</TabsTrigger>
                </TabsList>
                
                <TabsContent value="qualificacao" className="mt-4">
                  <R2QualificationTab attendee={attendee} />
                </TabsContent>
                
                <TabsContent value="avaliacao" className="mt-4">
                  <R2EvaluationTab 
                    attendee={attendee}
                    statusOptions={statusOptions}
                    thermometerOptions={thermometerOptions}
                  />
                </TabsContent>
                
                <TabsContent value="notas" className="mt-4">
                  <R2NotesTab attendee={attendee} />
                </TabsContent>
              </Tabs>
            )}
          </div>
        </ScrollArea>

        {/* Footer Actions */}
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
          
          <Button 
            variant="outline"
            className="w-full text-orange-600 border-orange-200 hover:bg-orange-50 dark:hover:bg-orange-950"
            onClick={() => setRefundModalOpen(true)}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reembolso
          </Button>

          {meeting.status === 'canceled' ? (
            <Button 
              variant="outline"
              className="w-full text-primary border-primary/30 hover:bg-primary/10"
              onClick={() => {
                restoreMeeting.mutate(meeting.id);
                onOpenChange(false);
              }}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Desfazer Cancelamento
            </Button>
          ) : (
            <Button 
              variant="outline"
              className="w-full text-destructive border-destructive/30 hover:bg-destructive/10"
              onClick={handleCancelMeeting}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Cancelar Reunião
            </Button>
          )}
        </div>
      </SheetContent>

      {/* Refund Modal */}
      {meeting && attendee && (
        <RefundModal
          open={refundModalOpen}
          onOpenChange={setRefundModalOpen}
          meetingId={meeting.id}
          attendeeId={attendee.id}
          dealId={attendee.deal_id}
          dealName={attendee.name || attendee.deal?.contact?.name}
          originId={(attendee.deal as any)?.origin_id}
          currentCustomFields={attendee.deal?.custom_fields as Record<string, any>}
          onSuccess={() => onOpenChange(false)}
        />
      )}

      {/* Transfer Modal */}
      {meeting && attendeeToTransfer && (
        <R2AttendeeTransferModal
          open={transferModalOpen}
          onOpenChange={(open) => {
            setTransferModalOpen(open);
            if (!open) setAttendeeToTransfer(null);
          }}
          attendee={attendeeToTransfer}
          meeting={meeting}
          buFilter="incorporador"
          onSuccess={() => onOpenChange(false)}
        />
      )}
    </Sheet>
  );
}
