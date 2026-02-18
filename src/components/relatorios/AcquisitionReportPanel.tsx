import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePickerCustom } from '@/components/ui/DatePickerCustom';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileSpreadsheet, DollarSign, ShoppingCart, TrendingUp, Loader2, Search } from 'lucide-react';
import { format } from 'date-fns';
import { DateRange } from 'react-day-picker';
import { startOfMonth, endOfMonth } from 'date-fns';
import { formatCurrency } from '@/lib/formatters';
import { BusinessUnit } from '@/hooks/useMyBU';
import { useAcquisitionReport, DimensionRow } from '@/hooks/useAcquisitionReport';
import * as XLSX from 'xlsx';

interface AcquisitionReportPanelProps {
  bu: BusinessUnit;
}

export function AcquisitionReportPanel({ bu }: AcquisitionReportPanelProps) {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSource, setSelectedSource] = useState('all');
  const [selectedCloser, setSelectedCloser] = useState('all');
  const [selectedChannel, setSelectedChannel] = useState('all');
  const [selectedOrigin, setSelectedOrigin] = useState('all');

  const {
    kpis, byCloser, bySDR, byChannel, byOutside, byOrigin,
    closers, classified, isLoading,
  } = useAcquisitionReport(dateRange);

  // Apply local filters on classified data to recalculate if needed
  // For simplicity the main hook already processes all; filters here are on the aggregated views
  const filteredByCloser = useMemo(() => {
    if (selectedCloser === 'all') return byCloser;
    return byCloser.filter(r => {
      const closer = closers.find(c => c.id === selectedCloser);
      return closer && r.label === closer.name;
    });
  }, [byCloser, selectedCloser, closers]);

  const filteredByChannel = useMemo(() => {
    if (selectedChannel === 'all') return byChannel;
    return byChannel.filter(r => r.label === selectedChannel.toUpperCase());
  }, [byChannel, selectedChannel]);

  const filteredByOrigin = useMemo(() => {
    if (selectedOrigin === 'all') return byOrigin;
    return byOrigin.filter(r => r.label === selectedOrigin);
  }, [byOrigin, selectedOrigin]);

  // Unique origin labels for filter
  const originLabels = useMemo(() => byOrigin.map(r => r.label), [byOrigin]);

  // Export Excel with multiple sheets
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();

    const toSheet = (rows: DimensionRow[], extraCols?: string[]) => {
      return rows.map(r => {
        const base: Record<string, unknown> = {
          'Dimensão': r.label,
          'Transações': r.transactions,
          'Fat. Bruto': r.grossRevenue,
          'Receita Líq.': r.netRevenue,
          'Ticket Médio': r.avgTicket,
          '% Total': `${r.pctTotal.toFixed(1)}%`,
        };
        if (r.outsideCount !== undefined) {
          base['Qtde Outside'] = r.outsideCount;
          base['Fat. Outside'] = r.outsideRevenue;
        }
        return base;
      });
    };

    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(toSheet(byCloser)), 'Por Closer');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(toSheet(bySDR)), 'Por SDR');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(toSheet(byChannel)), 'Por Canal');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
      byOutside.map(r => ({ Closer: r.label, 'Qtde Outside': r.outsideCount, 'Fat. Outside': r.outsideRevenue }))
    ), 'Outside');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(toSheet(byOrigin)), 'Por Origem');

    XLSX.writeFile(wb, `aquisicao_origem_${bu}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Carregando dados de aquisição...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[180px]">
              <label className="text-sm font-medium text-muted-foreground mb-2 block">Período</label>
              <DatePickerCustom
                mode="range"
                selected={dateRange}
                onSelect={(range) => range && setDateRange(range as DateRange)}
                placeholder="Selecione o período"
              />
            </div>
            <div className="w-[200px]">
              <label className="text-sm font-medium text-muted-foreground mb-2 block">Buscar</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Nome, email ou telefone..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9" />
              </div>
            </div>
            <div className="w-[120px]">
              <label className="text-sm font-medium text-muted-foreground mb-2 block">Fonte</label>
              <Select value={selectedSource} onValueChange={setSelectedSource}>
                <SelectTrigger><SelectValue placeholder="Fonte" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="hubla">Hubla</SelectItem>
                  <SelectItem value="make">Make</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-[160px]">
              <label className="text-sm font-medium text-muted-foreground mb-2 block">Closer</label>
              <Select value={selectedCloser} onValueChange={setSelectedCloser}>
                <SelectTrigger><SelectValue placeholder="Closer" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {closers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="w-[120px]">
              <label className="text-sm font-medium text-muted-foreground mb-2 block">Canal</label>
              <Select value={selectedChannel} onValueChange={setSelectedChannel}>
                <SelectTrigger><SelectValue placeholder="Canal" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="a010">A010</SelectItem>
                  <SelectItem value="bio">BIO</SelectItem>
                  <SelectItem value="live">LIVE</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-[160px]">
              <label className="text-sm font-medium text-muted-foreground mb-2 block">Origem</label>
              <Select value={selectedOrigin} onValueChange={setSelectedOrigin}>
                <SelectTrigger><SelectValue placeholder="Origem" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {originLabels.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleExportExcel} disabled={classified.length === 0}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Excel
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPICard icon={ShoppingCart} label="Total Transações" value={String(kpis.totalTransactions)} color="primary" />
        <KPICard icon={DollarSign} label="Faturamento Bruto" value={formatCurrency(kpis.totalGross)} color="success" />
        <KPICard icon={DollarSign} label="Receita Líquida" value={formatCurrency(kpis.totalNet)} color="warning" />
        <KPICard icon={TrendingUp} label="Ticket Médio" value={formatCurrency(kpis.avgTicket)} color="muted" isMuted />
      </div>

      {/* Faturamento por Closer */}
      <DimensionTable
        title="Faturamento por Closer"
        rows={filteredByCloser}
        showOutside
      />

      {/* Faturamento por SDR */}
      <DimensionTable title="Faturamento por SDR" rows={bySDR} />

      {/* Faturamento por Canal */}
      <DimensionTable title="Faturamento por Canal" rows={filteredByChannel} />

      {/* Faturamento Outside */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Faturamento Outside</CardTitle></CardHeader>
        <CardContent>
          {byOutside.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma venda outside no período</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Closer</TableHead>
                  <TableHead className="text-right">Qtde Outside</TableHead>
                  <TableHead className="text-right">Fat. Outside</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byOutside.map(r => (
                  <TableRow key={r.label}>
                    <TableCell className="font-medium">{r.label}</TableCell>
                    <TableCell className="text-right">{r.outsideCount}</TableCell>
                    <TableCell className="text-right">{formatCurrency(r.outsideRevenue || 0)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Faturamento por Origem/Produto */}
      <DimensionTable title="Faturamento por Origem/Produto" rows={filteredByOrigin} />
    </div>
  );
}

// ---- Sub-components ----

function KPICard({ icon: Icon, label, value, color, isMuted }: {
  icon: React.ElementType; label: string; value: string; color: string; isMuted?: boolean;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-full ${isMuted ? 'bg-muted' : `bg-${color}/10`}`}>
            <Icon className={`h-6 w-6 ${isMuted ? 'text-muted-foreground' : `text-${color}`}`} />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DimensionTable({ title, rows, showOutside }: {
  title: string; rows: DimensionRow[]; showOutside?: boolean;
}) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-lg">{title}</CardTitle></CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Sem dados no período</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{title.replace('Faturamento por ', '')}</TableHead>
                <TableHead className="text-right">Transações</TableHead>
                <TableHead className="text-right">Fat. Bruto</TableHead>
                <TableHead className="text-right">Receita Líq.</TableHead>
                <TableHead className="text-right">Ticket Médio</TableHead>
                <TableHead className="text-right">% Total</TableHead>
                {showOutside && <TableHead className="text-right">Qtde Outside</TableHead>}
                {showOutside && <TableHead className="text-right">Fat. Outside</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(r => (
                <TableRow key={r.label}>
                  <TableCell className="font-medium">{r.label}</TableCell>
                  <TableCell className="text-right">{r.transactions}</TableCell>
                  <TableCell className="text-right">{formatCurrency(r.grossRevenue)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(r.netRevenue)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(r.avgTicket)}</TableCell>
                  <TableCell className="text-right">{r.pctTotal.toFixed(1)}%</TableCell>
                  {showOutside && <TableCell className="text-right">{r.outsideCount ?? 0}</TableCell>}
                  {showOutside && <TableCell className="text-right">{formatCurrency(r.outsideRevenue ?? 0)}</TableCell>}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
