import React, { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAllClosersEncaixeQueue, EncaixeQueueItem } from '@/hooks/useEncaixeQueue';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Clock, User, Phone, ChevronDown, CalendarPlus, Users } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface CloserInfo {
  id: string;
  name: string;
  color?: string | null;
}

interface EncaixeQueueDropdownProps {
  closers: CloserInfo[];
  selectedDate: Date;
  onScheduleFromQueue: (item: EncaixeQueueItem) => void;
}

const priorityConfig = {
  1: { label: 'Alta', color: 'bg-red-100 text-red-700 border-red-200' },
  2: { label: 'Média', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  3: { label: 'Baixa', color: 'bg-green-100 text-green-700 border-green-200' },
};

interface CloserQueueSectionProps {
  closer: CloserInfo;
  items: EncaixeQueueItem[];
  onScheduleFromQueue: (item: EncaixeQueueItem) => void;
  defaultOpen?: boolean;
}

function CloserQueueSection({ closer, items, onScheduleFromQueue, defaultOpen = false }: CloserQueueSectionProps) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);

  if (items.length === 0) {
    return null;
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex items-center justify-between w-full p-2 px-3 hover:bg-accent transition-colors">
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: closer.color || '#6B7280' }}
          />
          <span className="font-medium text-sm">{closer.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            {items.length}
          </Badge>
          <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </CollapsibleTrigger>
      
      <CollapsibleContent className="px-3 pb-2 space-y-2">
        {items.map((item) => {
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

export function EncaixeQueueDropdown({ closers, selectedDate, onScheduleFromQueue }: EncaixeQueueDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Single hook call for all closers - avoids hooks in loops
  const closerIds = useMemo(() => closers.map(c => c.id), [closers]);
  const { data: allQueueItems = [], isLoading } = useAllClosersEncaixeQueue(closerIds, selectedDate);

  // Group items by closer
  const queueByCloser = useMemo(() => {
    const grouped: Record<string, EncaixeQueueItem[]> = {};
    closers.forEach(c => { grouped[c.id] = []; });
    allQueueItems.forEach(item => {
      if (grouped[item.closer_id]) {
        grouped[item.closer_id].push(item);
      }
    });
    return grouped;
  }, [allQueueItems, closers]);

  const totalCount = allQueueItems.length;

  const handleSchedule = (item: EncaixeQueueItem) => {
    onScheduleFromQueue(item);
    setIsOpen(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="relative gap-2">
          <Users className="h-4 w-4" />
          <span className="hidden sm:inline">Fila de Encaixe</span>
          {totalCount > 0 && (
            <Badge variant="default" className="h-5 px-1.5 text-xs min-w-[20px]">
              {totalCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-3 border-b bg-muted/30">
          <h4 className="font-semibold text-sm flex items-center gap-2">
            <Users className="h-4 w-4" />
            Fila de Encaixe
          </h4>
          <p className="text-xs text-muted-foreground">
            {format(selectedDate, "EEEE, dd 'de' MMMM", { locale: ptBR })}
          </p>
        </div>
        
        {isLoading ? (
          <div className="p-4 space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : totalCount === 0 ? (
          <div className="p-6 text-center">
            <p className="text-sm text-muted-foreground">
              Nenhum lead aguardando encaixe para esta data
            </p>
          </div>
        ) : (
          <ScrollArea className="max-h-[400px]">
            <div className="py-1">
              {closers.map((closer, index) => (
                <CloserQueueSection
                  key={closer.id}
                  closer={closer}
                  items={queueByCloser[closer.id] || []}
                  onScheduleFromQueue={handleSchedule}
                  defaultOpen={index === 0}
                />
              ))}
            </div>
          </ScrollArea>
        )}
      </PopoverContent>
    </Popover>
  );
}
