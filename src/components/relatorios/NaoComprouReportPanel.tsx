import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePickerCustom } from '@/components/ui/DatePickerCustom';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Download, ChevronDown, ChevronRight, Phone, FileText, Loader2 } from 'lucide-react';
import { DateRange } from 'react-day-picker';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNaoComprouReport, NaoComprouLead } from '@/hooks/useNaoComprouReport';
import { BusinessUnit } from '@/hooks/useMyBU';
import { loadXLSX } from '@/lib/lazyExport';

interface NaoComprouReportPanelProps {
  bu: BusinessUnit;
}

const ESTIMADO_TIP = 'Sem status final marcado pelo closer; R2 realizada e nenhuma compra de parceria em até 30 dias';

export function NaoComprouReportPanel({ bu }: NaoComprouReportPanelProps) {
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const now = new Date();
    return { from: startOfMonth(now), to: endOfMonth(now) };
  });
  const [closerR2Id, setCloserR2Id] = useState<string>('all');

  const from = dateRange?.from ?? startOfMonth(new Date());
  const to = dateRange?.to ?? dateRange?.from ?? endOfMonth(new Date());

  const { data, isLoading } = useNaoComprouReport({ from, to, bu: bu as string });
  const resumo = data?.resumo;

  const closers = useMemo(() => {
    const m = new Map<string, string>();
    (data?.rows || []).forEach(r => {
      if (r.closer_r2_id) m.set(r.closer_r2_id, r.closer_r2_name || r.closer_r2_id);
    });
    return [...m.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [data?.rows]);

  const leads = useMemo(() => {
    const all = data?.leads || [];
    return closerR2Id === 'all' ? all : all.filter(l => l.closer_r2_id === closerR2Id);
  }, [data?.leads, closerR2Id]);

  const formatDate = (d: string | null) => (d ? format(new Date(d), 'dd/MM/yyyy', { locale: ptBR }) : '-');
  const formatDateTime = (d: string | null) => (d ? format(new Date(d), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : '-');

  const handleExportExcel = async () => {
    if (leads.length === 0) return;
    const rows = leads.map(l => ({
      'Nome': l.lead_name || '-',
      'Telefone': l.phone || '-',
      'Email': l.email || '-',
      'Closer R1': l.closer_r1_name || '-',
      'Data R1': formatDate(l.r1_at),
      'Closer R2': l.closer_r2_name || '-',
      'Data R2': formatDate(l.r2_at),
      'Status': l.status_final || '-',
      'Ligações pós-R2': l.tentativas_pos_r2,
      'Última ligação': formatDateTime(l.ultima_tentativa),
      'Estimado (sim/não)': l.estimado ? 'sim' : 'não',
    }));
    const XLSX = await loadXLSX();
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Não Comprou');
    XLSX.writeFile(wb, `nao-comprou-${format(from, 'yyyy-MM-dd')}_${format(to, 'yyyy-MM-dd')}.xlsx`);
  };

  return (
    <TooltipProvider>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Leads que Não Compraram
              </CardTitle>
              <CardDescription>Leads com R2 realizada que não compraram parceria em até 30 dias</CardDescription>
            </div>
            <Badge variant="secondary" className="text-lg px-3 py-1">{leads.length} leads</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="R2 realizadas" value={resumo?.total} />
            <Stat label="Compraram" value={resumo?.comprou} />
            <Stat label="Não compraram" value={resumo?.naoComprou} sub={resumo ? `${resumo.naoComprouEstimados} estimados` : undefined} />
            <Stat label="Outros" value={resumo?.outros} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground">Período (data da R2)</label>
              <DatePickerCustom
                mode="range"
                selected={dateRange}
                onSelect={(d) => { if (d && (d as DateRange).from) setDateRange(d as DateRange); }}
                placeholder="Selecione o período"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground">Closer R2</label>
              <Select value={closerR2Id} onValueChange={setCloserR2Id}>
                <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {closers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={handleExportExcel} disabled={leads.length === 0} className="w-full">
                <Download className="h-4 w-4 mr-2" />
                Exportar Excel
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : leads.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Nenhum lead "Não Comprou" encontrado para os filtros selecionados.
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead></TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Closer R1</TableHead>
                    <TableHead>Data R1</TableHead>
                    <TableHead>Closer R2</TableHead>
                    <TableHead>Data R2</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-center">Ligações pós-R2</TableHead>
                    <TableHead>Última ligação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leads.map(l => (
                    <NaoComprouRow key={l.attendee_id} lead={l} formatDate={formatDate} formatDateTime={formatDateTime} />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}

function Stat({ label, value, sub }: { label: string; value?: number; sub?: string }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold">{value ?? '-'}</p>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

function NaoComprouRow({
  lead,
  formatDate,
  formatDateTime,
}: {
  lead: NaoComprouLead;
  formatDate: (d: string | null) => string;
  formatDateTime: (d: string | null) => string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen} asChild>
      <>
        <TableRow className="cursor-pointer hover:bg-muted/50" onClick={() => setOpen(!open)}>
          <TableCell className="w-8">{open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</TableCell>
          <TableCell className="font-medium">{lead.lead_name || '-'}</TableCell>
          <TableCell>{lead.phone || '-'}</TableCell>
          <TableCell className="max-w-[180px] truncate">{lead.email || '-'}</TableCell>
          <TableCell>{lead.closer_r1_name || '-'}</TableCell>
          <TableCell>{formatDate(lead.r1_at)}</TableCell>
          <TableCell>{lead.closer_r2_name || '-'}</TableCell>
          <TableCell>{formatDate(lead.r2_at)}</TableCell>
          <TableCell>
            <div className="flex flex-wrap gap-1">
              {lead.estimado && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="secondary">Estimado</Badge>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">{ESTIMADO_TIP}</TooltipContent>
                </Tooltip>
              )}
              {lead.status_final === 'Aprovado' && (
                <Badge className="bg-green-600 hover:bg-green-600 text-primary-foreground">Aprovado</Badge>
              )}
              {!lead.estimado && lead.status_final && lead.status_final !== 'Aprovado' && (
                <span className="text-sm">{lead.status_final}</span>
              )}
            </div>
          </TableCell>
          <TableCell className="text-center">
            <Badge variant={lead.tentativas_pos_r2 > 0 ? 'default' : 'secondary'}>
              <Phone className="h-3 w-3 mr-1" />
              {lead.tentativas_pos_r2}
            </Badge>
          </TableCell>
          <TableCell>{formatDateTime(lead.ultima_tentativa)}</TableCell>
        </TableRow>
        <CollapsibleContent asChild>
          <TableRow className="bg-muted/30">
            <TableCell colSpan={11} className="p-4">
              <div className="grid grid-cols-1 gap-4 text-sm">
                <div>
                  <p className="font-medium text-muted-foreground mb-1">Notas do Closer</p>
                  <p className="whitespace-pre-wrap">{lead.closer_notes || '-'}</p>
                </div>
                <div>
                  <p className="font-medium text-muted-foreground mb-1">Observações R2</p>
                  <p className="whitespace-pre-wrap">{lead.r2_observations || '-'}</p>
                </div>
              </div>
            </TableCell>
          </TableRow>
        </CollapsibleContent>
      </>
    </Collapsible>
  );
}
