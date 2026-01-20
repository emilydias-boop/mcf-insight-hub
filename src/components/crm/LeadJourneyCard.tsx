import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Users, 
  Phone, 
  Video, 
  CheckCircle2, 
  Clock, 
  XCircle,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  CalendarPlus
} from 'lucide-react';
import { useState } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useLeadJourney, LeadJourneyMeeting } from '@/hooks/useLeadJourney';
import { cn } from '@/lib/utils';

interface LeadJourneyCardProps {
  dealId: string;
  dealCreatedAt?: string;
}

const getStatusConfig = (status: string) => {
  const statusMap: Record<string, { label: string; color: string; icon: React.ElementType }> = {
    scheduled: { label: 'Agendada', color: 'bg-blue-500/10 text-blue-500', icon: Clock },
    confirmed: { label: 'Confirmada', color: 'bg-emerald-500/10 text-emerald-500', icon: CheckCircle2 },
    completed: { label: 'Realizada', color: 'bg-green-500/10 text-green-500', icon: CheckCircle2 },
    done: { label: 'Realizada', color: 'bg-green-500/10 text-green-500', icon: CheckCircle2 },
    no_show: { label: 'No-show', color: 'bg-red-500/10 text-red-500', icon: XCircle },
    cancelled: { label: 'Cancelada', color: 'bg-muted text-muted-foreground', icon: XCircle },
    rescheduled: { label: 'Reagendada', color: 'bg-yellow-500/10 text-yellow-500', icon: Clock },
  };
  
  return statusMap[status] || { label: status, color: 'bg-muted text-muted-foreground', icon: Clock };
};

const MeetingStep = ({ meeting, type }: { meeting: LeadJourneyMeeting; type: 'r1' | 'r2' }) => {
  const [showNotes, setShowNotes] = useState(false);
  const statusConfig = getStatusConfig(meeting.status);
  const StatusIcon = statusConfig.icon;
  
  const hasNotes = meeting.bookingNotes || meeting.closerNotes;
  
  return (
    <div className="relative pl-6 pb-4">
      {/* Linha vertical */}
      <div className="absolute left-[9px] top-6 bottom-0 w-0.5 bg-border" />
      
      {/* Ícone do passo */}
      <div className={cn(
        "absolute left-0 w-5 h-5 rounded-full flex items-center justify-center",
        type === 'r1' ? 'bg-primary' : 'bg-accent'
      )}>
        {type === 'r1' ? (
          <Phone className="h-3 w-3 text-primary-foreground" />
        ) : (
          <Video className="h-3 w-3 text-accent-foreground" />
        )}
      </div>
      
      <div className="space-y-1">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">
              {type === 'r1' ? 'R1' : 'R2'}: {meeting.closer.name}
            </span>
            <Badge variant="secondary" className={cn("text-xs", statusConfig.color)}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {statusConfig.label}
            </Badge>
          </div>
          <span className="text-xs text-muted-foreground">
            {format(new Date(meeting.scheduledAt), "dd/MM 'às' HH:mm", { locale: ptBR })}
          </span>
        </div>
        
        {/* Quem agendou */}
        {meeting.bookedBy && (
          <p className="text-xs text-muted-foreground">
            Agendado por: {meeting.bookedBy.name}
          </p>
        )}
        
        {/* Toggle de notas */}
        {hasNotes && (
          <button 
            onClick={() => setShowNotes(!showNotes)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <MessageSquare className="h-3 w-3" />
            {showNotes ? 'Ocultar notas' : 'Ver notas'}
            {showNotes ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
        )}
        
        {/* Notas expandidas */}
        {showNotes && hasNotes && (
          <div className="mt-2 space-y-2">
            {meeting.bookingNotes && (
              <div className="bg-muted/50 rounded-md p-2">
                <p className="text-xs font-medium text-muted-foreground mb-1">Notas de agendamento:</p>
                <p className="text-xs whitespace-pre-wrap">{meeting.bookingNotes}</p>
              </div>
            )}
            {meeting.closerNotes && (
              <div className="bg-muted/50 rounded-md p-2">
                <p className="text-xs font-medium text-muted-foreground mb-1">Notas do closer:</p>
                <p className="text-xs whitespace-pre-wrap">{meeting.closerNotes}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export const LeadJourneyCard = ({ dealId, dealCreatedAt }: LeadJourneyCardProps) => {
  const [isOpen, setIsOpen] = useState(true);
  const { data: journey, isLoading } = useLeadJourney(dealId);
  
  if (isLoading) {
    return (
      <div className="border rounded-lg p-4 space-y-3">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }
  
  // Não mostrar se não há nenhuma informação relevante (exceto se tiver data de entrada)
  if (!journey || (!dealCreatedAt && !journey.sdr && !journey.r1Meeting && !journey.r2Meeting)) {
    return null;
  }
  
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="border rounded-lg overflow-hidden">
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <span className="font-medium text-sm">Jornada do Lead</span>
            </div>
            {isOpen ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <div className="px-3 pb-3">
            {/* Data de entrada na pipeline */}
            {dealCreatedAt && (
              <div className="relative pl-6 pb-4">
                {/* Linha vertical */}
                <div className="absolute left-[9px] top-6 bottom-0 w-0.5 bg-border" />
                
                {/* Ícone */}
                <div className="absolute left-0 w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center">
                  <CalendarPlus className="h-3 w-3 text-green-500" />
                </div>
                
                <div>
                  <span className="font-medium text-sm">Entrada na Pipeline</span>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(dealCreatedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
              </div>
            )}
            
            {/* SDR */}
            {journey.sdr && (
              <div className="relative pl-6 pb-4">
                {/* Linha vertical */}
                <div className="absolute left-[9px] top-6 bottom-0 w-0.5 bg-border" />
                
                {/* Ícone */}
                <div className="absolute left-0 w-5 h-5 rounded-full bg-secondary flex items-center justify-center">
                  <Users className="h-3 w-3 text-secondary-foreground" />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium text-sm">SDR: {journey.sdr.name}</span>
                    <p className="text-xs text-muted-foreground">{journey.sdr.email}</p>
                  </div>
                </div>
              </div>
            )}
            
            {/* R1 Meeting */}
            {journey.r1Meeting && (
              <MeetingStep meeting={journey.r1Meeting} type="r1" />
            )}
            
            {/* R2 Meeting */}
            {journey.r2Meeting && (
              <MeetingStep meeting={journey.r2Meeting} type="r2" />
            )}
            
            {/* Se não tem SDR nem reuniões */}
            {!journey.sdr && !journey.r1Meeting && !journey.r2Meeting && (
              <p className="text-sm text-muted-foreground text-center py-2">
                Nenhuma informação de jornada disponível
              </p>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};
