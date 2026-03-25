import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePickerCustom } from '@/components/ui/DatePickerCustom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Search, CheckCircle2, Clock, MessageCircle, FileText, Download } from 'lucide-react';
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
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ControleDiegoPanelProps {
  bu?: BusinessUnit;
}

function formatWhatsAppUrl(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  const number = digits.startsWith('55') ? digits : `55${digits}`;
  return `https://wa.me/${number}`;
}

export interface KanbanRow {
  id: string;
  closerName: string;
  leadName: string;
  leadPhone: string;
  leadEmail: string;
  sdrName: string;
  originName: string;
  currentStage: string;
  date: string;
  meetingDate: string;
  salesChannel: string;
  isRefunded: boolean;
  dealId: string | null;
  contactId: string | null;
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
  const [selectedSource, setSelectedSource] = useState<string>('todos');
  const [selectedOriginId, setSelectedOriginId] = useState<string>('all');
  const [selectedChannel, setSelectedChannel] = useState<string>('todos');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState<KanbanRow | null>(null);

  const { data: closers = [], isLoading: loadingClosers } = useGestorClosers('r1');

  // Fetch origins for pipeline filter
  const { data: origins = [] } = useQuery({
    queryKey: ['crm-origins-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_origins')
        .select('id, name, display_name')
        .order('name');
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const filters: ContractReportFilters = useMemo(() => ({
    startDate: dateRange?.from || defaultFilters.startDate,
    endDate: dateRange?.to || defaultFilters.endDate,
    closerId: selectedCloserId !== 'all' ? selectedCloserId : undefined,
    originId: selectedOriginId !== 'all' ? selectedOriginId : undefined,
  }), [dateRange, selectedCloserId, selectedOriginId, defaultFilters]);

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
      meetingDate: row.meetingDate,
      salesChannel: row.salesChannel.toUpperCase(),
      isRefunded: row.isRefunded,
      dealId: row.dealId || null,
      contactId: row.contactId || null,
    }));

    // Filter by channel
    if (selectedChannel !== 'todos') {
      filtered = filtered.filter(r => r.salesChannel === selectedChannel.toUpperCase());
    }

    // Filter by search
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
  }, [agendaData, searchTerm, selectedChannel]);

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

    // Filter by source
    if (selectedSource === 'pendentes') return { pending: p, sent: [] };
    if (selectedSource === 'enviados') return { pending: [], sent: s };

    return { pending: p, sent: s };
  }, [rows, videoMap, selectedSource]);

  const isLoading = loadingClosers || loadingAgenda;

  const handleOpenDrawer = (row: KanbanRow) => {
    setSelectedContract(row);
    setDrawerOpen(true);
  };

  const handleMarkSent = (row: KanbanRow, e: React.MouseEvent) => {
    e.stopPropagation();
    toggleMutation.mutate({
      attendeeId: row.id,
      videoSent: true,
      dealId: row.dealId || undefined,
    });
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

  // Export to Excel
  const handleExportExcel = () => {
    const allRows = [...pending, ...sent];
    const data = allRows.map(r => ({
      'Nome do Lead': r.leadName,
      'Closer': r.closerName,
      'SDR': r.sdrName,
      'Pipeline/Origem': r.originName,
      'Canal': r.salesChannel,
      'Data R1': r.meetingDate ? format(parseISO(r.meetingDate), 'dd/MM/yyyy') : '',
      'Data Pagamento': r.date ? format(parseISO(r.date), 'dd/MM/yyyy') : '',
      'Telefone': r.leadPhone,
      'Email': r.leadEmail,
      'Status Vídeo': videoMap[r.id]?.video_sent ? 'Enviado' : 'Pendente',
      'Data Envio': videoMap[r.id]?.sent_at ? format(parseISO(videoMap[r.id].sent_at), 'dd/MM/yyyy HH:mm') : '',
      'Reembolsado': r.isRefunded ? 'Sim' : 'Não',
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Controle Diego');
    
    // Auto-width columns
    const colWidths = Object.keys(data[0] || {}).map(key => ({
      wch: Math.max(key.length, ...data.map(d => String((d as any)[key] || '').length)) + 2
    }));
    ws['!cols'] = colWidths;

    const periodoStr = dateRange?.from && dateRange?.to 
      ? `${format(dateRange.from, 'dd-MM-yyyy')}_${format(dateRange.to, 'dd-MM-yyyy')}`
      : 'periodo';
    XLSX.writeFile(wb, `controle-diego-${periodoStr}.xlsx`);
  };

  // Export to PDF
  const handleExportPDF = () => {
    const allRows = [...pending, ...sent];
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    // Header
    doc.setFontSize(16);
    doc.text('Controle Diego - Relatório de Vídeos', 14, 15);
    doc.setFontSize(10);
    const periodoLabel = dateRange?.from && dateRange?.to
      ? `${format(dateRange.from, 'dd/MM/yyyy')} - ${format(dateRange.to, 'dd/MM/yyyy')}`
      : 'Todos';
    doc.text(`Período: ${periodoLabel}`, 14, 22);
    doc.text(`Total: ${allRows.length} contratos | Enviados: ${sent.length} | Pendentes: ${pending.length}`, 14, 28);
    
    const activeFilters: string[] = [];
    if (selectedCloserId !== 'all') activeFilters.push(`Closer: ${closers.find(c => c.id === selectedCloserId)?.name || selectedCloserId}`);
    if (selectedChannel !== 'todos') activeFilters.push(`Canal: ${selectedChannel}`);
    if (selectedOriginId !== 'all') activeFilters.push(`Pipeline: ${origins.find(o => o.id === selectedOriginId)?.display_name || origins.find(o => o.id === selectedOriginId)?.name || selectedOriginId}`);
    if (activeFilters.length > 0) {
      doc.text(`Filtros: ${activeFilters.join(' | ')}`, 14, 34);
    }

    const tableData = allRows.map(r => [
      r.leadName,
      r.closerName,
      r.sdrName,
      r.originName,
      r.salesChannel,
      r.meetingDate ? format(parseISO(r.meetingDate), 'dd/MM/yy') : '',
      r.date ? format(parseISO(r.date), 'dd/MM/yy') : '',
      r.leadPhone,
      videoMap[r.id]?.video_sent ? 'Enviado' : 'Pendente',
    ]);

    autoTable(doc, {
      startY: activeFilters.length > 0 ? 38 : 32,
      head: [['Lead', 'Closer', 'SDR', 'Origem', 'Canal', 'R1', 'Pgto', 'Telefone', 'Vídeo']],
      body: tableData,
      styles: { fontSize: 7, cellPadding: 1.5 },
      headStyles: { fillColor: [59, 130, 246], textColor: 255, fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 45 },
        7: { cellWidth: 30 },
      },
      didParseCell: (data) => {
        if (data.column.index === 8 && data.section === 'body') {
          const val = data.cell.raw as string;
          if (val === 'Enviado') {
            data.cell.styles.textColor = [22, 163, 74];
            data.cell.styles.fontStyle = 'bold';
          } else {
            data.cell.styles.textColor = [234, 88, 12];
          }
        }
      },
    });

    doc.setFontSize(7);
    doc.text(`Gerado em ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, doc.internal.pageSize.height - 5);

    const periodoStr = dateRange?.from && dateRange?.to
      ? `${format(dateRange.from, 'dd-MM-yyyy')}_${format(dateRange.to, 'dd-MM-yyyy')}`
      : 'periodo';
    doc.save(`controle-diego-${periodoStr}.pdf`);
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
            <div className="w-[220px]">
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
            <div className="w-[160px]">
              <label className="text-sm font-medium text-muted-foreground mb-2 block">Fonte</label>
              <Select value={selectedSource} onValueChange={setSelectedSource}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="pendentes">Pendentes</SelectItem>
                  <SelectItem value="enviados">Enviados</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-[180px]">
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
            <div className="w-[200px]">
              <label className="text-sm font-medium text-muted-foreground mb-2 block">Pipeline</label>
              <Select value={selectedOriginId} onValueChange={setSelectedOriginId}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Origens</SelectItem>
                  {origins.map(origin => (
                    <SelectItem key={origin.id} value={origin.id}>
                      {origin.display_name || origin.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-[140px]">
              <label className="text-sm font-medium text-muted-foreground mb-2 block">Canal</label>
              <Select value={selectedChannel} onValueChange={setSelectedChannel}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="A010">A010</SelectItem>
                  <SelectItem value="BIO">BIO</SelectItem>
                  <SelectItem value="LIVE">LIVE</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 ml-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportExcel}
                disabled={rows.length === 0}
                className="gap-1.5"
              >
                <Download className="h-4 w-4" />
                Excel
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportPDF}
                disabled={rows.length === 0}
                className="gap-1.5"
              >
                <FileText className="h-4 w-4" />
                PDF
              </Button>
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
              onOpenDrawer={handleOpenDrawer}
              onMarkSent={handleMarkSent}
              showMarkSent
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
              onOpenDrawer={handleOpenDrawer}
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
  onOpenDrawer: (row: KanbanRow) => void;
  onMarkSent?: (row: KanbanRow, e: React.MouseEvent) => void;
  showMarkSent?: boolean;
}

function KanbanColumn({ id, title, count, items, colorClass, headerBg, headerText, icon, videoMap, onOpenDrawer, onMarkSent, showMarkSent }: KanbanColumnProps) {
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
                    {...provided.dragHandleProps}
                    className={cn(
                      'rounded-md border bg-card p-3 shadow-sm hover:shadow-md transition-shadow select-none',
                      snapshot.isDragging && 'shadow-lg ring-2 ring-primary/30'
                    )}
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          className="font-medium text-sm truncate text-primary hover:underline cursor-pointer text-left"
                          onClick={(e) => { e.stopPropagation(); onOpenDrawer(row); }}
                          onMouseDown={(e) => e.stopPropagation()}
                        >
                          {row.leadName}
                        </button>
                        {row.isRefunded && (
                          <Badge variant="destructive" className="bg-destructive/20 text-destructive border-destructive/30 text-[10px] px-1.5 shrink-0">
                            Reembolsado
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        Closer: {row.closerName} · SDR: {row.sdrName}
                      </p>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap">
                        {row.meetingDate && (
                          <span>R1: {format(parseISO(row.meetingDate), 'dd/MM', { locale: ptBR })}</span>
                        )}
                        {row.date && (
                          <>
                            <span>·</span>
                            <span>Pgto: {format(parseISO(row.date), 'dd/MM', { locale: ptBR })}</span>
                          </>
                        )}
                        <span>·</span>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{row.salesChannel}</Badge>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        {row.leadPhone ? (
                          <a
                            href={formatWhatsAppUrl(row.leadPhone)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-green-600 hover:text-green-700 text-xs font-mono"
                            onClick={(e) => e.stopPropagation()}
                            onMouseDown={(e) => e.stopPropagation()}
                          >
                            <MessageCircle className="h-3 w-3" />
                            {row.leadPhone}
                          </a>
                        ) : <span />}
                        {showMarkSent && onMarkSent && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 text-[10px] px-2 text-green-700 border-green-300 hover:bg-green-50"
                            onClick={(e) => onMarkSent(row, e)}
                            onMouseDown={(e) => e.stopPropagation()}
                          >
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Enviado
                          </Button>
                        )}
                      </div>
                      {videoMap[row.id]?.sent_at && (
                        <p className="text-[10px] text-green-600">
                          ✅ Enviado {format(parseISO(videoMap[row.id].sent_at), 'dd/MM HH:mm', { locale: ptBR })}
                        </p>
                      )}
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
