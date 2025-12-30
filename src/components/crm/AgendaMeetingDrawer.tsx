import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { withCalendlyDateTimeParams, withCalendlyDateOnly, formatDateTimeForCalendly } from '@/lib/calendlyLink';
import { ptBR } from 'date-fns/locale';
import { 
  Phone, MessageCircle, Calendar, CheckCircle, XCircle, AlertTriangle, 
  ExternalLink, Clock, User, Mail, X, Save, Link, Copy, Users, Plus, Trash2, Send, CalendarDays
} from 'lucide-react';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
} from '@/components/ui/drawer';
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
} from '@/hooks/useAgendaData';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { useConversationsContext } from '@/contexts/ConversationsContext';
import { toast } from 'sonner';

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
};

export function AgendaMeetingDrawer({ meeting, relatedMeetings = [], open, onOpenChange, onReschedule }: AgendaMeetingDrawerProps) {
  const navigate = useNavigate();
  const [notes, setNotes] = useState(meeting?.notes || '');
  const [isLoadingWhatsApp, setIsLoadingWhatsApp] = useState(false);
  const [showAddPartner, setShowAddPartner] = useState(false);
  const [partnerName, setPartnerName] = useState('');
  const [partnerPhone, setPartnerPhone] = useState('');
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);
  
  const updateStatus = useUpdateMeetingStatus();
  const cancelMeeting = useCancelMeeting();
  const updateNotes = useUpdateMeetingNotes();
  const addAttendee = useAddMeetingAttendee();
  const removeAttendee = useRemoveMeetingAttendee();
  const markNotified = useMarkAttendeeNotified();
  const { findOrCreateConversationByPhone, selectConversation } = useConversationsContext();

  // All meetings at this slot (main + related)
  const allMeetings = meeting ? [meeting, ...relatedMeetings.filter(m => m.id !== meeting.id)] : [];
  const activeMeeting = allMeetings.find(m => m.id === selectedMeetingId) || meeting;

  if (!meeting || !activeMeeting) return null;

  const contact = activeMeeting.deal?.contact;
  const statusInfo = STATUS_LABELS[activeMeeting.status] || STATUS_LABELS.scheduled;
  const isPending = activeMeeting.status === 'scheduled' || activeMeeting.status === 'rescheduled';
  const meetingLink = activeMeeting.meeting_link || activeMeeting.closer?.calendly_default_link;
  // Video conference link (Google Meet/Zoom) - direct access to the meeting room
  const videoConferenceLink = (activeMeeting as any).video_conference_link;

  // Add date/time params to Calendly link using São Paulo timezone
  const enhancedMeetingLink = withCalendlyDateTimeParams(meetingLink, activeMeeting.scheduled_at);
  // Fallback link without time (only date) for when exact time is not available
  const fallbackLink = withCalendlyDateOnly(meetingLink, activeMeeting.scheduled_at);
  
  // Get formatted time for WhatsApp message
  const { date: formattedDateParam, time: formattedTimeParam } = formatDateTimeForCalendly(activeMeeting.scheduled_at);

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
    if (enhancedMeetingLink) {
      navigator.clipboard.writeText(enhancedMeetingLink);
      toast.success('Link copiado!');
    }
  };

  const handleOpenLink = () => {
    if (enhancedMeetingLink) {
      window.open(enhancedMeetingLink, '_blank');
    }
  };

  const handleOpenVideoConference = () => {
    if (videoConferenceLink) {
      console.log('Opening video conference:', videoConferenceLink);
      window.open(videoConferenceLink, '_blank');
    } else {
      toast.error('Link de videoconferência não disponível. Use o link do Calendly.');
    }
  };

  const handleSendLinkViaWhatsApp = (phone: string, name: string) => {
    if (!phone) return;
    const formattedPhone = phone.replace(/\D/g, '');
    
    // Prioritize video conference link (Google Meet) over Calendly link
    const linkToSend = videoConferenceLink || enhancedMeetingLink;
    if (!linkToSend) {
      toast.error('Nenhum link de reunião disponível');
      return;
    }
    
    const message = videoConferenceLink
      ? encodeURIComponent(
          `Olá ${name}! 👋\n\nSegue o link para nossa reunião (${formattedDateParam} às ${formattedTimeParam}):\n\n🔗 ${videoConferenceLink}\n\nÉ só clicar no link no horário agendado!\n\nAguardo você!`
        )
      : encodeURIComponent(
          `Olá ${name}! 👋\n\nSegue o link para nossa reunião (${formattedDateParam} às ${formattedTimeParam}):\n${enhancedMeetingLink}\n\nSe o horário não aparecer disponível, use este link:\n${fallbackLink}\n\nAguardo você!`
        );
    window.open(`https://wa.me/55${formattedPhone}?text=${message}`, '_blank');
  };
  
  const handleOpenFallbackLink = () => {
    if (fallbackLink) {
      window.open(fallbackLink, '_blank');
    }
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
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader className="border-b pb-4">
          <div className="flex items-center justify-between">
            <DrawerTitle className="text-lg">
              {allMeetings.length > 1 
                ? `Reuniões às ${format(parseISO(meeting.scheduled_at), 'HH:mm')} (${allMeetings.length})`
                : 'Detalhes da Reunião'
              }
            </DrawerTitle>
            <DrawerClose asChild>
              <Button variant="ghost" size="icon">
                <X className="h-4 w-4" />
              </Button>
            </DrawerClose>
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
        </DrawerHeader>

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

            {/* Meeting Link Section - Calendly scheduling link */}
            {enhancedMeetingLink && (
              <div className="bg-primary/10 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Link className="h-4 w-4 text-primary" />
                  <span className="font-medium text-sm">
                    {videoConferenceLink ? 'Link do Calendly (agendamento)' : 'Link da Reunião'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Input 
                    value={enhancedMeetingLink} 
                    readOnly 
                    className="text-xs bg-background"
                  />
                  <Button variant="outline" size="icon" onClick={handleCopyLink} title="Copiar link">
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" onClick={handleOpenLink} title="Abrir com horário">
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
                
                {/* Fallback link option */}
                <div className="flex items-center gap-2 pt-1 border-t border-primary/20">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="flex-1 text-xs text-muted-foreground hover:text-foreground"
                    onClick={handleOpenFallbackLink}
                  >
                    <CalendarDays className="h-3.5 w-3.5 mr-1.5" />
                    Abrir sem horário (se não aparecer disponível)
                  </Button>
                </div>
                
                {participants.length > 0 && (
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
              </div>
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
                      {p.phone && enhancedMeetingLink && (
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
                      className="flex-col h-16 gap-1"
                      onClick={handleCall}
                      disabled={!contact?.phone}
                    >
                      <Phone className="h-4 w-4" />
                      <span className="text-xs">Ligar</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-col h-16 gap-1"
                      onClick={handleWhatsApp}
                      disabled={!contact?.phone || isLoadingWhatsApp}
                    >
                      <MessageCircle className="h-4 w-4" />
                      <span className="text-xs">{isLoadingWhatsApp ? '...' : 'WhatsApp'}</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-col h-16 gap-1"
                      onClick={() => onReschedule(activeMeeting)}
                    >
                      <Calendar className="h-4 w-4" />
                      <span className="text-xs">Reagendar</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-col h-16 gap-1 text-green-600 hover:text-green-700"
                      onClick={() => updateStatus.mutate({ meetingId: activeMeeting.id, status: 'completed' })}
                    >
                      <CheckCircle className="h-4 w-4" />
                      <span className="text-xs">Realizada</span>
                    </Button>
                  </div>
                </div>
              </>
            )}

            {/* Notes */}
            <Separator />
            <div className="space-y-3">
              <h4 className="font-medium text-sm text-muted-foreground">Notas</h4>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Adicione notas sobre a reunião..."
                rows={3}
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

            {/* Danger Actions */}
            {isPending && (
              <>
                <Separator />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-yellow-600 hover:text-yellow-700"
                    onClick={() => updateStatus.mutate({ meetingId: meeting.id, status: 'no_show' })}
                  >
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    Marcar No-Show
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-destructive hover:text-destructive"
                    onClick={() => cancelMeeting.mutate(meeting.id)}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Cancelar
                  </Button>
                </div>
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
      </DrawerContent>
    </Drawer>
  );
}