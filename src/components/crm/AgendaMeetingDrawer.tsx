import { useState } from 'react';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Phone, MessageCircle, Calendar, CheckCircle, XCircle, AlertTriangle, 
  ExternalLink, Clock, User, Mail, X, Save, Copy, Users, Plus, Trash2, Send, 
  Lock, DollarSign, UserCircle, StickyNote
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
} from '@/components/ui/sheet';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { 
  MeetingSlot, 
  MeetingAttendee,
  useUpdateMeetingStatus, 
  useCancelMeeting, 
  useUpdateMeetingNotes,
  useAddMeetingAttendee,
  useRemoveMeetingAttendee,
  useMarkAttendeeNotified,
  useDeleteMeeting,
} from '@/hooks/useAgendaData';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { useConversationsContext } from '@/contexts/ConversationsContext';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

interface AgendaMeetingDrawerProps {
  meeting: MeetingSlot | null;
  relatedMeetings?: MeetingSlot[]; // Other meetings at the same time/closer
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReschedule: (meeting: MeetingSlot) => void;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  scheduled: { label: 'Agendada', color: 'bg-primary' },
  rescheduled: { label: 'Reagendada', color: 'bg-yellow-500' },
  completed: { label: 'Realizada', color: 'bg-green-500' },
  no_show: { label: 'No-show', color: 'bg-red-500' },
  canceled: { label: 'Cancelada', color: 'bg-muted' },
  contract_paid: { label: 'Contrato Pago', color: 'bg-emerald-600' },
};

// Roles that can delete meetings
const DELETE_ALLOWED_ROLES = ['admin', 'manager', 'coordenador'];

export function AgendaMeetingDrawer({ meeting, relatedMeetings = [], open, onOpenChange, onReschedule }: AgendaMeetingDrawerProps) {
  const navigate = useNavigate();
  const { role } = useAuth();
  const [notes, setNotes] = useState(meeting?.notes || '');
  const [isLoadingWhatsApp, setIsLoadingWhatsApp] = useState(false);
  const [showAddPartner, setShowAddPartner] = useState(false);
  const [partnerName, setPartnerName] = useState('');
  const [partnerPhone, setPartnerPhone] = useState('');
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);
  const [showNoShowConfirm, setShowNoShowConfirm] = useState(false);
  
  const updateStatus = useUpdateMeetingStatus();
  const cancelMeeting = useCancelMeeting();
  const updateNotes = useUpdateMeetingNotes();
  const addAttendee = useAddMeetingAttendee();
  const removeAttendee = useRemoveMeetingAttendee();
  const markNotified = useMarkAttendeeNotified();
  const deleteMeeting = useDeleteMeeting();
  const { findOrCreateConversationByPhone, selectConversation } = useConversationsContext();

  // Check if user can delete meetings
  const canDeleteMeeting = role && DELETE_ALLOWED_ROLES.includes(role);

  const handleDeleteMeeting = () => {
    deleteMeeting.mutate(activeMeeting.id, {
      onSuccess: () => {
        onOpenChange(false);
      }
    });
  };

  const handleNoShowConfirm = () => {
    updateStatus.mutate({ meetingId: activeMeeting.id, status: 'no_show' }, {
      onSuccess: () => {
        setShowNoShowConfirm(false);
        toast.success('Reunião marcada como No-Show. O SDR será alertado para reagendar.');
      }
    });
  };

  const handleContractPaid = () => {
    updateStatus.mutate({ meetingId: activeMeeting.id, status: 'contract_paid' });
  };

  // All meetings at this slot (main + related)
  const allMeetings = meeting ? [meeting, ...relatedMeetings.filter(m => m.id !== meeting.id)] : [];
  const activeMeeting = allMeetings.find(m => m.id === selectedMeetingId) || meeting;

  // Fetch SDR notes for this deal - MUST be before any conditional return
  const dealId = activeMeeting?.deal_id;
  const { data: sdrNotes } = useQuery({
    queryKey: ['deal-sdr-notes', dealId],
    queryFn: async () => {
      if (!dealId) return [];
      
      const { data, error } = await supabase
        .from('deal_activities')
        .select('id, description, created_at')
        .eq('deal_id', dealId)
        .eq('activity_type', 'note')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!dealId,
  });

  if (!meeting || !activeMeeting) return null;

  const contact = activeMeeting.deal?.contact;
  const sdrProfile = activeMeeting.booked_by_profile;
  const statusInfo = STATUS_LABELS[activeMeeting.status] || STATUS_LABELS.scheduled;
  const isPending = activeMeeting.status === 'scheduled' || activeMeeting.status === 'rescheduled';
  const isCompleted = activeMeeting.status === 'completed';
  // Video conference link (Google Meet) - direct access to the meeting room
  const videoConferenceLink = activeMeeting.video_conference_link;

  // Format date/time for WhatsApp message
  const scheduledDate = parseISO(activeMeeting.scheduled_at);
  const formattedDateParam = format(scheduledDate, 'dd/MM/yyyy');
  const formattedTimeParam = format(scheduledDate, 'HH:mm');

  const handleCall = () => {
    if (contact?.phone) {
      window.open(`tel:${contact.phone}`, '_blank');
    }
  };

  const handleWhatsApp = async () => {
    if (!contact?.phone) return;
    
    setIsLoadingWhatsApp(true);
    try {
      const conversationId = await findOrCreateConversationByPhone(
        contact.phone, 
        contact.name
      );
      selectConversation(conversationId);
      onOpenChange(false);
      navigate('/crm/atendimentos');
    } catch (error) {
      console.error('Erro ao iniciar conversa:', error);
      toast.error('Erro ao abrir conversa. Abrindo WhatsApp externo...');
      const phone = contact.phone.replace(/\D/g, '');
      window.open(`https://wa.me/55${phone}`, '_blank');
    } finally {
      setIsLoadingWhatsApp(false);
    }
  };

  const handleViewDeal = () => {
    if (meeting.deal_id) {
      navigate(`/crm/negocios?deal=${meeting.deal_id}`);
      onOpenChange(false);
    }
  };

  const handleSaveNotes = () => {
    updateNotes.mutate({ meetingId: meeting.id, notes });
  };

  const handleCopyLink = () => {
    if (videoConferenceLink) {
      navigator.clipboard.writeText(videoConferenceLink);
      toast.success('Link copiado!');
    }
  };

  const handleOpenVideoConference = () => {
    if (videoConferenceLink) {
      console.log('Opening video conference:', videoConferenceLink);
      window.open(videoConferenceLink, '_blank');
    } else {
      toast.error('Link de videoconferência não disponível.');
    }
  };

  const handleSendLinkViaWhatsApp = (phone: string, name: string) => {
    if (!phone) return;
    const formattedPhone = phone.replace(/\D/g, '');
    
    if (!videoConferenceLink) {
      toast.error('Nenhum link de reunião disponível');
      return;
    }
    
    const message = encodeURIComponent(
      `Olá ${name}! 👋\n\nSegue o link para nossa reunião (${formattedDateParam} às ${formattedTimeParam}):\n\n🔗 ${videoConferenceLink}\n\nÉ só clicar no link no horário agendado!\n\nAguardo você!`
    );
    window.open(`https://wa.me/55${formattedPhone}?text=${message}`, '_blank');
  };

  const handleAddPartner = () => {
    if (!partnerName.trim()) {
      toast.error('Informe o nome do sócio');
      return;
    }
    
    addAttendee.mutate({
      meetingSlotId: activeMeeting.id,
      attendeeName: partnerName,
      attendeePhone: partnerPhone || undefined,
      isPartner: true,
    }, {
      onSuccess: () => {
        setPartnerName('');
        setPartnerPhone('');
        setShowAddPartner(false);
      }
    });
  };

  const handleRemoveAttendee = (attendeeId: string) => {
    removeAttendee.mutate(attendeeId);
  };

  const handleSendToAll = () => {
    const allParticipants = getParticipantsList();
    allParticipants.forEach(p => {
      if (p.phone) {
        handleSendLinkViaWhatsApp(p.phone, p.name);
      }
    });
  };

  // Get all participants (main contact + attendees) for the active meeting
  const getParticipantsList = () => {
    const participants: { id?: string; name: string; phone: string | null; isPartner: boolean; isMain: boolean; notifiedAt?: string | null }[] = [];
    
    // Main contact
    if (contact) {
      participants.push({
        name: contact.name,
        phone: contact.phone,
        isPartner: false,
        isMain: true,
      });
    }

    // Additional attendees
    activeMeeting.attendees?.forEach(att => {
      // Skip if it's the same as main contact
      if (att.contact_id === activeMeeting.contact_id) return;
      
      const name = att.attendee_name || att.contact?.name || 'Participante';
      const phone = att.attendee_phone || att.contact?.phone;
      
      participants.push({
        id: att.id,
        name,
        phone,
        isPartner: att.is_partner || false,
        isMain: false,
        notifiedAt: att.notified_at,
      });
    });

    return participants;
  };

  const participants = getParticipantsList();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg p-0 flex flex-col">
        <SheetHeader className="border-b p-4">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-lg">
              {allMeetings.length > 1 
                ? `Reuniões às ${format(parseISO(meeting.scheduled_at), 'HH:mm')} (${allMeetings.length})`
                : 'Detalhes da Reunião'
              }
            </SheetTitle>
          </div>
          
          {/* Tabs for multiple meetings */}
          {allMeetings.length > 1 && (
            <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
              {allMeetings.map((m) => (
                <Button
                  key={m.id}
                  variant={activeMeeting.id === m.id ? 'default' : 'outline'}
                  size="sm"
                  className="text-xs flex-shrink-0"
                  onClick={() => setSelectedMeetingId(m.id)}
                >
                  {m.deal?.contact?.name?.split(' ')[0] || m.deal?.name?.split(' ')[0] || 'Lead'}
                </Button>
              ))}
            </div>
          )}
        </SheetHeader>

        <ScrollArea className="flex-1 p-6">
          <div className="space-y-6">
            {/* Video Conference Link Section - Primary action */}
            {videoConferenceLink && (
              <div className="bg-green-500/10 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <ExternalLink className="h-4 w-4 text-green-600" />
                  <span className="font-medium text-sm text-green-700 dark:text-green-400">Entrar na Reunião</span>
                </div>
                <Button 
                  className="w-full bg-green-600 hover:bg-green-700 text-white"
                  onClick={handleOpenVideoConference}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Abrir Google Meet / Zoom
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  Clique para entrar diretamente na sala de videoconferência
                </p>
              </div>
            )}

            {/* Send link to all participants */}
            {videoConferenceLink && participants.length > 0 && (
              <Button 
                variant="secondary" 
                size="sm" 
                className="w-full"
                onClick={handleSendToAll}
              >
                <Send className="h-4 w-4 mr-2" />
                Enviar link para todos via WhatsApp
              </Button>
            )}

            {/* Participants Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  <span className="font-medium text-sm">Participantes ({participants.length})</span>
                </div>
                {isPending && participants.length < 4 && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setShowAddPartner(!showAddPartner)}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Sócio
                  </Button>
                )}
              </div>

              {/* Add Partner Form */}
              {showAddPartner && (
                <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                  <Input
                    placeholder="Nome do sócio"
                    value={partnerName}
                    onChange={(e) => setPartnerName(e.target.value)}
                  />
                  <Input
                    placeholder="Telefone (opcional)"
                    value={partnerPhone}
                    onChange={(e) => setPartnerPhone(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      onClick={handleAddPartner}
                      disabled={addAttendee.isPending}
                    >
                      Adicionar
                    </Button>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      onClick={() => setShowAddPartner(false)}
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}

              {/* Participants List */}
              <div className="space-y-2">
                {participants.map((p, idx) => (
                  <div 
                    key={p.id || idx} 
                    className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                        style={{ backgroundColor: activeMeeting.closer?.color || '#3B82F6' }}
                      >
                        {p.name.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{p.name}</span>
                          {p.isMain && (
                            <Badge variant="secondary" className="text-xs">Principal</Badge>
                          )}
                          {p.isPartner && (
                            <Badge variant="outline" className="text-xs">Sócio</Badge>
                          )}
                        </div>
                        {p.phone && (
                          <span className="text-xs text-muted-foreground">{p.phone}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {p.phone && videoConferenceLink && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8"
                          onClick={() => handleSendLinkViaWhatsApp(p.phone!, p.name)}
                        >
                          <MessageCircle className="h-4 w-4 text-green-600" />
                        </Button>
                      )}
                      {!p.isMain && p.id && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-destructive"
                          onClick={() => handleRemoveAttendee(p.id!)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* SDR Info Section */}
            {sdrProfile && (
              <>
                <div className="bg-blue-500/10 rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <UserCircle className="h-4 w-4 text-blue-600" />
                    <span className="font-medium text-sm text-blue-700 dark:text-blue-400">SDR que Agendou</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span>{sdrProfile.full_name || 'Não informado'}</span>
                  </div>
                  {sdrProfile.email && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">{sdrProfile.email}</span>
                    </div>
                  )}
                  
                  {/* Notas do SDR sobre o lead */}
                  {sdrNotes && sdrNotes.length > 0 && (
                    <div className="pt-2 border-t border-blue-500/20">
                      <div className="flex items-center gap-2 mb-2">
                        <StickyNote className="h-4 w-4 text-blue-600" />
                        <span className="text-xs font-medium text-blue-700 dark:text-blue-400">
                          Notas do SDR ({sdrNotes.length})
                        </span>
                      </div>
                      <ScrollArea className="max-h-[120px]">
                        <div className="space-y-2">
                          {sdrNotes.map((note) => (
                            <div key={note.id} className="bg-white/50 dark:bg-black/20 rounded p-2">
                              <p className="text-sm whitespace-pre-wrap">{note.description}</p>
                              <span className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(note.created_at!), { addSuffix: true, locale: ptBR })}
                              </span>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  )}
                </div>
                <Separator />
              </>
            )}

            {/* Meeting Info Card */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                <span className="font-medium">
                  {format(parseISO(activeMeeting.scheduled_at), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                <span>
                  {format(parseISO(activeMeeting.scheduled_at), 'HH:mm')} - {activeMeeting.duration_minutes}min
                </span>
              </div>
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                <span>Closer: {activeMeeting.closer?.name}</span>
                <div 
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: activeMeeting.closer?.color || '#3B82F6' }}
                />
              </div>
              <div className="flex items-center gap-2">
                <Badge className={cn('gap-1', statusInfo.color, 'text-white')}>
                  {statusInfo.label}
                </Badge>
              </div>
            </div>

            {/* Quick Actions */}
            {isPending && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h4 className="font-medium text-sm text-muted-foreground">Ações Rápidas</h4>
                  <div className="grid grid-cols-4 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-col h-16 gap-1 text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50 dark:hover:bg-yellow-950/20"
                      onClick={() => setShowNoShowConfirm(true)}
                    >
                      <AlertTriangle className="h-4 w-4" />
                      <span className="text-xs">No-Show</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-col h-16 gap-1 opacity-50 cursor-not-allowed relative"
                      disabled
                    >
                      <Lock className="h-4 w-4" />
                      <span className="text-xs">Reagendar</span>
                      <Badge variant="secondary" className="absolute -top-2 -right-2 text-[10px] px-1">
                        Em breve
                      </Badge>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-col h-16 gap-1 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950/20"
                      onClick={() => updateStatus.mutate({ meetingId: activeMeeting.id, status: 'completed' })}
                    >
                      <CheckCircle className="h-4 w-4" />
                      <span className="text-xs">Realizada</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-col h-16 gap-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                      onClick={handleContractPaid}
                      disabled={updateStatus.isPending}
                    >
                      <DollarSign className="h-4 w-4" />
                      <span className="text-xs">Contrato Pago</span>
                    </Button>
                  </div>
                </div>
              </>
            )}


            {/* Notes */}
            <Separator />
            <div className="space-y-3">
              <h4 className="font-medium text-sm text-muted-foreground">Notas da Closer</h4>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Escreva suas observações sobre o lead e a reunião..."
                rows={4}
              />
              <Button 
                size="sm" 
                onClick={handleSaveNotes}
                disabled={updateNotes.isPending || notes === activeMeeting.notes}
              >
                <Save className="h-4 w-4 mr-2" />
                Salvar Notas
              </Button>
            </div>

            {/* No-Show Confirmation Dialog */}
            <AlertDialog open={showNoShowConfirm} onOpenChange={setShowNoShowConfirm}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-yellow-600" />
                    Confirmar No-Show
                  </AlertDialogTitle>
                  <AlertDialogDescription className="space-y-2">
                    <p>Ao marcar esta reunião como No-Show:</p>
                    <ul className="list-disc list-inside space-y-1 text-sm">
                      <li>O status será alterado para "No-Show"</li>
                      <li>O SDR <strong>{sdrProfile?.full_name || 'responsável'}</strong> será alertado</li>
                      <li>O lead deverá ser reagendado pelo SDR</li>
                    </ul>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={handleNoShowConfirm}
                    className="bg-yellow-600 hover:bg-yellow-700"
                  >
                    Confirmar No-Show
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            {/* Danger Actions - Cancel only */}
            {isPending && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h4 className="font-medium text-sm text-muted-foreground">Ações de Status</h4>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-destructive hover:text-destructive"
                    onClick={() => cancelMeeting.mutate(meeting.id)}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Cancelar Reunião
                  </Button>
                </div>
                
                {/* Delete button - Only visible for coordenador and above */}
                {canDeleteMeeting && (
                  <>
                    <Separator />
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          variant="destructive" 
                          size="sm" 
                          className="w-full"
                          disabled={deleteMeeting.isPending}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          {deleteMeeting.isPending ? 'Excluindo...' : 'Excluir Permanentemente'}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir reunião?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta ação não pode ser desfeita. A reunião será excluída permanentemente do sistema.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Voltar</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={handleDeleteMeeting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </>
                )}
              </>
            )}

            {/* View Deal Button */}
            {meeting.deal_id && (
              <Button variant="secondary" className="w-full" onClick={handleViewDeal}>
                <ExternalLink className="h-4 w-4 mr-2" />
                Ver Negócio Completo
              </Button>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
