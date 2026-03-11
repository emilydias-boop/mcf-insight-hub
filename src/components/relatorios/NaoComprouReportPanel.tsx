import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePickerCustom } from '@/components/ui/DatePickerCustom';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Download, ChevronDown, ChevronRight, Phone, FileText, Loader2 } from 'lucide-react';
import { DateRange } from 'react-day-picker';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNaoComprouReport, useNaoComprouClosers, NaoComprouLead } from '@/hooks/useNaoComprouReport';
import { BusinessUnit } from '@/hooks/useMyBU';
import * as XLSX from 'xlsx';

interface NaoComprouReportPanelProps {
  bu: BusinessUnit;
}

export function NaoComprouReportPanel({ bu }: NaoComprouReportPanelProps) {
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [closerR2Id, setCloserR2Id] = useState<string>('all');

  const { data: leads = [], isLoading } = useNaoComprouReport({
    dateRange,
    closerR2Id: closerR2Id === 'all' ? undefined : closerR2Id,
  });

  const { data: closers = [] } = useNaoComprouClosers();

  const formatDate = (d: string | null) => {
    if (!d) return '-';
    return format(new Date(d), 'dd/MM/yyyy', { locale: ptBR });
  };

  const formatDateTime = (d: string | null) => {
    if (!d) return '-';
    return format(new Date(d), 'dd/MM/yyyy HH:mm', { locale: ptBR });
  };

  const handleExportExcel = () => {
    if (leads.length === 0) return;

    const rows = leads.map(lead => ({
      'Nome': lead.contact_name || lead.attendee_name || '-',
      'Telefone': lead.contact_phone || '-',
      'Email': lead.contact_email || '-',
      'Perfil': lead.lead_profile || '-',
      'Closer R1': lead.r1_closer_name || '-',
      'Data R1': formatDate(lead.r1_date),
      'Closer R2': lead.closer_r2_name || '-',
      'Data R2': formatDate(lead.r2_date),
      'Ligações': lead.total_calls,
      'Primeira Ligação': formatDateTime(lead.first_call_at),
      'Última Ligação': formatDateTime(lead.last_call_at),
      'Notas Closer': lead.closer_notes || '-',
      'Observações R2': lead.r2_observations || '-',
      'Data Não Comprou': formatDateTime(lead.carrinho_updated_at),
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Não Comprou');
    XLSX.writeFile(wb, `nao-comprou-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Leads que Não Compraram
            </CardTitle>
            <CardDescription>
              Leads aprovados no carrinho R2 que foram marcados como "Não Comprou"
            </CardDescription>
          </div>
          <Badge variant="secondary" className="text-lg px-3 py-1">
            {leads.length} leads
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-muted-foreground">Período (data de marcação)</label>
            <DatePickerCustom
              mode="range"
              selected={dateRange}
              onSelect={(d) => setDateRange(d as DateRange)}
              placeholder="Todas as datas"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-muted-foreground">Closer R2</label>
            <Select value={closerR2Id} onValueChange={setCloserR2Id}>
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {closers.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
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

        {/* Table */}
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
                  <TableHead className="text-center">Ligações</TableHead>
                  <TableHead>Marcado em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.map(lead => (
                  <NaoComprouRow key={lead.id} lead={lead} formatDate={formatDate} formatDateTime={formatDateTime} />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
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
          <TableCell className="w-8">
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </TableCell>
          <TableCell className="font-medium">{lead.contact_name || lead.attendee_name || '-'}</TableCell>
          <TableCell>{lead.contact_phone || '-'}</TableCell>
          <TableCell className="max-w-[180px] truncate">{lead.contact_email || '-'}</TableCell>
          <TableCell>{lead.r1_closer_name || '-'}</TableCell>
          <TableCell>{formatDate(lead.r1_date)}</TableCell>
          <TableCell>{lead.closer_r2_name || '-'}</TableCell>
          <TableCell>{formatDate(lead.r2_date)}</TableCell>
          <TableCell className="text-center">
            <Badge variant={lead.total_calls > 0 ? 'default' : 'secondary'}>
              <Phone className="h-3 w-3 mr-1" />
              {lead.total_calls}
            </Badge>
          </TableCell>
          <TableCell>{formatDateTime(lead.carrinho_updated_at)}</TableCell>
        </TableRow>
        <CollapsibleContent asChild>
          <TableRow className="bg-muted/30">
            <TableCell colSpan={10} className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="font-medium text-muted-foreground mb-1">Perfil do Lead</p>
                  <p>{lead.lead_profile || '-'}</p>
                </div>
                <div>
                  <p className="font-medium text-muted-foreground mb-1">Primeira Ligação</p>
                  <p>{formatDateTime(lead.first_call_at)}</p>
                </div>
                <div>
                  <p className="font-medium text-muted-foreground mb-1">Última Ligação</p>
                  <p>{formatDateTime(lead.last_call_at)}</p>
                </div>
                <div className="md:col-span-3">
                  <p className="font-medium text-muted-foreground mb-1">Notas do Closer</p>
                  <p className="whitespace-pre-wrap">{lead.closer_notes || '-'}</p>
                </div>
                <div className="md:col-span-3">
                  <p className="font-medium text-muted-foreground mb-1">Observações R2</p>
                  <p className="whitespace-pre-wrap">{lead.r2_observations || '-'}</p>
                </div>
                {lead.attendee_notes.length > 0 && (
                  <div className="md:col-span-3">
                    <p className="font-medium text-muted-foreground mb-1">Notas Adicionais ({lead.attendee_notes.length})</p>
                    <ul className="list-disc list-inside space-y-1">
                      {lead.attendee_notes.map((note, i) => (
                        <li key={i}>{note}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </TableCell>
          </TableRow>
        </CollapsibleContent>
      </>
    </Collapsible>
  );
}
