import { useState, useMemo } from 'react';
import { useLeadFullTimeline, TimelineEvent, TimelineEventType } from '@/hooks/useLeadFullTimeline';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ArrowRightLeft,
  Phone,
  FileText,
  Calendar,
  CheckSquare,
  ShoppingCart,
  Star,
  MessageSquare,
  ChevronDown,
  Filter,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface LeadFullTimelineProps {
  dealId: string;
  dealUuid: string;
  contactEmail?: string | null;
  contactId?: string | null;
}

const EVENT_CONFIG: Record<TimelineEventType, { icon: React.ElementType; color: string; bgColor: string; label: string }> = {
  stage_change: { icon: ArrowRightLeft, color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-100 dark:bg-blue-900/40', label: 'Estágio' },
  call: { icon: Phone, color: 'text-green-600 dark:text-green-400', bgColor: 'bg-green-100 dark:bg-green-900/40', label: 'Ligação' },
  note: { icon: FileText, color: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-100 dark:bg-amber-900/40', label: 'Nota' },
  meeting: { icon: Calendar, color: 'text-purple-600 dark:text-purple-400', bgColor: 'bg-purple-100 dark:bg-purple-900/40', label: 'Reunião' },
  task: { icon: CheckSquare, color: 'text-teal-600 dark:text-teal-400', bgColor: 'bg-teal-100 dark:bg-teal-900/40', label: 'Tarefa' },
  purchase: { icon: ShoppingCart, color: 'text-pink-600 dark:text-pink-400', bgColor: 'bg-pink-100 dark:bg-pink-900/40', label: 'Compra' },
  qualification: { icon: Star, color: 'text-orange-600 dark:text-orange-400', bgColor: 'bg-orange-100 dark:bg-orange-900/40', label: 'Qualificação' },
  closer_note: { icon: MessageSquare, color: 'text-indigo-600 dark:text-indigo-400', bgColor: 'bg-indigo-100 dark:bg-indigo-900/40', label: 'Nota Closer' },
};

const FILTER_OPTIONS: { type: TimelineEventType | 'all'; label: string }[] = [
  { type: 'all', label: 'Todos' },
  { type: 'stage_change', label: 'Estágios' },
  { type: 'call', label: 'Ligações' },
  { type: 'meeting', label: 'Reuniões' },
  { type: 'note', label: 'Notas' },
  { type: 'purchase', label: 'Compras' },
  { type: 'task', label: 'Tarefas' },
  { type: 'qualification', label: 'Qualif.' },
];

function TimelineEventItem({ event }: { event: TimelineEvent }) {
  const [open, setOpen] = useState(false);
  const config = EVENT_CONFIG[event.type];
  const Icon = config.icon;

  const formattedDate = event.date
    ? format(new Date(event.date), "dd/MM/yy 'às' HH:mm", { locale: ptBR })
    : '—';

  const hasDetails = !!(event.description || Object.keys(event.metadata).length > 0);

  return (
    <div className="relative flex gap-3 pb-4 last:pb-0">
      {/* Vertical line */}
      <div className="absolute left-[15px] top-8 bottom-0 w-px bg-border last:hidden" />

      {/* Icon */}
      <div className={cn('relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full', config.bgColor)}>
        <Icon className={cn('h-4 w-4', config.color)} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger className="w-full text-left" disabled={!hasDetails}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-tight truncate">{event.title}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="text-xs text-muted-foreground">{formattedDate}</span>
                  {event.author && (
                    <span className="text-xs text-muted-foreground">• {event.author}</span>
                  )}
                </div>
              </div>
              {hasDetails && (
                <ChevronDown className={cn('h-4 w-4 text-muted-foreground shrink-0 mt-0.5 transition-transform', open && 'rotate-180')} />
              )}
            </div>
          </CollapsibleTrigger>

          {hasDetails && (
            <CollapsibleContent className="mt-1.5">
              <div className="rounded-md border bg-muted/30 p-2.5 text-xs space-y-1.5">
                {event.description && (
                  <p className="text-foreground whitespace-pre-wrap">{event.description}</p>
                )}
                {/* Type-specific metadata badges */}
                <TimelineMetadata event={event} />
              </div>
            </CollapsibleContent>
          )}
        </Collapsible>
      </div>
    </div>
  );
}

function TimelineMetadata({ event }: { event: TimelineEvent }) {
  const meta = event.metadata;

  if (event.type === 'call') {
    return (
      <div className="flex flex-wrap gap-1.5">
        {meta.direction && <Badge variant="outline" className="text-[10px]">{meta.direction === 'outbound' ? '📞 Saída' : '📲 Entrada'}</Badge>}
        {meta.duration && <Badge variant="outline" className="text-[10px]">⏱ {meta.duration}</Badge>}
        {meta.outcome && <Badge variant="outline" className="text-[10px]">{meta.outcome}</Badge>}
        {meta.recording_url && (
          <a href={meta.recording_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary underline">
            🎙 Gravação
          </a>
        )}
      </div>
    );
  }

  if (event.type === 'meeting') {
    const scheduledAt = meta.scheduled_at
      ? format(new Date(meta.scheduled_at), "dd/MM/yy 'às' HH:mm", { locale: ptBR })
      : null;
    return (
      <div className="flex flex-wrap gap-1.5">
        {meta.status && <Badge variant="outline" className="text-[10px]">{meta.status}</Badge>}
        {scheduledAt && <Badge variant="outline" className="text-[10px]">📅 {scheduledAt}</Badge>}
        {meta.closer_name && <Badge variant="outline" className="text-[10px]">👤 {meta.closer_name}</Badge>}
        {meta.google_meet_link && (
          <a href={meta.google_meet_link} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary underline">
            🔗 Meet
          </a>
        )}
      </div>
    );
  }

  if (event.type === 'purchase') {
    return (
      <div className="flex flex-wrap gap-1.5">
        {meta.sale_status && <Badge variant="outline" className="text-[10px]">{meta.sale_status}</Badge>}
        {meta.source && <Badge variant="outline" className="text-[10px]">{meta.source}</Badge>}
        {meta.net_value != null && (
          <Badge variant="outline" className="text-[10px]">
            Líq: R$ {(meta.net_value / 100).toFixed(2)}
          </Badge>
        )}
      </div>
    );
  }

  if (event.type === 'stage_change') {
    return (
      <div className="flex flex-wrap gap-1.5">
        {meta.from_stage && <Badge variant="outline" className="text-[10px]">De: {meta.from_stage}</Badge>}
        {meta.to_stage && <Badge variant="outline" className="text-[10px]">Para: {meta.to_stage}</Badge>}
      </div>
    );
  }

  return null;
}

export function LeadFullTimeline({ dealId, dealUuid, contactEmail, contactId }: LeadFullTimelineProps) {
  const [activeFilter, setActiveFilter] = useState<TimelineEventType | 'all'>('all');
  const { data: events, isLoading } = useLeadFullTimeline({ dealId, dealUuid, contactEmail, contactId });

  const filteredEvents = useMemo(() => {
    if (!events) return [];
    if (activeFilter === 'all') return events;
    return events.filter(e => e.type === activeFilter);
  }, [events, activeFilter]);

  // Count per type for filter badges
  const typeCounts = useMemo(() => {
    if (!events) return {} as Record<string, number>;
    const counts: Record<string, number> = {};
    for (const e of events) {
      counts[e.type] = (counts[e.type] || 0) + 1;
    }
    return counts;
  }, [events]);

  if (isLoading) {
    return (
      <div className="space-y-3 p-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-8 w-8 rounded-full shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!events?.length) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        Nenhum evento encontrado para este lead.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex items-center gap-1.5 flex-wrap px-1">
        <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        {FILTER_OPTIONS.map(opt => {
          const count = opt.type === 'all' ? events.length : (typeCounts[opt.type] || 0);
          if (opt.type !== 'all' && count === 0) return null;
          return (
            <button
              key={opt.type}
              onClick={() => setActiveFilter(opt.type)}
              className={cn(
                'px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors border',
                activeFilter === opt.type
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-muted/50 text-muted-foreground border-transparent hover:bg-muted'
              )}
            >
              {opt.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Timeline */}
      <div className="px-1">
        {filteredEvents.map(event => (
          <TimelineEventItem key={event.id} event={event} />
        ))}
      </div>
    </div>
  );
}
