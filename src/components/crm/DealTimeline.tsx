import { useDealStages } from '@/hooks/useDealStages';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DealTimelineProps {
  currentStage: string;
  completedStages: string[];
}

export const DealTimeline = ({ currentStage, completedStages }: DealTimelineProps) => {
  const { data: stages = [] } = useDealStages();
  
  const visibleStages = stages.filter(s => s.stage_order < 90);
  
  return (
    <div className="py-6">
      <h3 className="text-sm font-semibold mb-4 text-center text-muted-foreground">
        TIMELINE DO NEGÓCIO
      </h3>
      
      <div className="relative">
        <div className="absolute top-8 left-0 right-0 h-0.5 bg-border" />
        
        <div className="flex justify-between items-start relative">
          {visibleStages.map((stage, index) => {
            const isCompleted = completedStages.includes(stage.stage_id);
            const isCurrent = currentStage === stage.stage_id;
            const isFuture = !isCompleted && !isCurrent;
            
            return (
              <div
                key={stage.id}
                className="flex flex-col items-center"
                style={{ flex: 1 }}
              >
                <div
                  className={cn(
                    "w-16 h-16 rounded-full border-4 flex items-center justify-center text-sm font-bold mb-2 z-10",
                    isCompleted && "bg-emerald-500 border-emerald-500 text-white",
                    isCurrent && "bg-primary border-primary text-white ring-4 ring-primary/20",
                    isFuture && "bg-muted border-border text-muted-foreground"
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-6 w-6" />
                  ) : (
                    index + 1
                  )}
                </div>
                
                <div
                  className={cn(
                    "text-xs text-center max-w-[80px]",
                    isCurrent && "font-semibold text-primary",
                    isFuture && "text-muted-foreground"
                  )}
                >
                  {stage.stage_name}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
