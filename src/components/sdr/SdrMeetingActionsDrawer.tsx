import { useState } from "react";
import { formatMeetingStatus } from "@/utils/formatMeetingStatus";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  X, ExternalLink, Clock, Calendar, Target, User, 
  Check, XCircle, CalendarX, ArrowRightLeft, Loader2 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { MeetingV2 } from "@/hooks/useSdrMetricsV2";
import { MeetingTimeline } from "./MeetingTimeline";
import { MovementHistorySection } from "./MovementHistorySection";
import { useDealTimeline } from "@/hooks/useSdrMeetings";
import { useUpdateAttendeeStatus } from "@/hooks/useAgendaData";
import { MoveAttendeeModal } from "@/components/crm/MoveAttendeeModal";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface SdrMeetingActionsDrawerProps {
  meeting: MeetingV2 | null;
  onClose: () => void;
  onRefresh?: () => void;
}

const getStageBadgeClass = (status: string) => {
  const normalizedStatus = status.toLowerCase();
  if (normalizedStatus.includes('agendada') || normalizedStatus.includes('confirmada')) {
    return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
  }
  if (normalizedStatus.includes('realizada') || normalizedStatus.includes('completed')) {
    return 'bg-green-500/20 text-green-400 border-green-500/30';
  }
  if (normalizedStatus.includes('no-show') || normalizedStatus.includes('no_show') || normalizedStatus.includes('noshow')) {
    return 'bg-red-500/20 text-red-400 border-red-500/30';
  }
  if (normalizedStatus.includes('contrato')) {
    return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
  }
  return 'bg-neutral-800 text-neutral-400';
};

const formatTime = (hours: number | null): string => {
  if (hours === null) return 'N/A';
  if (hours < 24) return `${hours} horas`;
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  if (remainingHours === 0) return `${days} dias`;
  return `${days}d ${remainingHours}h`;
};

export function SdrMeetingActionsDrawer({ meeting, onClose, onRefresh }: SdrMeetingActionsDrawerProps) {
  const [showMoveModal, setShowMoveModal] = useState(false);
  const queryClient = useQueryClient();
  
  const { data: timeline, isLoading: timelineLoading } = useDealTimeline(meeting?.deal_id || null);
  const updateStatus = useUpdateAttendeeStatus();
  
  if (!meeting) return null;

  const hasAttendeeId = !!meeting.attendee_id;
  const currentAttendeeStatus = meeting.attendee_status || 'pending';

  // Find first entry and scheduled dates from timeline
  const firstEntry = timeline?.[0];
  const scheduledEntry = timeline?.find(t => t.stageClassification === 'agendada');
  const contractEntry = timeline?.find(t => t.stageClassification === 'contratoPago');

  const handleStatusChange = async (newStatus: string) => {
    if (!meeting.attendee_id) {
      toast.error('Este lead não possui attendee_id vinculado');
      return;
    }

    try {
      await updateStatus.mutateAsync({
        attendeeId: meeting.attendee_id,
        status: newStatus
      });
      
      // Invalidate SDR queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['sdr-meetings-from-agenda'] });
      queryClient.invalidateQueries({ queryKey: ['sdr-meetings-v2'] });
      queryClient.invalidateQueries({ queryKey: ['sdr-metrics-v2'] });
      
      onRefresh?.();
      toast.success(`Status atualizado para ${newStatus}`);
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  return (
    <>
      {/* Overlay with backdrop blur */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 h-full w-[420px] max-w-full bg-card border-l border-border shadow-xl z-50 flex flex-col">
        {/* Sticky Header */}
        <div className="sticky top-0 z-10 bg-card p-4 pb-4 border-b border-border">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold text-foreground truncate">
                {meeting.contact_name}
              </h2>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <span className="text-xs text-muted-foreground">
                  Origem: {meeting.origin_name || 'Desconhecida'}
                </span>
                <span className="text-muted-foreground/50">•</span>
                <Badge 
                  variant="outline"
                  className={getStageBadgeClass(meeting.status_atual)}
                >
                  {formatMeetingStatus(meeting.status_atual)}
                </Badge>
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onClose}
              autoFocus
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>
        
        {/* Content with internal scroll */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-4">
            
            {/* Quick Actions - Only show if attendee_id exists */}
            {hasAttendeeId && (
              <div>
                <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  Ações Rápidas
                </h3>
                <div className="bg-muted/30 rounded-lg p-4 space-y-3 border border-border">
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="justify-start gap-2 border-green-500/30 text-green-400 hover:bg-green-500/10"
                      onClick={() => handleStatusChange('completed')}
                      disabled={updateStatus.isPending || currentAttendeeStatus === 'completed'}
                    >
                      {updateStatus.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                      Realizada
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      className="justify-start gap-2 border-red-500/30 text-red-400 hover:bg-red-500/10"
                      onClick={() => handleStatusChange('no_show')}
                      disabled={updateStatus.isPending || currentAttendeeStatus === 'no_show'}
                    >
                      {updateStatus.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <XCircle className="h-4 w-4" />
                      )}
                      No-Show
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      className="justify-start gap-2 border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                      onClick={() => handleStatusChange('cancelled')}
                      disabled={updateStatus.isPending || currentAttendeeStatus === 'cancelled'}
                    >
                      {updateStatus.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CalendarX className="h-4 w-4" />
                      )}
                      Cancelar
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      className="justify-start gap-2 border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                      onClick={() => setShowMoveModal(true)}
                      disabled={updateStatus.isPending}
                    >
                      <ArrowRightLeft className="h-4 w-4" />
                      Reagendar
                    </Button>
                  </div>
                  
                  <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t border-border">
                    <span>Status atual:</span>
                    <Badge variant="secondary" className="text-xs">
                      {currentAttendeeStatus}
                    </Badge>
                  </div>
                </div>
              </div>
            )}

            {/* Warning when no attendee_id */}
            {!hasAttendeeId && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
                <p className="text-sm text-amber-400">
                  Este lead foi agendado fora do sistema de agenda interna. 
                  Ações de status não estão disponíveis.
                </p>
              </div>
            )}
            
            {/* Time Summary */}
            <div>
              <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                Resumo de Tempos
              </h3>
              <div className="bg-muted/30 rounded-lg p-4 space-y-2 border border-border">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Entrada no funil:</span>
                  <span className="text-sm text-foreground font-medium">
                    {firstEntry 
                      ? format(new Date(firstEntry.date), "dd/MM/yyyy", { locale: ptBR })
                      : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Agendado em:</span>
                  <span className="text-sm text-foreground font-medium">
                    {meeting.data_agendamento
                      ? format(new Date(meeting.data_agendamento), "dd/MM/yyyy HH:mm", { locale: ptBR })
                      : 'N/A'}
                  </span>
                </div>
                {meeting.scheduled_at && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">Horário reunião:</span>
                    <span className="text-sm text-foreground font-medium">
                      {format(new Date(meeting.scheduled_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                )}
              </div>
            </div>
            
            {/* Timeline */}
            <div>
              <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                Caminho no Funil
              </h3>
              <MeetingTimeline timeline={timeline || []} isLoading={timelineLoading} />
            </div>

            {/* Movement History */}
            {hasAttendeeId && (
              <MovementHistorySection attendeeId={meeting.attendee_id} />
            )}
            
            {/* Probability */}
            <div>
              <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                <Target className="h-4 w-4 text-muted-foreground" />
                Probabilidade de Virar Parceiro
              </h3>
              <div className="bg-muted/30 rounded-lg p-4 border border-border">
                <span className="text-2xl font-bold text-foreground">
                  {meeting.probability ? `${meeting.probability}%` : 'N/A'}
                </span>
              </div>
            </div>
            
            {/* Contact Info */}
            {(meeting.contact_email || meeting.contact_phone) && (
              <div>
                <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  Informações de Contato
                </h3>
                <div className="bg-muted/30 rounded-lg p-4 space-y-1 border border-border">
                  {meeting.contact_email && (
                    <p className="text-xs text-muted-foreground">
                      Email: <span className="text-sm text-foreground">{meeting.contact_email}</span>
                    </p>
                  )}
                  {meeting.contact_phone && (
                    <p className="text-xs text-muted-foreground">
                      Telefone: <span className="text-sm text-foreground">{meeting.contact_phone}</span>
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Fixed Footer */}
        <div className="p-4 border-t border-border bg-card">
          <Button 
            className="w-full"
            variant="outline"
            onClick={() => window.open(`/crm/negocios?id=${meeting.deal_id}`, '_blank')}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Ver no CRM
          </Button>
        </div>
      </div>

      {/* Move Attendee Modal */}
      {hasAttendeeId && meeting.meeting_slot_id && (
        <MoveAttendeeModal
          attendee={{
            id: meeting.attendee_id!,
            name: meeting.contact_name,
            isPartner: false
          }}
          currentMeetingId={meeting.meeting_slot_id}
          currentMeetingDate={meeting.scheduled_at ? new Date(meeting.scheduled_at) : undefined}
          currentAttendeeStatus={meeting.attendee_status || undefined}
          open={showMoveModal}
          onOpenChange={setShowMoveModal}
        />
      )}
    </>
  );
}
