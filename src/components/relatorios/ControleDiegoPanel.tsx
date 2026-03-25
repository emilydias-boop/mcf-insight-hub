import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePickerCustom } from '@/components/ui/DatePickerCustom';
import { Badge } from '@/components/ui/badge';
import { Video, Loader2, Search, CheckCircle2, Clock, MessageCircle, FileText, GripVertical } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';
import { useAuth } from '@/contexts/AuthContext';
import { useGestorClosers } from '@/hooks/useGestorClosers';
import { useContractReport, getDefaultContractReportFilters, ContractReportFilters } from '@/hooks/useContractReport';
import { useVideoControlBatch, useToggleVideoSent } from '@/hooks/useVideoControl';
import { BusinessUnit } from '@/hooks/useMyBU';
import { ControleDiegoDrawer } from './ControleDiegoDrawer';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { cn } from '@/lib/utils';

interface ControleDiegoPanelProps {
  bu?: BusinessUnit;
}

function formatWhatsAppUrl(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  const number = digits.startsWith('55') ? digits : `55${digits}`;
  return `https://wa.me/${number}`;
}

interface KanbanRow {
  id: string;
  closerName: string;
  leadName: string;
  leadPhone: string;
  leadEmail: string;
  sdrName: string;
  originName: string;
  currentStage: string;
  date: string;
  salesChannel: string;
  isRefunded: boolean;
  dealId: string | null;
}

export function ControleDiegoPanel({ bu }: ControleDiegoPanelProps) {
  const { role } = useAuth();
  const defaultFilters = getDefaultContractReportFilters();

  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: defaultFilters.startDate,
    to: defaultFilters.endDate,
  });
  const [selectedCloserId, setSelectedCloserId] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState<KanbanRow | null>(null);

  const { data: closers = [], isLoading: loadingClosers } = useGestorClosers('r1');

  const filters: ContractReportFilters = useMemo(() => ({
    startDate: dateRange?.from || defaultFilters.startDate,
    endDate: dateRange?.to || defaultFilters.endDate,
    closerId: selectedCloserId !== 'all' ? selectedCloserId : undefined,
  }), [dateRange, selectedCloserId, defaultFilters]);

  const allowedCloserIds = useMemo(() => {
    if (role === 'admin' || role === 'manager') return null;
    return closers.map(c => c.id);
  }, [role, closers]);

  const { data: agendaData = [], isLoading: loadingAgenda } = useContractReport(filters, allowedCloserIds);

  const rows = useMemo<KanbanRow[]>(() => {
    let filtered = agendaData.map(row => ({
      id: row.id,
      closerName: row.closerName,
      leadName: row.leadName,
      leadPhone: row.leadPhone,
      leadEmail: row.contactEmail || '',
      sdrName: row.sdrName,
      originName: row.originName,
      currentStage: row.currentStage,
      date: row.contractPaidAt || row.meetingDate,
      salesChannel: row.salesChannel.toUpperCase(),
      isRefunded: row.isRefunded,
      dealId: row.dealId || null,
    }));

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      const termDigits = searchTerm.replace(/\D/g, '');
      filtered = filtered.filter(r =>
        r.leadName.toLowerCase().includes(term)
        || r.leadEmail.toLowerCase().includes(term)
        || (termDigits.length >= 4 && r.leadPhone.replace(/\D/g, '').includes(termDigits))
      );
    }

    return filtered.sort((a, b) => b.date.localeCompare(a.date));
  }, [agendaData, searchTerm]);

  const attendeeIds = useMemo(() => rows.map(r => r.id), [rows]);
  const { data: videoMap = {} } = useVideoControlBatch(attendeeIds);
  const toggleMutation = useToggleVideoSent();

  const { pending, sent } = useMemo(() => {
    const p: KanbanRow[] = [];
    const s: KanbanRow[] = [];
    for (const r of rows) {
      if (videoMap[r.id]?.video_sent) s.push(r);
      else p.push(r);
    }
    return { pending: p, sent: s };
  }, [rows, videoMap]);

  const isLoading = loadingClosers || loadingAgenda;

  const handleCardClick = (row: KanbanRow) => {
    setSelectedContract(row);
    setDrawerOpen(true);
  };

  const onDragEnd = (result: DropResult) => {
    if (!result.destination || result.destination.droppableId === result.source.droppableId) return;
    const isSent = result.destination.droppableId === 'enviados';
    const cardId = result.draggableId;
    const card = rows.find(r => r.id === cardId);
    toggleMutation.mutate({
      attendeeId: cardId,
      videoSent: isSent,
      dealId: card?.dealId || undefined,
    });
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="min-w-[200px]">
              <label className="text-sm font-medium text-muted-foreground mb-2 block">Período</label>
              <DatePickerCustom
                mode="range"
                selected={dateRange}
                onSelect={(range) => range && setDateRange(range as DateRange)}
                placeholder="Selecione o período"
              />
            </div>
            <div className="w-[250px]">
              <label className="text-sm font-medium text-muted-foreground mb-2 block">Buscar</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Nome, email ou telefone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="w-[200px]">
              <label className="text-sm font-medium text-muted-foreground mb-2 block">Closer</label>
              <Select value={selectedCloserId} onValueChange={setSelectedCloserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Closers</SelectItem>
                  {closers.map(closer => (
                    <SelectItem key={closer.id} value={closer.id}>{closer.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-primary/10">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Contratos</p>
                <p className="text-3xl font-bold">{rows.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-green-500/10">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Vídeos Enviados</p>
                <p className="text-3xl font-bold">{sent.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-orange-500/10">
                <Clock className="h-6 w-6 text-orange-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pendentes</p>
                <p className="text-3xl font-bold">{pending.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Kanban */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12 text-muted-foreground">
            Nenhum contrato encontrado no período selecionado.
          </CardContent>
        </Card>
      ) : (
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <KanbanColumn
              id="pendentes"
              title="Pendentes"
              count={pending.length}
              items={pending}
              colorClass="border-orange-500/50"
              headerBg="bg-orange-500/10"
              headerText="text-orange-700 dark:text-orange-400"
              icon={<Clock className="h-4 w-4" />}
              videoMap={videoMap}
              onCardClick={handleCardClick}
            />
            <KanbanColumn
              id="enviados"
              title="Enviados"
              count={sent.length}
              items={sent}
              colorClass="border-green-500/50"
              headerBg="bg-green-500/10"
              headerText="text-green-700 dark:text-green-400"
              icon={<CheckCircle2 className="h-4 w-4" />}
              videoMap={videoMap}
              onCardClick={handleCardClick}
            />
          </div>
        </DragDropContext>
      )}

      {/* Drawer */}
      <ControleDiegoDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        contract={selectedContract}
        videoSent={selectedContract ? (videoMap[selectedContract.id]?.video_sent || false) : false}
        videoNotes={selectedContract ? (videoMap[selectedContract.id]?.notes || null) : null}
      />
    </div>
  );
}

interface KanbanColumnProps {
  id: string;
  title: string;
  count: number;
  items: KanbanRow[];
  colorClass: string;
  headerBg: string;
  headerText: string;
  icon: React.ReactNode;
  videoMap: Record<string, any>;
  onCardClick: (row: KanbanRow) => void;
}

function KanbanColumn({ id, title, count, items, colorClass, headerBg, headerText, icon, videoMap, onCardClick }: KanbanColumnProps) {
  return (
    <div className={cn('rounded-lg border-2 bg-muted/20', colorClass)}>
      <div className={cn('flex items-center gap-2 px-4 py-3 rounded-t-lg font-semibold text-sm', headerBg, headerText)}>
        {icon}
        {title}
        <Badge variant="secondary" className="ml-auto text-xs">{count}</Badge>
      </div>
      <Droppable droppableId={id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={cn(
              'p-2 min-h-[200px] max-h-[60vh] overflow-y-auto space-y-2 transition-colors',
              snapshot.isDraggingOver && 'bg-accent/30'
            )}
          >
            {items.map((row, index) => (
              <Draggable key={row.id} draggableId={row.id} index={index}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    className={cn(
                      'rounded-md border bg-card p-3 shadow-sm cursor-pointer hover:shadow-md transition-shadow',
                      snapshot.isDragging && 'shadow-lg ring-2 ring-primary/30'
                    )}
                    onClick={() => onCardClick(row)}
                  >
                    <div className="flex items-start gap-2">
                      <div {...provided.dragHandleProps} className="mt-0.5 text-muted-foreground/50 hover:text-muted-foreground">
                        <GripVertical className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex items-center gap-1.5">
                          <p className="font-medium text-sm truncate">{row.leadName}</p>
                          {row.isRefunded && (
                            <Badge variant="destructive" className="bg-destructive/20 text-destructive border-destructive/30 text-[10px] px-1.5 shrink-0">
                              Reembolsado
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">Closer: {row.closerName}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{row.date ? format(parseISO(row.date), 'dd/MM', { locale: ptBR }) : '-'}</span>
                          <span>·</span>
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{row.salesChannel}</Badge>
                        </div>
                        {row.leadPhone && (
                          <a
                            href={formatWhatsAppUrl(row.leadPhone)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-green-600 hover:text-green-700 text-xs font-mono"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MessageCircle className="h-3 w-3" />
                            {row.leadPhone}
                          </a>
                        )}
                        {videoMap[row.id]?.sent_at && (
                          <p className="text-[10px] text-green-600">
                            ✅ Enviado {format(parseISO(videoMap[row.id].sent_at), 'dd/MM', { locale: ptBR })}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
}
