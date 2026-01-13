import React, { useMemo } from 'react';
import { useEncaixeQueue, EncaixeQueueItem } from '@/hooks/useEncaixeQueue';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Clock, User, Phone, ChevronDown, CalendarPlus, Users } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface CloserInfo {
  id: string;
  name: string;
  color?: string | null;
}

interface AgendaEncaixePanelProps {
  closers: CloserInfo[];
  selectedDate: Date;
  onScheduleFromQueue: (item: EncaixeQueueItem) => void;
}

interface CloserQueueSectionProps {
  closer: CloserInfo;
  date: Date;
  onScheduleFromQueue: (item: EncaixeQueueItem) => void;
  defaultOpen?: boolean;
}

const priorityConfig = {
  1: { label: 'Alta', color: 'bg-red-100 text-red-700 border-red-200' },
  2: { label: 'Média', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  3: { label: 'Baixa', color: 'bg-green-100 text-green-700 border-green-200' },
};

function CloserQueueSection({ closer, date, onScheduleFromQueue, defaultOpen = false }: CloserQueueSectionProps) {
  const { data: queueItems = [], isLoading } = useEncaixeQueue(closer.id, date);
  const [isOpen, setIsOpen] = React.useState(defaultOpen);

  // Only show active items (waiting or notified)
  const activeItems = useMemo(() => 
    queueItems.filter(item => item.status === 'waiting' || item.status === 'notified'),
    [queueItems]
  );

  if (isLoading) {
    return (
      <div className="py-2">
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (activeItems.length === 0) {
    return null; // Don't show closers with empty queue
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex items-center justify-between w-full p-2 hover:bg-accent rounded-md transition-colors">
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: closer.color || '#6B7280' }}
          />
          <span className="font-medium text-sm">{closer.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            {activeItems.length}
          </Badge>
          <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </CollapsibleTrigger>
      
      <CollapsibleContent className="pt-2 space-y-2">
        {activeItems.map((item) => {
          const contact = item.deal?.contact;
          const priority = priorityConfig[item.priority as 1 | 2 | 3] || priorityConfig[2];
          
          return (
            <div
              key={item.id}
              className={`p-2.5 rounded-lg border ${priority.color} text-xs`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <User className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    <span className="font-medium truncate">
                      {contact?.name || item.deal?.name || 'Lead'}
                    </span>
                    <Badge variant="outline" className="text-[10px] px-1 py-0">
                      {item.lead_type}
                    </Badge>
                  </div>
                  
                  {contact?.phone && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Phone className="h-2.5 w-2.5" />
                      <span className="truncate">{contact.phone}</span>
                    </div>
                  )}
                  
                  {(item.preferred_time_start || item.preferred_time_end) && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Clock className="h-2.5 w-2.5" />
                      <span>
                        {item.preferred_time_start || '?'} - {item.preferred_time_end || '?'}
                      </span>
                    </div>
                  )}
                </div>
                
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        variant="default"
                        className="h-7 text-xs gap-1 px-2"
                        onClick={() => onScheduleFromQueue(item)}
                      >
                        <CalendarPlus className="h-3 w-3" />
                        Encaixar
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Agendar este lead</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
          );
        })}
      </CollapsibleContent>
    </Collapsible>
  );
}

export function AgendaEncaixePanel({ closers, selectedDate, onScheduleFromQueue }: AgendaEncaixePanelProps) {
  // Get total count across all closers
  const closerQueues = closers.map(closer => {
    const { data: items = [] } = useEncaixeQueue(closer.id, selectedDate);
    return {
      closer,
      count: items.filter(item => item.status === 'waiting' || item.status === 'notified').length,
    };
  });

  const totalCount = closerQueues.reduce((sum, q) => sum + q.count, 0);
  const closersWithQueue = closerQueues.filter(q => q.count > 0);

  if (closersWithQueue.length === 0) {
    return (
      <Card className="h-fit">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="h-4 w-4" />
            Fila de Encaixe
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground text-center py-4">
            Nenhum lead aguardando encaixe para esta data
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-fit">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Fila de Encaixe
          </span>
          <Badge variant="default" className="text-xs">
            {totalCount} aguardando
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 pt-0">
        <ScrollArea className="max-h-[400px]">
          <div className="space-y-1">
            {closers.map((closer, index) => (
              <CloserQueueSection
                key={closer.id}
                closer={closer}
                date={selectedDate}
                onScheduleFromQueue={onScheduleFromQueue}
                defaultOpen={index === 0}
              />
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
