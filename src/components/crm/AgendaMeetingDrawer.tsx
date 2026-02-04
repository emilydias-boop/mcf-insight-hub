import { useState, useEffect, useMemo } from 'react';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Phone, MessageCircle, Calendar, CheckCircle, XCircle, AlertTriangle, 
  ExternalLink, Clock, User, Mail, X, Save, Copy, Users, Plus, Trash2, Send, 
  Lock, DollarSign, UserCircle, StickyNote, Pencil, Check, ArrowRightLeft, Video, Link2
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCloserMeetingLink } from '@/hooks/useCloserMeetingLink';
import { supabase } from '@/integrations/supabase/client';
import { useOutsideDetectionBatch } from '@/hooks/useOutsideDetection';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  useUpdateAttendeeAndSlotStatus,
  useUpdateAttendeeNotes,
  useUpdateAttendeePhone,
} from '@/hooks/useAgendaData';
import { MoveAttendeeModal } from './MoveAttendeeModal';
import { AttendeeNotesSection } from './AttendeeNotesSection';
import { MovementHistorySection } from '@/components/sdr/MovementHistorySection';
import { LinkContractDialog } from './LinkContractDialog';
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
  invited: { label: 'Convidado', color: 'bg-blue-400' },
  rescheduled: { label: 'Reagendada', color: 'bg-yellow-500' },
  completed: { label: 'Realizada', color: 'bg-green-500' },
  no_show: { label: 'No-show', color: 'bg-red-500' },
  canceled: { label: 'Cancelada', color: 'bg-muted' },
  contract_paid: { label: 'Contrato Pago', color: 'bg-emerald-600' },
};

// Parse reschedule history from notes
const parseRescheduleHistory = (notes: string | null | undefined) => {
  if (!notes) return { originalNote: null, reschedules: [] };
  
  const separator = '--- Reagendado em';
  const parts = notes.split(separator);
  
  if (parts.length <= 1) {
    return { originalNote: notes.trim() || null, reschedules: [] };
  }
  
  const originalNote = parts[0].trim() || null;
  const reschedules = parts.slice(1).map(part => {
    const lines = part.trim().split('\n');
    const dateMatch = lines[0]?.match(/^(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2})/);
    const fromToMatch = lines[1]?.match(/De:\s*(.+?)\s*→\s*Para:\s*(.+)/);
    const motivoMatch = lines[2]?.match(/Motivo:\s*(.+)/);
    
    return {
      date: dateMatch?.[1] || 'Data não informada',
      from: fromToMatch?.[1] || 'N/A',
      to: fromToMatch?.[2] || 'N/A',
      reason: motivoMatch?.[1] || lines.slice(2).join(' ').replace('Motivo:', '').trim() || 'Não informado'
    };
  });
  
  return { originalNote, reschedules };
};

// Roles that can delete meetings
const DELETE_ALLOWED_ROLES = ['admin', 'manager', 'coordenador', 'sdr'];

export function AgendaMeetingDrawer({ meeting, relatedMeetings = [], open, onOpenChange, onReschedule }: AgendaMeetingDrawerProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { role, user } = useAuth();
  const [closerNotes, setCloserNotes] = useState(meeting?.closer_notes || '');
  const [sdrNote, setSdrNote] = useState(meeting?.notes || '');
  const [isLoadingWhatsApp, setIsLoadingWhatsApp] = useState(false);
  const [showAddPartner, setShowAddPartner] = useState(false);
  const [partnerName, setPartnerName] = useState('');
  const [partnerPhone, setPartnerPhone] = useState('');
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);
  const [selectedParticipantId, setSelectedParticipantId] = useState<string | null>(null);
  const [showNoShowConfirm, setShowNoShowConfirm] = useState(false);
  const [editingPhoneId, setEditingPhoneId] = useState<string | null>(null);
  const [editedPhone, setEditedPhone] = useState('');
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [showR2PromptDialog, setShowR2PromptDialog] = useState(false);
  const [showLinkContractDialog, setShowLinkContractDialog] = useState(false);
  const [contractPaidParticipant, setContractPaidParticipant] = useState<{ id: string; name: string; dealId: string | null } | null>(null);
  
  const updateStatus = useUpdateMeetingStatus();
  const cancelMeeting = useCancelMeeting();
  const updateNotes = useUpdateMeetingNotes();
  const addAttendee = useAddMeetingAttendee();
  const removeAttendee = useRemoveMeetingAttendee();
  const markNotified = useMarkAttendeeNotified();
  const deleteMeeting = useDeleteMeeting();
  const updateAttendeeAndSlotStatus = useUpdateAttendeeAndSlotStatus();
  const updateAttendeeNotes = useUpdateAttendeeNotes();
  const updateAttendeePhone = useUpdateAttendeePhone();
  const { findOrCreateConversationByPhone, selectConversation } = useConversationsContext();

  // Check if user can delete meetings
  const canDeleteMeeting = role && DELETE_ALLOWED_ROLES.includes(role);
  
  // Check if user can transfer attendees
  const canTransfer = ['admin', 'manager', 'coordenador'].includes(role || '');

  const handleDeleteMeeting = () => {
    deleteMeeting.mutate(activeMeeting.id, {
      onSuccess: () => {
        onOpenChange(false);
      }
    });
  };

  // Handler to update participant status - uses combined mutation to prevent race condition
  // Syncs meeting_slots.status when the principal participant changes to completed/contract_paid
  // Note: no_show is individual per participant - should NOT sync to slot to avoid affecting other leads
  const handleParticipantStatusChange = (participantId: string, newStatus: string) => {
    const statusesToSync = ['completed', 'contract_paid'];
    const attendee = activeMeeting?.attendees?.find(a => a.id === participantId);
    const isPrincipal = attendee && !attendee.is_partner && !attendee.parent_attendee_id;
    const shouldSyncSlot = statusesToSync.includes(newStatus) && isPrincipal;

    updateAttendeeAndSlotStatus.mutate({
      attendeeId: participantId,
      status: newStatus,
      meetingId: activeMeeting?.id,
      syncSlot: shouldSyncSlot,
    }, {
      onSuccess: () => {
        if (newStatus === 'no_show') {
          setShowNoShowConfirm(false);
        }
      }
    });
  };

  const handleNoShowConfirm = () => {
    if (selectedParticipant) {
      handleParticipantStatusChange(selectedParticipant.id, 'no_show');
    }
  };

  const handleContractPaid = () => {
    if (selectedParticipant) {
      // Store participant info for R2 prompt
      const participantName = selectedParticipant.name;
      const dealId = activeMeeting?.deal_id || null;
      
      handleParticipantStatusChange(selectedParticipant.id, 'contract_paid');
      
      // Show R2 scheduling prompt after contract paid
      setContractPaidParticipant({
        id: selectedParticipant.id,
        name: participantName,
        dealId
      });
      // Small delay to let the status update complete
      setTimeout(() => {
        setShowR2PromptDialog(true);
        // Invalidate pending leads query to update count
        queryClient.invalidateQueries({ queryKey: ['r2-pending-leads'] });
      }, 500);
    }
  };

  const handleCompleted = () => {
    if (selectedParticipant) {
      handleParticipantStatusChange(selectedParticipant.id, 'completed');
    }
  };

  // All meetings at this slot (main + related)
  const allMeetings = meeting ? [meeting, ...relatedMeetings.filter(m => m.id !== meeting.id)] : [];
  const activeMeeting = allMeetings.find(m => m.id === selectedMeetingId) || meeting;

  // Sync notes when active meeting changes (only reset participant selection)
  useEffect(() => {
    // Reset participant selection when meeting changes
    setSelectedParticipantId(null);
  }, [activeMeeting?.id]);

  // Get participants - needed before early return for useEffect dependency
  // All participants come from meeting_slot_attendees table now
  const getParticipantsListEarly = () => {
    if (!activeMeeting) return [];
    
    return activeMeeting.attendees?.map(att => ({
      id: att.id,
      notes: att.notes,
      closerNotes: att.closer_notes,
    })) || [];
  };
  
  const participantsEarly = getParticipantsListEarly();
  const selectedParticipantEarly = participantsEarly.find(p => p.id === selectedParticipantId) || participantsEarly[0];

  // Sync notes when selected participant changes - MUST be before any conditional return
  // Fallback: if attendee.notes is empty, use meeting_slots.notes
  useEffect(() => {
    const attendeeNotes = selectedParticipantEarly?.notes;
    const slotNotes = activeMeeting?.notes;
    setSdrNote(attendeeNotes || slotNotes || '');
    setCloserNotes(selectedParticipantEarly?.closerNotes || '');
  }, [selectedParticipantEarly?.id, selectedParticipantEarly?.notes, selectedParticipantEarly?.closerNotes, activeMeeting?.notes]);

  // Check if current user is the SDR who booked this meeting
  const isBookedBySdr = user?.id === activeMeeting?.booked_by;
  const canEditSdrNote = isBookedBySdr && (activeMeeting?.status === 'scheduled' || activeMeeting?.status === 'rescheduled');

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

  // Fetch dynamic meeting link based on closer, day and time - MUST be before any conditional return
  const { data: dynamicMeetingLink } = useCloserMeetingLink(
    activeMeeting?.closer_id,
    activeMeeting?.scheduled_at
  );

  // Collect attendees for Outside detection - MUST be before any conditional return
  const attendeesForOutsideCheck = useMemo(() => {
    return (activeMeeting?.attendees || []).map(att => ({
      id: att.id,
      email: att.contact?.email || null,
      meetingDate: activeMeeting?.scheduled_at || ''
    }));
  }, [activeMeeting?.attendees, activeMeeting?.scheduled_at]);

  // Hook to detect Outside leads (purchased contract before meeting) - MUST be before any conditional return
  const { data: outsideData = {} } = useOutsideDetectionBatch(attendeesForOutsideCheck);

  if (!meeting || !activeMeeting) return null;

  const contact = activeMeeting.deal?.contact;
  const statusInfo = STATUS_LABELS[activeMeeting.status] || STATUS_LABELS.scheduled;
  const isPending = activeMeeting.status === 'scheduled' || activeMeeting.status === 'rescheduled';
  const isCompleted = activeMeeting.status === 'completed';
  
  // Video conference link - use saved link first, fallback to dynamic link
  const videoConferenceLink = activeMeeting.video_conference_link || dynamicMeetingLink;

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

  const handleSaveCloserNotes = () => {
    if (!selectedParticipant) return;
    
    // All participants use the attendees table now
    updateAttendeeNotes.mutate({ 
      attendeeId: selectedParticipant.id, 
      field: 'closer_notes', 
      notes: closerNotes 
    });
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
    
    if (!selectedParticipant) {
      toast.error('Selecione um participante primeiro');
      return;
    }
    
    addAttendee.mutate({
      meetingSlotId: activeMeeting.id,
      dealId: selectedParticipant.dealId,
      attendeeName: partnerName,
      attendeePhone: partnerPhone || undefined,
      isPartner: true,
      parentAttendeeId: selectedParticipant.id,
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

  // Get all participants from the attendees table - all are treated equally
  const getParticipantsList = () => {
    const attendees = activeMeeting.attendees || [];
    
    // Create a map for parent attendee lookup
    const attendeeMap = new Map(attendees.map(a => [a.id, a]));
    
    return attendees.map(att => {
      // Fallback chain for name: attendee_name -> contact.name -> deal.name -> meeting.deal.contact.name -> meeting.deal.name -> 'Participante'
      const name = att.attendee_name 
        || att.contact?.name 
        || att.deal?.name
        || activeMeeting.deal?.contact?.name 
        || activeMeeting.deal?.name 
        || 'Participante';
      // Fallback chain for phone: attendee_phone -> contact.phone -> meeting.deal.contact.phone
      const phone = att.attendee_phone || att.contact?.phone || activeMeeting.deal?.contact?.phone;
      const parentAttendee = att.parent_attendee_id ? attendeeMap.get(att.parent_attendee_id) : null;
      
      return {
        id: att.id,
        name,
        phone,
        dealId: att.deal_id || parentAttendee?.deal_id || activeMeeting.deal_id,
        isPartner: att.is_partner || false,
        notifiedAt: att.notified_at,
        bookedBy: att.booked_by || parentAttendee?.booked_by || activeMeeting.booked_by,
        notes: att.notes,
        closerNotes: att.closer_notes,
        status: att.status || 'scheduled',
        contractPaidAt: att.contract_paid_at,
        bookedByProfile: att.booked_by_profile || parentAttendee?.booked_by_profile || activeMeeting.booked_by_profile,
        parentAttendeeId: att.parent_attendee_id,
        parentAttendeeName: parentAttendee ? (parentAttendee.attendee_name || parentAttendee.contact?.name || 'Lead') : null,
      };
    });
  };

  const participants = getParticipantsList();
  
  // Selected participant (default to first/main)
  const selectedParticipant = participants.find(p => p.id === selectedParticipantId) || participants[0];
  
  // Check if current user can edit note for the selected participant
  // Roles que podem editar notas de qualquer SDR
  const NOTE_EDIT_ALLOWED_ROLES = ['admin', 'manager', 'coordenador'];
  const isNoteOwner = user?.id === selectedParticipant?.bookedBy;
  const hasElevatedRole = role && NOTE_EDIT_ALLOWED_ROLES.includes(role);
  const isEditableStatus = activeMeeting?.status === 'scheduled' || activeMeeting?.status === 'rescheduled';
  
  const canEditSelectedNote = (isNoteOwner || hasElevatedRole) && isEditableStatus;

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

            {/* Copy meeting link */}
            {videoConferenceLink && (
              <Button 
                variant="secondary" 
                size="sm" 
                className="w-full"
                onClick={handleCopyLink}
              >
                <Copy className="h-4 w-4 mr-2" />
                Copiar link da reunião
              </Button>
            )}

            {/* Reschedule Banner - Show if participant has reschedule history */}
            {(() => {
              const { reschedules } = parseRescheduleHistory(selectedParticipant?.notes);
              if (reschedules.length === 0) return null;
              
              const lastReschedule = reschedules[reschedules.length - 1];
              
              return (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <ArrowRightLeft className="h-4 w-4 text-amber-600" />
                    <span className="font-medium text-sm text-amber-700 dark:text-amber-400">
                      ⚠️ Reagendamento ({reschedules.length}x)
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p><strong>Último:</strong> {lastReschedule.date}</p>
                    <p><strong>De:</strong> {lastReschedule.from}</p>
                    <p><strong>Para:</strong> {lastReschedule.to}</p>
                    <p><strong>Motivo:</strong> {lastReschedule.reason}</p>
                  </div>
                  {reschedules.length > 1 && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-amber-600 hover:underline">
                        Ver histórico completo ({reschedules.length} reagendamentos)
                      </summary>
                      <div className="mt-2 space-y-2 pl-2 border-l-2 border-amber-500/30">
                        {reschedules.slice(0, -1).reverse().map((r, i) => (
                          <div key={i} className="text-muted-foreground">
                            <p className="font-medium">{r.date}</p>
                            <p>{r.from} → {r.to}</p>
                            <p className="italic">"{r.reason}"</p>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              );
            })()}

            {/* Participants Section */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                <span className="font-medium text-sm">Participantes ({participants.length})</span>
              </div>

              {/* Participants List - Clickable */}
              <div className="space-y-2">
                {participants.map((p, idx) => (
                  <div 
                    key={p.id || idx} 
                    className={cn(
                      "flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all",
                      selectedParticipant?.id === p.id 
                        ? "bg-primary/20 ring-2 ring-primary" 
                        : "bg-muted/30 hover:bg-muted/50"
                    )}
                    onClick={() => setSelectedParticipantId(p.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div 
                        className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center text-white font-bold",
                          selectedParticipant?.id === p.id && "ring-2 ring-offset-2 ring-primary"
                        )}
                        style={{ backgroundColor: activeMeeting.closer?.color || '#3B82F6' }}
                      >
                        {p.name.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{p.name}</span>
                          {p.isPartner && (
                            <Badge variant="outline" className="text-xs">
                              {p.parentAttendeeName ? `Sócio de ${p.parentAttendeeName.split(' ')[0]}` : 'Sócio'}
                            </Badge>
                          )}
                          {!p.isPartner && p.parentAttendeeId && 
                           !['contract_paid', 'completed', 'refunded', 'approved', 'rejected'].includes(p.status) && (
                            <Badge variant="outline" className="text-xs bg-orange-100 text-orange-700 border-orange-300 gap-1">
                              <ArrowRightLeft className="h-3 w-3" />
                              Remanejado
                            </Badge>
                          )}
                          {outsideData[p.id]?.isOutside && (
                            <Badge variant="outline" className="text-xs bg-yellow-100 text-yellow-700 border-yellow-300 gap-1">
                              <DollarSign className="h-3 w-3" />
                              Outside {outsideData[p.id]?.contractDate && `- ${format(parseISO(outsideData[p.id].contractDate!), 'dd/MM')}`}
                            </Badge>
                          )}
                          {/* Individual Status Badge - contract_paid_at takes priority */}
                          {(() => {
                            // If contract_paid_at exists, always show "Contrato Pago" regardless of status field
                            const displayStatus = p.contractPaidAt ? 'contract_paid' : p.status;
                            if (!displayStatus || displayStatus === 'scheduled') return null;
                            return (
                              <Badge className={cn('text-xs text-white', STATUS_LABELS[displayStatus]?.color || 'bg-muted')}>
                                {STATUS_LABELS[displayStatus]?.label || displayStatus}
                              </Badge>
                            );
                          })()}
                          {selectedParticipant?.id === p.id && (
                            <Badge className="text-xs bg-primary">Selecionado</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          {editingPhoneId === p.id ? (
                            <>
                              <Input
                                value={editedPhone}
                                onChange={(e) => setEditedPhone(e.target.value)}
                                className="h-6 text-xs w-32"
                                placeholder="(XX) XXXXX-XXXX"
                                onClick={(e) => e.stopPropagation()}
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateAttendeePhone.mutate({ attendeeId: p.id, phone: editedPhone }, {
                                    onSuccess: () => setEditingPhoneId(null)
                                  });
                                }}
                                disabled={updateAttendeePhone.isPending}
                              >
                                <Check className="h-3 w-3 text-green-600" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingPhoneId(null);
                                }}
                              >
                                <X className="h-3 w-3 text-muted-foreground" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <span className="text-xs text-muted-foreground">{p.phone || 'Sem telefone'}</span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditedPhone(p.phone || '');
                                  setEditingPhoneId(p.id);
                                }}
                              >
                                <Pencil className="h-3 w-3 text-muted-foreground" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {/* Botão Transferir - apenas para admins/managers/coordenadores */}
                      {canTransfer && p.id && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedParticipantId(p.id!);
                            setShowMoveModal(true);
                          }}
                          title="Transferir participante"
                        >
                          <ArrowRightLeft className="h-4 w-4 text-purple-600" />
                        </Button>
                      )}
                      {p.phone && videoConferenceLink && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSendLinkViaWhatsApp(p.phone!, p.name);
                          }}
                        >
                          <MessageCircle className="h-4 w-4 text-green-600" />
                        </Button>
                      )}
                      {participants.length > 1 && p.id && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveAttendee(p.id!);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Add Partner Button - Only show if participant is selected and is NOT already a partner */}
              {isPending && selectedParticipant && !selectedParticipant.isPartner && participants.length < 6 && (
                <>
                  {!showAddPartner ? (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full"
                      onClick={() => setShowAddPartner(true)}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Adicionar Sócio de {selectedParticipant.name.split(' ')[0]}
                    </Button>
                  ) : (
                    <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                      <p className="text-xs text-muted-foreground">
                        Adicionando sócio vinculado a: <strong>{selectedParticipant.name}</strong>
                      </p>
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
                </>
              )}
              
              <p className="text-xs text-muted-foreground text-center">
                Clique em um participante para ver suas informações e notas específicas
              </p>
            </div>

            <Separator />

            {/* SDR Info Section - Based on Selected Participant */}
            {selectedParticipant && selectedParticipant.bookedByProfile && (
              <>
                <div className="bg-blue-500/10 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <UserCircle className="h-4 w-4 text-blue-600" />
                      <span className="font-medium text-sm text-blue-700 dark:text-blue-400">
                        SDR que Agendou {selectedParticipant.name.split(' ')[0]}
                      </span>
                    </div>
                    {selectedParticipant.isPartner && (
                      <Badge variant="outline" className="text-xs">Sócio</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedParticipant.bookedByProfile.full_name || 'Não informado'}</span>
                  </div>
                  {selectedParticipant.bookedByProfile.email && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">{selectedParticipant.bookedByProfile.email}</span>
                    </div>
                  )}
                  
                  {/* All Notes Section - unified view including scheduling notes */}
                  <div className="pt-2 border-t border-blue-500/20">
                    <AttendeeNotesSection
                      attendeeId={selectedParticipant.id}
                      dealId={selectedParticipant.dealId}
                      participantName={selectedParticipant.name}
                      canAddNotes={true}
                    />
                  </div>

                  {/* Notas do SDR sobre o lead (do deal) - show for participants linked to main contact */}
                  {sdrNotes && sdrNotes.length > 0 && (
                    <div className="pt-2 border-t border-blue-500/20">
                      <div className="flex items-center gap-2 mb-2">
                        <StickyNote className="h-4 w-4 text-blue-600" />
                        <span className="text-xs font-medium text-blue-700 dark:text-blue-400">
                          Notas do SDR sobre o Lead ({sdrNotes.length})
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
                {isPending && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 ml-auto"
                    onClick={() => onReschedule(activeMeeting)}
                  >
                    <Pencil className="h-3 w-3 text-muted-foreground hover:text-primary" />
                  </Button>
                )}
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

            {/* Quick Actions - Per Participant - ALWAYS VISIBLE */}
            {selectedParticipant && (
              <>
                <Separator />
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-sm text-muted-foreground">
                      Alterar status de: {selectedParticipant.name.split(' ')[0]}
                    </h4>
                    <Badge className={cn(
                      'text-xs',
                      STATUS_LABELS[selectedParticipant.status || 'scheduled']?.color || 'bg-muted',
                      'text-white'
                    )}>
                      {STATUS_LABELS[selectedParticipant.status || 'scheduled']?.label || 'Agendada'}
                    </Badge>
                  </div>
                  
                  {/* Status Flow Buttons - Bidirectional */}
                  <div className="grid grid-cols-2 gap-2">
                    {/* Agendada/Voltar */}
                    {selectedParticipant.status !== 'scheduled' && selectedParticipant.status !== 'contract_paid' && (
                      <Button
                        variant="outline"
                        size="sm"
                        className={cn(
                          "flex-col h-14 gap-1",
                          selectedParticipant.status === 'scheduled' 
                            ? "bg-primary/10 border-primary text-primary" 
                            : "text-muted-foreground hover:text-primary hover:bg-primary/5"
                        )}
                        onClick={() => handleParticipantStatusChange(selectedParticipant.id, 'scheduled')}
                        disabled={updateAttendeeAndSlotStatus.isPending || selectedParticipant.status === 'scheduled'}
                      >
                        <Calendar className="h-4 w-4" />
                        <span className="text-xs">Voltar p/ Agendada</span>
                      </Button>
                    )}
                    
                    {/* No-Show */}
                    {selectedParticipant.status !== 'contract_paid' && (
                      <Button
                        variant="outline"
                        size="sm"
                        className={cn(
                          "flex-col h-14 gap-1",
                          selectedParticipant.status === 'no_show' 
                            ? "bg-red-500/10 border-red-500 text-red-600" 
                            : "text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50 dark:hover:bg-yellow-950/20"
                        )}
                        onClick={() => selectedParticipant.status !== 'no_show' && setShowNoShowConfirm(true)}
                        disabled={updateAttendeeAndSlotStatus.isPending || selectedParticipant.status === 'no_show'}
                      >
                        <AlertTriangle className="h-4 w-4" />
                        <span className="text-xs">{selectedParticipant.status === 'no_show' ? 'No-Show ✓' : 'No-Show'}</span>
                      </Button>
                    )}
                    
                    {/* Realizada */}
                    {selectedParticipant.status !== 'contract_paid' && (
                      <Button
                        variant="outline"
                        size="sm"
                        className={cn(
                          "flex-col h-14 gap-1",
                          selectedParticipant.status === 'completed' 
                            ? "bg-green-500/10 border-green-500 text-green-600" 
                            : "text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950/20"
                        )}
                        onClick={handleCompleted}
                        disabled={updateAttendeeAndSlotStatus.isPending || selectedParticipant.status === 'completed'}
                      >
                        <CheckCircle className="h-4 w-4" />
                        <span className="text-xs">{selectedParticipant.status === 'completed' ? 'Realizada ✓' : 'Realizada'}</span>
                      </Button>
                    )}
                    
                    {/* Badge Contrato Pago (somente exibição - marcado via automação) */}
                    {selectedParticipant.status === 'contract_paid' && (
                      <div className="flex-col h-14 gap-1 px-3 flex items-center justify-center bg-emerald-500/10 border border-emerald-500 text-emerald-600 rounded-md">
                        <DollarSign className="h-4 w-4" />
                        <span className="text-xs font-medium">Contrato Pago ✓</span>
                      </div>
                    )}
                    
                    {/* Mover para outra reunião */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-col h-14 gap-1 text-purple-600 hover:text-purple-700 hover:bg-purple-50 dark:hover:bg-purple-950/20"
                      onClick={() => setShowMoveModal(true)}
                    >
                      <ArrowRightLeft className="h-4 w-4" />
                      <span className="text-xs">Mover</span>
                    </Button>
                    
                    {/* Vincular Contrato - Show for completed status without contract_paid */}
                    {selectedParticipant.status === 'completed' && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-col h-14 gap-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                        onClick={() => setShowLinkContractDialog(true)}
                      >
                        <Link2 className="h-4 w-4" />
                        <span className="text-xs">Vincular Contrato</span>
                      </Button>
                    )}
                  </div>
                </div>
              </>
            )}



            {/* Closer Notes - Per Participant */}
            {selectedParticipant && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h4 className="font-medium text-sm text-muted-foreground">
                    Notas da Closer para: {selectedParticipant.name.split(' ')[0]}
                  </h4>
                  <Textarea
                    value={closerNotes}
                    onChange={(e) => setCloserNotes(e.target.value)}
                    placeholder={`Escreva suas observações sobre ${selectedParticipant.name.split(' ')[0]}...`}
                    rows={4}
                  />
                  <Button 
                    size="sm" 
                    onClick={handleSaveCloserNotes}
                    disabled={
                      updateNotes.isPending || 
                      updateAttendeeNotes.isPending || 
                      closerNotes === (selectedParticipant.closerNotes || '')
                    }
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Salvar Notas
                  </Button>
                </div>
              </>
            )}

            {/* Movement History Section */}
            {selectedParticipant && (
              <>
                <Separator />
                <MovementHistorySection attendeeId={selectedParticipant.id} />
              </>
            )}

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
                      <li>O SDR <strong>{selectedParticipant?.bookedByProfile?.full_name || 'responsável'}</strong> será alertado</li>
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

            {/* Delete button - Only visible for coordenador and above */}
            {(isPending || activeMeeting.status === 'no_show') && canDeleteMeeting && (
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

            {/* Reschedule Entire Meeting Button */}
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/20"
              onClick={() => onReschedule(activeMeeting)}
            >
              <Calendar className="h-4 w-4 mr-2" />
              Reagendar Reunião Inteira
            </Button>

            {/* View Deal Button */}
            {meeting.deal_id && (
              <Button variant="secondary" className="w-full" onClick={handleViewDeal}>
                <ExternalLink className="h-4 w-4 mr-2" />
                Ver Negócio Completo
              </Button>
            )}
          </div>
        </ScrollArea>

        {/* Move Attendee Modal */}
        <MoveAttendeeModal
          attendee={selectedParticipant ? {
            id: selectedParticipant.id,
            name: selectedParticipant.name,
            isPartner: selectedParticipant.isPartner,
          } : null}
          currentMeetingId={activeMeeting?.id || null}
          currentMeetingDate={activeMeeting?.scheduled_at ? new Date(activeMeeting.scheduled_at) : undefined}
          currentAttendeeStatus={selectedParticipant?.status}
          currentCloserId={activeMeeting?.closer?.id}
          currentCloserName={activeMeeting?.closer?.name}
          open={showMoveModal}
          onOpenChange={setShowMoveModal}
        />
      </SheetContent>

      {/* R2 Scheduling Prompt Dialog */}
      <Dialog open={showR2PromptDialog} onOpenChange={setShowR2PromptDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-600">
              <CheckCircle className="h-5 w-5" />
              Contrato Pago Registrado!
            </DialogTitle>
            <DialogDescription className="pt-2">
              O lead <strong>{contractPaidParticipant?.name}</strong> teve o contrato marcado como pago.
              <br /><br />
              Deseja agendar a reunião R2 agora?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button 
              variant="outline" 
              onClick={() => setShowR2PromptDialog(false)}
            >
              Depois
            </Button>
            <Button 
              className="bg-purple-600 hover:bg-purple-700"
              onClick={() => {
                setShowR2PromptDialog(false);
                onOpenChange(false);
                navigate('/crm/agenda-r2');
              }}
            >
              <Calendar className="h-4 w-4 mr-2" />
              Agendar R2 Agora
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Link Contract Dialog */}
      {selectedParticipant && (
        <LinkContractDialog
          open={showLinkContractDialog}
          onOpenChange={setShowLinkContractDialog}
          attendeeId={selectedParticipant.id}
          attendeeName={selectedParticipant.name}
          dealId={selectedParticipant.dealId}
        />
      )}
    </Sheet>
  );
}
