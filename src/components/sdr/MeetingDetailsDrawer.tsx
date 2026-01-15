import { format, differenceInHours, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { X, ExternalLink, Clock, Calendar, Target, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Meeting, useDealTimeline } from "@/hooks/useSdrMeetings";
import { MeetingTimeline } from "./MeetingTimeline";
import { MovementHistorySection } from "./MovementHistorySection";

interface MeetingDetailsDrawerProps {
  meeting: (Meeting & { attendee_id?: string }) | null;
  onClose: () => void;
}

const getStageBadgeClass = (classification: string) => {
  switch (classification) {
    case 'agendada':
      return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    case 'realizada':
      return 'bg-green-500/20 text-green-400 border-green-500/30';
    case 'noShow':
      return 'bg-red-500/20 text-red-400 border-red-500/30';
    case 'contratoPago':
      return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
    default:
      return 'bg-neutral-800 text-neutral-400';
  }
};

const formatTime = (hours: number | null): string => {
  if (hours === null) return 'N/A';
  if (hours < 24) return `${hours} horas`;
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  if (remainingHours === 0) return `${days} dias`;
  return `${days}d ${remainingHours}h`;
};

export function MeetingDetailsDrawer({ meeting, onClose }: MeetingDetailsDrawerProps) {
  const { data: timeline, isLoading: timelineLoading } = useDealTimeline(meeting?.dealId || null);
  
  if (!meeting) return null;

  // Find first entry and scheduled dates from timeline
  const firstEntry = timeline?.[0];
  const scheduledEntry = timeline?.find(t => t.stageClassification === 'agendada');
  const contractEntry = timeline?.find(t => t.stageClassification === 'contratoPago');

  return (
    <>
      {/* Overlay with backdrop blur */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 h-full w-[420px] max-w-full bg-[#050608] border-l border-neutral-800 shadow-[0_0_40px_rgba(0,0,0,0.6)] z-50 flex flex-col">
        {/* Sticky Header */}
        <div className="sticky top-0 z-10 bg-[#050608] p-4 pb-4 border-b border-neutral-800">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold text-neutral-100 truncate">
                {meeting.contactName}
              </h2>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <span className="text-xs text-neutral-400">
                  Origem: {meeting.originName}
                </span>
                <span className="text-neutral-600">•</span>
                <Badge 
                  variant="outline"
                  className={getStageBadgeClass(meeting.currentStageClassification)}
                >
                  {meeting.currentStage}
                </Badge>
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onClose}
              autoFocus
              className="text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>
        
        {/* Content with internal scroll */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-4">
            {/* Time Summary */}
            <div>
              <h3 className="text-sm font-medium text-neutral-300 mb-3 flex items-center gap-2">
                <Clock className="h-4 w-4 text-neutral-500" />
                Resumo de Tempos
              </h3>
              <div className="bg-neutral-900/50 rounded-lg p-4 space-y-2 border border-neutral-800/50">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-neutral-400">Entrada no funil:</span>
                  <span className="text-sm text-neutral-100 font-medium">
                    {firstEntry 
                      ? format(new Date(firstEntry.date), "dd/MM/yyyy", { locale: ptBR })
                      : meeting.createdAt 
                        ? format(new Date(meeting.createdAt), "dd/MM/yyyy", { locale: ptBR })
                        : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-neutral-400">Agendado em:</span>
                  <span className="text-sm text-neutral-100 font-medium">
                    {scheduledEntry 
                      ? format(new Date(scheduledEntry.date), "dd/MM/yyyy", { locale: ptBR })
                      : meeting.scheduledDate
                        ? format(new Date(meeting.scheduledDate), "dd/MM/yyyy", { locale: ptBR })
                        : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-neutral-400">Tempo entrada→agendamento:</span>
                  <span className="text-sm text-neutral-100 font-medium">
                    {formatTime(meeting.timeToSchedule)}
                  </span>
                </div>
                <Separator className="my-2 bg-neutral-800" />
                <div className="flex justify-between items-center">
                  <span className="text-xs text-neutral-400">Contrato pago:</span>
                  <span className="text-sm text-neutral-100 font-medium">
                    {contractEntry 
                      ? format(new Date(contractEntry.date), "dd/MM/yyyy", { locale: ptBR })
                      : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-neutral-400">Tempo agendamento→contrato:</span>
                  <span className="text-sm text-neutral-100 font-medium">
                    {formatTime(meeting.timeToContract)}
                  </span>
                </div>
              </div>
            </div>
            
            {/* Timeline */}
            <div>
              <h3 className="text-sm font-medium text-neutral-300 mb-3 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-neutral-500" />
                Caminho no Funil
              </h3>
              <MeetingTimeline timeline={timeline || []} isLoading={timelineLoading} />
            </div>

            {/* Movement History */}
            {meeting.attendee_id && (
              <MovementHistorySection attendeeId={meeting.attendee_id} />
            )}
            
            {/* Probability */}
            <div>
              <h3 className="text-sm font-medium text-neutral-300 mb-3 flex items-center gap-2">
                <Target className="h-4 w-4 text-neutral-500" />
                Probabilidade de Virar Parceiro
              </h3>
              <div className="bg-neutral-900/50 rounded-lg p-4 border border-neutral-800/50">
                <span className="text-2xl font-bold text-neutral-100">
                  {meeting.probability ? `${meeting.probability}%` : 'N/A'}
                </span>
              </div>
            </div>
            
            {/* Contact Info */}
            {(meeting.contactEmail || meeting.contactPhone) && (
              <div>
                <h3 className="text-sm font-medium text-neutral-300 mb-3 flex items-center gap-2">
                  <User className="h-4 w-4 text-neutral-500" />
                  Informações de Contato
                </h3>
                <div className="bg-neutral-900/50 rounded-lg p-4 space-y-1 border border-neutral-800/50">
                  {meeting.contactEmail && (
                    <p className="text-xs text-neutral-400">
                      Email: <span className="text-sm text-neutral-100">{meeting.contactEmail}</span>
                    </p>
                  )}
                  {meeting.contactPhone && (
                    <p className="text-xs text-neutral-400">
                      Telefone: <span className="text-sm text-neutral-100">{meeting.contactPhone}</span>
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Fixed Footer */}
        <div className="p-4 border-t border-neutral-800 bg-[#050608]">
          <Button 
            className="w-full"
            variant="outline"
            onClick={() => window.open(`/crm/negocios?id=${meeting.dealId}`, '_blank')}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Ver no CRM
          </Button>
        </div>
      </div>
    </>
  );
}
