import { useState, useMemo } from 'react';
import { useLeadFullTimeline, TimelineEvent, TimelineEventType } from '@/hooks/useLeadFullTimeline';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { format } from 'date-fns';
import { SonaxRecording, TwilioRecording } from './timeline/CallRecording';
import { sonaxRecordingProxy } from '@/lib/sonaxRecording';
import { AISummaryContent, formatAISummary, QualificationContent } from './timeline/NoteContent';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useAddDealNote } from '@/hooks/useNextAction';
import { ptBR } from 'date-fns/locale';
import { formatCurrency } from '@/lib/formatters';
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
  LogIn,
  Tag,
  UserCog,
  Zap,
  Undo2,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface LeadFullTimelineProps {
  dealId: string;
  dealUuid: string;
  contactEmail?: string | null;
  contactId?: string | null;
}

const EVENT_CONFIG: Record<TimelineEventType, { icon: React.ElementType; label: string }> = {
  stage_change: { icon: ArrowRightLeft, label: 'Etapa' }, call: { icon: Phone, label: 'Ligação' },
  note: { icon: FileText, label: 'Nota' }, meeting: { icon: Calendar, label: 'Reunião' },
  ai_summary: { icon: Star, label: 'Resumo IA' }, attendee_note: { icon: MessageSquare, label: 'Nota de reunião' },
  scheduling_note: { icon: Calendar, label: 'Nota de agendamento' },
  task: { icon: CheckSquare, label: 'Próxima ação' }, purchase: { icon: ShoppingCart, label: 'Compra' },
  qualification: { icon: Star, label: 'Qualificação' }, closer_note: { icon: MessageSquare, label: 'Nota Closer' },
  entry: { icon: LogIn, label: 'Entrada' }, tag_change: { icon: Tag, label: 'Tag' },
  owner_change: { icon: UserCog, label: 'Responsável' }, automation: { icon: Zap, label: 'Evento' },
  refund: { icon: Undo2, label: 'Reembolso' },
};

const FILTER_OPTIONS = [
  { key: 'all', label: 'Tudo', types: [] },
  { key: 'call', label: 'Ligações', types: ['call'] },
  { key: 'notes', label: 'Notas e qualificação', types: ['note', 'qualification', 'closer_note', 'ai_summary', 'attendee_note', 'scheduling_note'] },
  { key: 'meeting', label: 'Reuniões', types: ['meeting'] },
  { key: 'stage', label: 'Etapas', types: ['stage_change'] },
  { key: 'owner', label: 'Responsável', types: ['owner_change'] },
  { key: 'purchase', label: 'Compras', types: ['purchase'] },
  { key: 'refund', label: 'Reembolsos', types: ['refund'] },
];

const dateParts = (date: string) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo' }).format(new Date(date));
const timeLabel = (date: string) => new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }).format(new Date(date));
function dayLabel(key: string): string {
  const now = new Date();
  if (key === dateParts(now.toISOString())) return 'Hoje';
  if (key === dateParts(new Date(now.getTime() - 86400000).toISOString())) return 'Ontem';
  const date = new Date(`${key}T12:00:00-03:00`);
  const weekday = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', timeZone: 'America/Sao_Paulo' }).format(date).replace('.', '');
  return `${weekday.charAt(0).toUpperCase() + weekday.slice(1)}, ${key.slice(8, 10)}/${key.slice(5, 7)}`;
}

function TimelineEventItem({ event }: { event: TimelineEvent }) {
  const [open, setOpen] = useState(['note', 'qualification', 'closer_note', 'ai_summary', 'attendee_note', 'scheduling_note'].includes(event.type));
  const config = EVENT_CONFIG[event.type];
  const Icon = event.metadata.contato_icone === 'message' ? MessageSquare
    : event.metadata.contato_icone === 'alert' ? AlertTriangle : config.icon;

  const formattedDate = event.date
    ? timeLabel(event.date)
    : '—';

  const hasDetails = !!(event.description || Object.keys(event.metadata).length > 0);

  return (
    <div className={cn('relative flex gap-3 pb-4 last:pb-0', event.automatic && 'text-muted-foreground')}>
      <span className="w-10 shrink-0 pt-1.5 text-[11px] tabular-nums text-muted-foreground">{formattedDate}</span>
      {/* Vertical line */}
      <div className="absolute left-[67px] top-8 bottom-0 w-px bg-border last:hidden" />

      {/* Icon */}
      <div className={cn('relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full', 'bg-secondary')}>
        <Icon className={cn('h-4 w-4', event.automatic ? 'text-muted-foreground' : 'text-primary')} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger className="w-full text-left" disabled={!hasDetails}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-tight truncate">{event.title}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {event.automatic && <Badge variant="secondary" className="text-[10px]">Automático</Badge>}
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
                {event.metadata.original_type === 'ai_call_summary' && event.metadata.summary ? (
                  <AISummaryContent content={formatAISummary(event.metadata.summary)} />
                ) : event.description ? (
                  <p className="text-foreground whitespace-pre-wrap">{event.description}</p>
                ) : null}
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

  if (event.type === 'qualification') {
    return <QualificationContent answers={meta.answers} channel={meta.channel} whatsappPrintPath={meta.whatsapp_print_url} />;
  }

  if (event.type === 'call') {
    const rawUrl = typeof meta.recording_url === 'string' ? meta.recording_url : null;
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {meta.source === 'sonax' && <Badge variant="outline">Sonax</Badge>}
          {meta.direction && <Badge variant="outline">{meta.direction === 'outbound' ? 'Saída' : 'Entrada'}</Badge>}
          {meta.duration && <Badge variant="outline">{meta.duration}</Badge>}
          {meta.status_label && <Badge variant="outline">{meta.status_label}</Badge>}
          {meta.outcome_label && <Badge variant="outline">{meta.outcome_label}</Badge>}
          {meta.ramal && <Badge variant="outline">Ramal {meta.ramal}</Badge>}
          {meta.sdr_name && <Badge variant="outline">{meta.sdr_name}</Badge>}
        </div>
        {meta.source === 'sonax'
          ? <SonaxRecording recording={sonaxRecordingProxy(rawUrl)} recordingRaw={rawUrl} />
          : <TwilioRecording recordingUrl={rawUrl} />}
      </div>
    );
  }

  if (event.type === 'meeting') {
    const scheduledAt = meta.scheduled_at
      ? format(new Date(meta.scheduled_at), "dd/MM/yy 'às' HH:mm", { locale: ptBR })
      : null;
    const bookedAt = meta.booked_at
      ? format(new Date(meta.booked_at as string), "dd/MM/yy 'às' HH:mm", { locale: ptBR })
      : null;
    return (
      <div className="space-y-2">
        {meta.sdr_notes && <p className="whitespace-pre-wrap"><strong>Nota do SDR: </strong>{meta.sdr_notes}</p>}
        {meta.closer_notes && <p className="whitespace-pre-wrap"><strong>Nota do closer: </strong>{meta.closer_notes}</p>}
        <div className="flex flex-wrap gap-1.5">
        {meta.status && <Badge variant="outline" className="text-[10px]">{meta.status_label || meta.status}</Badge>}
        {scheduledAt && <Badge variant="outline" className="text-[10px]">📅 {scheduledAt}</Badge>}
        {meta.closer_name && <Badge variant="outline" className="text-[10px]">👤 {meta.closer_name}</Badge>}
        {meta.booked_by_name && (
          <Badge variant="outline" className="text-[10px] border-border text-foreground">
            ✍️ Agendado por: {meta.booked_by_name as string}{bookedAt ? ` em ${bookedAt}` : ''}
          </Badge>
        )}
        {meta.google_meet_link && (
          <a href={meta.google_meet_link} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary underline">
            🔗 Meet
          </a>
        )}
        </div>
      </div>
    );
  }

  if (event.type === 'refund') {
    const amount = Number(meta.amount);
    return (
      <div className="space-y-1">
        {meta.amount != null && !isNaN(amount) && (
          <span className="text-sm font-bold text-foreground">
            {amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        )}
      </div>
    );
  }

  if (event.type === 'purchase') {
    return (
      <div className="space-y-1.5">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-bold text-foreground">{formatCurrency(meta.liquido || 0)}</span>
          <span className="text-[10px] text-muted-foreground">líquido</span>
        </div>
        <div className="text-[11px] text-muted-foreground">
          bruto {formatCurrency(meta.bruto || 0)}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {meta.status && <Badge variant="outline" className="text-[10px]">{meta.status}</Badge>}
          {meta.gateway && <Badge variant="outline" className="text-[10px]">{meta.gateway}</Badge>}
          {meta.bu && <Badge variant="outline" className="text-[10px]">{meta.bu}</Badge>}
          {meta.reembolsado && (
            <Badge variant="outline" className="text-[10px] border-border text-foreground">
              reembolsado
            </Badge>
          )}
        </div>
      </div>
    );
  }

  if (event.type === 'stage_change') {
    return (
      <div className="flex flex-wrap gap-1.5">
        {meta.pipeline_name && <Badge variant="secondary" className="text-[10px] font-semibold">{meta.pipeline_name}</Badge>}
        {meta.from_stage && <Badge variant="outline" className="text-[10px]">De: {meta.from_stage}</Badge>}
        {meta.to_stage && <Badge variant="outline" className="text-[10px]">Para: {meta.to_stage}</Badge>}
      </div>
    );
  }

  if (event.type === 'tag_change') {
    const added = (meta.added as string[]) || [];
    const removed = (meta.removed as string[]) || [];
    return (
      <div className="flex flex-wrap gap-1.5">
        {meta.source && <Badge variant="secondary" className="text-[10px] font-semibold">Fonte: {meta.source}</Badge>}
        {added.map(t => (
          <Badge key={`a-${t}`} variant="outline" className="text-[10px] border-border text-foreground">+ {t}</Badge>
        ))}
        {removed.map(t => (
          <Badge key={`r-${t}`} variant="outline" className="text-[10px] border-border text-foreground">− {t}</Badge>
        ))}
      </div>
    );
  }

  return null;
}

export function LeadFullTimeline({ dealId, dealUuid, contactEmail, contactId }: LeadFullTimelineProps) {
  const [activeFilter, setActiveFilter] = useState('all');
  const [showAutomatic, setShowAutomatic] = useState(false);
  const [newNote, setNewNote] = useState('');
  const addNote = useAddDealNote();
  const { data: events = [], isLoading, isError } = useLeadFullTimeline({ dealId, dealUuid, contactEmail, contactId });
  const visibleEvents = useMemo(() => events.filter(e => showAutomatic || !e.automatic), [events, showAutomatic]);
  const automaticCount = events.filter(e => e.automatic).length;
  const counts = FILTER_OPTIONS.map(opt => opt.key === 'all' ? visibleEvents.length : visibleEvents.filter(e => opt.types.includes(e.type)).length);
  const selected = FILTER_OPTIONS.find(o => o.key === activeFilter);
  const filteredEvents = selected && activeFilter !== 'all' ? visibleEvents.filter(e => selected.types.includes(e.type)) : visibleEvents;
  const days = new Map<string, TimelineEvent[]>();
  for (const event of filteredEvents) {
    if (!event.date || Number.isNaN(new Date(event.date).getTime())) continue;
    const key = dateParts(event.date);
    days.set(key, [...(days.get(key) || []), event]);
  }
  const handleAddNote = async () => {
    if (!newNote.trim() || !dealUuid || addNote.isPending) return;
    try {
      await addNote.mutateAsync({ dealId: dealUuid, note: newNote.trim() });
      setNewNote('');
    } catch { /* O hook mantém o texto e apresenta o erro. */ }
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Textarea placeholder="Escreva uma observação... (Ctrl+Enter para enviar)" aria-label="Nova nota"
          value={newNote} onChange={e => setNewNote(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); void handleAddNote(); } }}
          className="min-h-[80px] bg-background resize-none" />
        <Button onClick={handleAddNote} disabled={!newNote.trim() || addNote.isPending} className="w-full">
          <FileText className="h-4 w-4 mr-2" />{addNote.isPending ? 'Salvando...' : 'Adicionar Nota'}
        </Button>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        <Filter className="h-3.5 w-3.5 text-muted-foreground" />
        {FILTER_OPTIONS.map((opt, index) => counts[index] > 0 && (
          <Button key={opt.key} size="sm" variant={activeFilter === opt.key ? 'default' : 'outline'}
            className="h-7 px-2 text-[11px]" onClick={() => setActiveFilter(opt.key)}>{opt.label} ({counts[index]})</Button>
        ))}
      </div>
      {automaticCount > 0 && <Button variant="ghost" size="sm" className="text-xs text-muted-foreground"
        onClick={() => setShowAutomatic(v => !v)}>{showAutomatic ? 'Ocultar' : 'Mostrar'} eventos automáticos ({automaticCount})</Button>}
      {isLoading ? <div className="space-y-3">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        : isError ? <p role="alert" className="text-sm text-destructive">Erro ao carregar atividade.</p>
        : filteredEvents.length === 0 ? <p className="text-sm text-muted-foreground py-6 text-center">Nenhum evento neste filtro.</p>
        : <div className="space-y-4">{[...days].map(([day, dayEvents]) => (
          <section key={day} className="space-y-3">
            <h4 className="text-xs font-semibold text-muted-foreground border-b pb-2">{dayLabel(day)}</h4>
            {dayEvents.map(event => <TimelineEventItem key={event.id} event={event} />)}
          </section>
        ))}</div>}
    </div>
  );
}
