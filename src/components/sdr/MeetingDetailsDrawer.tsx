import { format, differenceInHours, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { X, ExternalLink, Clock, Calendar, Target, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Meeting, useDealTimeline } from "@/hooks/useSdrMeetings";
import { MeetingTimeline } from "./MeetingTimeline";

interface MeetingDetailsDrawerProps {
  meeting: Meeting | null;
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
      return 'bg-muted text-muted-foreground';
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
    <div className="fixed inset-y-0 right-0 w-full max-w-md bg-background border-l border-border shadow-xl z-50 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-foreground truncate">
              {meeting.contactName}
            </h2>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span className="text-sm text-muted-foreground">
                Origem: {meeting.originName}
              </span>
              <span className="text-muted-foreground">•</span>
              <Badge 
                variant="outline"
                className={getStageBadgeClass(meeting.currentStageClassification)}
              >
                {meeting.currentStage}
              </Badge>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>
      
      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {/* Time Summary */}
          <div>
            <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Resumo de Tempos
            </h3>
            <div className="bg-muted/30 rounded-lg p-3 space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Entrada no funil:</span>
                <span className="text-foreground font-medium">
                  {firstEntry 
                    ? format(new Date(firstEntry.date), "dd/MM/yyyy", { locale: ptBR })
                    : meeting.createdAt 
                      ? format(new Date(meeting.createdAt), "dd/MM/yyyy", { locale: ptBR })
                      : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Agendado em:</span>
                <span className="text-foreground font-medium">
                  {scheduledEntry 
                    ? format(new Date(scheduledEntry.date), "dd/MM/yyyy", { locale: ptBR })
                    : meeting.scheduledDate
                      ? format(new Date(meeting.scheduledDate), "dd/MM/yyyy", { locale: ptBR })
                      : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Tempo entrada→agendamento:</span>
                <span className="text-foreground font-medium">
                  {formatTime(meeting.timeToSchedule)}
                </span>
              </div>
              <Separator className="my-2" />
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Contrato pago:</span>
                <span className="text-foreground font-medium">
                  {contractEntry 
                    ? format(new Date(contractEntry.date), "dd/MM/yyyy", { locale: ptBR })
                    : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Tempo agendamento→contrato:</span>
                <span className="text-foreground font-medium">
                  {formatTime(meeting.timeToContract)}
                </span>
              </div>
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
          
          {/* Probability */}
          <div>
            <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
              <Target className="h-4 w-4 text-muted-foreground" />
              Probabilidade de Virar Parceiro
            </h3>
            <div className="bg-muted/30 rounded-lg p-3">
              <span className="text-2xl font-bold text-foreground">
                {meeting.probability ? `${meeting.probability}%` : 'N/A'}
              </span>
            </div>
          </div>
          
          {/* Contact Info */}
          {(meeting.contactEmail || meeting.contactPhone) && (
            <div>
              <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                Informações de Contato
              </h3>
              <div className="bg-muted/30 rounded-lg p-3 space-y-1">
                {meeting.contactEmail && (
                  <p className="text-sm text-muted-foreground">
                    Email: <span className="text-foreground">{meeting.contactEmail}</span>
                  </p>
                )}
                {meeting.contactPhone && (
                  <p className="text-sm text-muted-foreground">
                    Telefone: <span className="text-foreground">{meeting.contactPhone}</span>
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
      
      {/* Footer Actions */}
      <div className="p-4 border-t border-border space-y-2">
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
  );
}
