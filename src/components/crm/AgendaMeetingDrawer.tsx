import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Phone, MessageCircle, Calendar, CheckCircle, XCircle, AlertTriangle, 
  ExternalLink, Clock, User, Mail, X, Save 
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
import { MeetingSlot, useUpdateMeetingStatus, useCancelMeeting, useUpdateMeetingNotes } from '@/hooks/useAgendaData';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { useConversationsContext } from '@/contexts/ConversationsContext';
import { toast } from 'sonner';

interface AgendaMeetingDrawerProps {
  meeting: MeetingSlot | null;
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

export function AgendaMeetingDrawer({ meeting, open, onOpenChange, onReschedule }: AgendaMeetingDrawerProps) {
  const navigate = useNavigate();
  const [notes, setNotes] = useState(meeting?.notes || '');
  const [isLoadingWhatsApp, setIsLoadingWhatsApp] = useState(false);
  const updateStatus = useUpdateMeetingStatus();
  const cancelMeeting = useCancelMeeting();
  const updateNotes = useUpdateMeetingNotes();
  const { findOrCreateConversationByPhone, selectConversation } = useConversationsContext();

  if (!meeting) return null;

  const contact = meeting.deal?.contact;
  const statusInfo = STATUS_LABELS[meeting.status] || STATUS_LABELS.scheduled;
  const isPending = meeting.status === 'scheduled' || meeting.status === 'rescheduled';

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
      // Fallback para WhatsApp externo
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

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader className="border-b pb-4">
          <div className="flex items-center justify-between">
            <DrawerTitle className="text-lg">Detalhes da Reunião</DrawerTitle>
            <DrawerClose asChild>
              <Button variant="ghost" size="icon">
                <X className="h-4 w-4" />
              </Button>
            </DrawerClose>
          </div>
        </DrawerHeader>

        <ScrollArea className="flex-1 p-6">
          <div className="space-y-6">
            {/* Lead Info */}
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div 
                  className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg"
                  style={{ backgroundColor: meeting.closer?.color || '#3B82F6' }}
                >
                  {contact?.name?.charAt(0) || 'L'}
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold">
                    {contact?.name || meeting.deal?.name || 'Lead sem nome'}
                  </h3>
                  {contact?.email && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Mail className="h-3.5 w-3.5" />
                      {contact.email}
                    </div>
                  )}
                  {contact?.phone && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="h-3.5 w-3.5" />
                      {contact.phone}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Meeting Info Card */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                <span className="font-medium">
                  {format(parseISO(meeting.scheduled_at), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                <span>
                  {format(parseISO(meeting.scheduled_at), 'HH:mm')} - {meeting.duration_minutes}min
                </span>
              </div>
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                <span>Closer: {meeting.closer?.name}</span>
                <div 
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: meeting.closer?.color || '#3B82F6' }}
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
                      onClick={() => onReschedule(meeting)}
                    >
                      <Calendar className="h-4 w-4" />
                      <span className="text-xs">Reagendar</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-col h-16 gap-1 text-green-600 hover:text-green-700"
                      onClick={() => updateStatus.mutate({ meetingId: meeting.id, status: 'completed' })}
                    >
                      <CheckCircle className="h-4 w-4" />
                      <span className="text-xs">Realizada</span>
                    </Button>
                  </div>
                </div>
              </>
            )}

            {/* Activity History - Placeholder */}
            <Separator />
            <div className="space-y-3">
              <h4 className="font-medium text-sm text-muted-foreground">Histórico</h4>
              <p className="text-sm text-muted-foreground">
                Acesse o negócio completo para ver o histórico de atividades
              </p>
            </div>

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
                disabled={updateNotes.isPending || notes === meeting.notes}
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
