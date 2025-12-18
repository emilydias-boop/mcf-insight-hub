import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Check, Circle } from "lucide-react";
import { DealTimelineEvent } from "@/hooks/useSdrMeetings";
import { Skeleton } from "@/components/ui/skeleton";

interface MeetingTimelineProps {
  timeline: DealTimelineEvent[];
  isLoading?: boolean;
}

const getStageColor = (classification: string) => {
  switch (classification) {
    case 'agendada':
      return 'text-blue-400 bg-blue-500/20 border-blue-500/50';
    case 'realizada':
      return 'text-green-400 bg-green-500/20 border-green-500/50';
    case 'noShow':
      return 'text-red-400 bg-red-500/20 border-red-500/50';
    case 'contratoPago':
      return 'text-purple-400 bg-purple-500/20 border-purple-500/50';
    default:
      return 'text-muted-foreground bg-muted border-border';
  }
};

export function MeetingTimeline({ timeline, isLoading }: MeetingTimelineProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (timeline.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        Nenhum histórico de estágios encontrado.
      </p>
    );
  }

  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
      
      <div className="space-y-3">
        {timeline.map((event, index) => (
          <div key={event.id} className="relative flex items-start gap-3 pl-10">
            {/* Circle indicator */}
            <div 
              className={`absolute left-2 w-5 h-5 rounded-full border-2 flex items-center justify-center ${getStageColor(event.stageClassification)}`}
            >
              {event.completed && <Check className="h-3 w-3" />}
            </div>
            
            {/* Content */}
            <div className="flex-1 min-w-0 pb-3">
              <p className="font-medium text-foreground text-sm">
                {event.stageName}
              </p>
              <p className="text-xs text-muted-foreground">
                {format(new Date(event.date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
