import { useState, useMemo } from "react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DateRange } from "react-day-picker";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { CalendarIcon, Download, Search, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useContractLifecycleReport, ContractLifecycleRow } from "@/hooks/useContractLifecycleReport";
import { DealDetailsDrawer } from "./DealDetailsDrawer";

const SITUACAO_OPTIONS = [
  { value: 'all', label: 'Todas' },
  { value: 'completo', label: '✅ Completo' },
  { value: 'aguardando_r2', label: '⏳ Aguardando R2' },
  { value: 'sem_status', label: '⚠️ Sem Status' },
  { value: 'pendente', label: '🔄 Pendente' },
];

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—';
  try {
    return format(new Date(dateStr), 'dd/MM/yy', { locale: ptBR });
  } catch { return '—'; }
}

function formatWeek(dateStr: string | null) {
  if (!dateStr) return '—';
  try {
    return format(new Date(dateStr + 'T00:00:00'), 'dd/MM', { locale: ptBR });
  } catch { return '—'; }
}

function SituacaoBadge({ row }: { row: ContractLifecycleRow }) {
  const colorMap: Record<string, string> = {
    completo: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    aguardando_r2: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    sem_status: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    pendente: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    parado: 'bg-red-500/20 text-red-400 border-red-500/30',
  };
  return (
    <Badge variant="outline" className={cn("text-xs whitespace-nowrap", colorMap[row.situacao] || '')}>
      {row.situacaoLabel}
    </Badge>
  );
}

function R2StatusBadge({ name, color }: { name: string | null; color: string | null }) {
  if (!name) return <span className="text-muted-foreground text-xs">—</span>;
  return (
    <Badge
      variant="outline"
      className="text-xs whitespace-nowrap"
      style={{
        backgroundColor: color ? `${color}20` : undefined,
        color: color || undefined,
        borderColor: color ? `${color}50` : undefined,
      }}
    >
      {name}
    </Badge>
  );
}

function AttendanceStatusLabel({ status }: { status: string | null }) {
  if (!status) return <span className="text-muted-foreground text-xs">—</span>;
  const labels: Record<string, { text: string; className: string }> = {
    invited: { text: 'Agendado', className: 'text-blue-400' },
    scheduled: { text: 'Agendado', className: 'text-blue-400' },
    completed: { text: 'Compareceu', className: 'text-emerald-400' },
    no_show: { text: 'No-show', className: 'text-red-400' },
    contract_paid: { text: 'Contrato Pago', className: 'text-emerald-400' },
  };
  const info = labels[status] || { text: status, className: '' };
  return <span className={cn("text-xs font-medium", info.className)}>{info.text}</span>;
}

function DiasParadoBadge({ dias }: { dias: number | null }) {
  if (dias === null || dias === undefined) return <span className="text-muted-foreground text-xs">—</span>;
  let className = 'text-muted-foreground';
  if (dias > 10) className = 'text-red-400 font-bold';
  else if (dias > 5) className = 'text-amber-400 font-semibold';
  else if (dias > 2) className = 'text-yellow-400';
  return <span className={cn("text-xs", className)}>{dias}d</span>;
}

function formatPhone(phone: string | null) {
  if (!phone) return '—';
  const clean = phone.replace(/\D/g, '');
  if (clean.length === 13) return `+${clean.slice(0,2)} (${clean.slice(2,4)}) ${clean.slice(4,9)}-${clean.slice(9)}`;
  if (clean.length === 11) return `(${clean.slice(0,2)}) ${clean.slice(2,7)}-${clean.slice(7)}`;
  return phone;
}

export function R2ContractLifecyclePanel() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  const [situacaoFilter, setSituacaoFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const filters = useMemo(() => ({
    startDate: dateRange?.from || startOfMonth(new Date()),
    endDate: dateRange?.to || endOfMonth(new Date()),
    situacao: situacaoFilter,
  }), [dateRange, situacaoFilter]);

  const { data: rows, isLoading } = useContractLifecycleReport(filters);

  const filteredRows = useMemo(() => {
    if (!rows) return [];
    if (!searchTerm.trim()) return rows;
    const term = searchTerm.toLowerCase();
    return rows.filter(r =>
      (r.leadName || '').toLowerCase().includes(term) ||
      (r.phone || '').includes(term) ||
      (r.r1CloserName || '').toLowerCase().includes(term) ||
      (r.r2CloserName || '').toLowerCase().includes(term) ||
      (r.sdrName || '').toLowerCase().includes(term)
    );
  }, [rows, searchTerm]);

  // KPIs
  const kpis = useMemo(() => {
    if (!rows) return { total: 0, comR2: 0, semR2: 0, comStatus: 0, semStatus: 0, paradosMais5d: 0 };
    const total = rows.length;
    const comR2 = rows.filter(r => r.hasR2).length;
    const semR2 = rows.filter(r => !r.hasR2).length;
    const comStatus = rows.filter(r => r.r2StatusName).length;
    const semStatus = rows.filter(r => r.hasR2 && !r.r2StatusName).length;
    const paradosMais5d = rows.filter(r => r.diasParado !== null && r.diasParado > 5 && r.situacao !== 'completo').length;
    return { total, comR2, semR2, comStatus, semStatus, paradosMais5d };
  }, [rows]);

  const handleRowClick = (row: ContractLifecycleRow) => {
    if (row.dealId) {
      setSelectedDealId(row.dealId);
      setDrawerOpen(true);
    }
  };

  const handleExportCSV = () => {
    if (!filteredRows.length) return;
    const headers = ['Lead', 'Telefone', 'SDR', 'Contrato Pago', 'Closer R1', 'R1 Data', 'R1 Status', 'R2 Data', 'Closer R2', 'Presença R2', 'R2 Status', 'Carrinho', 'Safra', 'Dias Parado', 'Situação'];
    const csvRows = filteredRows.map(r => [
      r.leadName || '',
      r.phone || '',
      r.sdrName || '',
      formatDate(r.contractPaidAt),
      r.r1CloserName || '',
      formatDate(r.r1Date),
      r.r1Status || '',
      formatDate(r.r2Date),
      r.r2CloserName || '',
      r.r2AttendeeStatus || '',
      r.r2StatusName || '',
      r.carrinhoStatus || '',
      formatWeek(r.carrinhoWeekStart),
      r.diasParado !== null ? `${r.diasParado}d` : '',
      r.situacaoLabel,
    ]);
    const csv = [headers, ...csvRows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contratos-lifecycle-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card className="bg-card border-border">
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-center gap-3">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-[260px] justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "dd/MM/yy", { locale: ptBR })} - {format(dateRange.to, "dd/MM/yy", { locale: ptBR })}
                      </>
                    ) : format(dateRange.from, "dd/MM/yy", { locale: ptBR })
                  ) : "Período"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange?.from}
                  selected={dateRange}
                  onSelect={setDateRange}
                  numberOfMonths={2}
                  locale={ptBR}
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>

            <Select value={situacaoFilter} onValueChange={setSituacaoFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Situação" />
              </SelectTrigger>
              <SelectContent>
                {SITUACAO_OPTIONS.map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar lead, telefone, closer, SDR..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={!filteredRows.length}>
              <Download className="h-4 w-4 mr-1" />
              CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <Card className="bg-card border-border">
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-xs text-muted-foreground">Total Pagos</p>
            <p className="text-2xl font-bold text-foreground">{kpis.total}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-xs text-muted-foreground">Com R2</p>
            <p className="text-2xl font-bold text-emerald-400">{kpis.comR2}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-xs text-muted-foreground">Sem R2</p>
            <p className="text-2xl font-bold text-amber-400">{kpis.semR2}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-xs text-muted-foreground">Com Status</p>
            <p className="text-2xl font-bold text-blue-400">{kpis.comStatus}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-xs text-muted-foreground">Sem Status</p>
            <p className="text-2xl font-bold text-orange-400">{kpis.semStatus}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-xs text-muted-foreground">Parados &gt;5d</p>
            <p className="text-2xl font-bold text-red-400">{kpis.paradosMais5d}</p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card className="bg-card border-border">
        <CardContent className="pt-4 p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              Nenhum contrato pago encontrado no período
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">Lead</TableHead>
                    <TableHead className="whitespace-nowrap">Telefone</TableHead>
                    <TableHead className="whitespace-nowrap">SDR</TableHead>
                    <TableHead className="whitespace-nowrap">Contrato Pago</TableHead>
                    <TableHead className="whitespace-nowrap">Closer R1</TableHead>
                    <TableHead className="whitespace-nowrap">R1 Data</TableHead>
                    <TableHead className="whitespace-nowrap">R1 Status</TableHead>
                    <TableHead className="whitespace-nowrap">R2 Data</TableHead>
                    <TableHead className="whitespace-nowrap">Closer R2</TableHead>
                    <TableHead className="whitespace-nowrap">Presença R2</TableHead>
                    <TableHead className="whitespace-nowrap">R2 Status</TableHead>
                    <TableHead className="whitespace-nowrap">Carrinho</TableHead>
                    <TableHead className="whitespace-nowrap">Safra</TableHead>
                    <TableHead className="whitespace-nowrap">Dias</TableHead>
                    <TableHead className="whitespace-nowrap">Situação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRows.map(row => (
                    <TableRow
                      key={row.id}
                      onClick={() => handleRowClick(row)}
                      className={cn(row.dealId ? "cursor-pointer hover:bg-muted/70" : "")}
                    >
                      <TableCell className="font-medium whitespace-nowrap max-w-[180px] truncate">
                        {row.leadName || '—'}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {formatPhone(row.phone)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs">{row.sdrName || '—'}</TableCell>
                      <TableCell className="whitespace-nowrap text-xs">{formatDate(row.contractPaidAt)}</TableCell>
                      <TableCell className="whitespace-nowrap text-xs">{row.r1CloserName || '—'}</TableCell>
                      <TableCell className="whitespace-nowrap text-xs">{formatDate(row.r1Date)}</TableCell>
                      <TableCell><AttendanceStatusLabel status={row.r1Status} /></TableCell>
                      <TableCell className="whitespace-nowrap text-xs">
                        {row.hasR2 ? formatDate(row.r2Date) : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs">{row.r2CloserName || '—'}</TableCell>
                      <TableCell><AttendanceStatusLabel status={row.r2AttendeeStatus} /></TableCell>
                      <TableCell><R2StatusBadge name={row.r2StatusName} color={row.r2StatusColor} /></TableCell>
                      <TableCell className="text-xs">{row.carrinhoStatus || '—'}</TableCell>
                      <TableCell className="whitespace-nowrap text-xs">{formatWeek(row.carrinhoWeekStart)}</TableCell>
                      <TableCell><DiasParadoBadge dias={row.diasParado} /></TableCell>
                      <TableCell><SituacaoBadge row={row} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Deal Details Drawer */}
      <DealDetailsDrawer
        dealId={selectedDealId}
        open={drawerOpen}
        onOpenChange={(open) => {
          setDrawerOpen(open);
          if (!open) setSelectedDealId(null);
        }}
      />
    </div>
  );
}
