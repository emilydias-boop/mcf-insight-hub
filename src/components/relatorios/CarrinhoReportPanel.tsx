import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePickerCustom } from '@/components/ui/DatePickerCustom';
import { Badge } from '@/components/ui/badge';
import { Download, ShoppingCart, Loader2, CalendarCheck, CalendarX, RotateCcw } from 'lucide-react';
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useCarrinhoReport, useCarrinhoClosers } from '@/hooks/useCarrinhoReport';
import { BusinessUnit } from '@/hooks/useMyBU';
import * as XLSX from 'xlsx';

interface CarrinhoReportPanelProps {
  bu: BusinessUnit;
}

export function CarrinhoReportPanel({ bu }: CarrinhoReportPanelProps) {
  const [weekDate, setWeekDate] = useState<Date>(new Date());
  const [closerR2Filter, setCloserR2Filter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const weekStart = startOfWeek(weekDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(weekDate, { weekStartsOn: 1 });

  const { data: allContracts = [], isLoading } = useCarrinhoReport({
    weekStart,
    weekEnd,
  });

  const { data: closers = [] } = useCarrinhoClosers();

  const filteredContracts = useMemo(() => {
    let result = allContracts;
    if (closerR2Filter !== 'all') {
      result = result.filter(c => c.closer_r2 === closerR2Filter);
    }
    if (statusFilter === 'scheduled') {
      result = result.filter(c => c.is_scheduled);
    } else if (statusFilter === 'unscheduled') {
      result = result.filter(c => !c.is_scheduled);
    }
    return result;
  }, [allContracts, closerR2Filter, statusFilter]);

  const stats = useMemo(() => {
    const total = allContracts.length;
    const scheduled = allContracts.filter(c => c.is_scheduled).length;
    const unscheduled = allContracts.filter(c => !c.is_scheduled).length;
    const refunds = allContracts.filter(c => c.is_refund).length;
    return { total, scheduled, unscheduled, refunds };
  }, [allContracts]);

  const uniqueCloserR2Names = useMemo(() => {
    return [...new Set(allContracts.map(c => c.closer_r2).filter(Boolean))] as string[];
  }, [allContracts]);

  const formatDate = (d: string | null) => {
    if (!d) return '-';
    return format(new Date(d), 'dd/MM/yyyy', { locale: ptBR });
  };

  const handleExportExcel = () => {
    if (filteredContracts.length === 0) return;
    const rows = filteredContracts.map(c => ({
      'Nome': c.customer_name || '-',
      'Email': c.customer_email || '-',
      'Telefone': c.customer_phone || '-',
      'Data Compra': formatDate(c.sale_date),
      'Produto': c.product_name || '-',
      'Status': c.is_scheduled ? 'Agendado' : 'Não Agendado',
      'Reembolso': c.is_refund ? 'Sim' : 'Não',
      'Closer R1': c.closer_r1 || '-',
      'Closer R2': c.closer_r2 || '-',
      'SDR': c.sdr_name || '-',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Carrinho');
    XLSX.writeFile(wb, `carrinho-${format(weekStart, 'yyyy-MM-dd')}.xlsx`);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Relatório do Carrinho
            </CardTitle>
            <CardDescription>
              Contratos pagos na semana com informações de agendamento e atribuição
            </CardDescription>
          </div>
          <Badge variant="secondary" className="text-lg px-3 py-1">
            {filteredContracts.length} contratos
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Week selector */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => setWeekDate(d => subWeeks(d, 1))}>
            ← Semana anterior
          </Button>
          <div className="text-sm font-medium px-3 py-1 bg-muted rounded-md">
            {format(weekStart, 'dd/MM', { locale: ptBR })} - {format(weekEnd, 'dd/MM/yyyy', { locale: ptBR })}
          </div>
          <Button variant="outline" size="sm" onClick={() => setWeekDate(d => addWeeks(d, 1))}>
            Próxima semana →
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setWeekDate(new Date())}>
            Hoje
          </Button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total Contratos</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-2xl font-bold text-green-600">{stats.scheduled}</p>
              <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                <CalendarCheck className="h-3 w-3" /> Agendados
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-2xl font-bold text-orange-500">{stats.unscheduled}</p>
              <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                <CalendarX className="h-3 w-3" /> Não Agendados
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-2xl font-bold text-red-500">{stats.refunds}</p>
              <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                <RotateCcw className="h-3 w-3" /> Reembolsos
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-muted-foreground">Closer R2</label>
            <Select value={closerR2Filter} onValueChange={setCloserR2Filter}>
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {uniqueCloserR2Names.map(name => (
                  <SelectItem key={name} value={name}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-muted-foreground">Status</label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="scheduled">Agendados</SelectItem>
                <SelectItem value="unscheduled">Não Agendados</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button onClick={handleExportExcel} disabled={filteredContracts.length === 0} className="w-full">
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
        ) : filteredContracts.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            Nenhum contrato encontrado para a semana selecionada.
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Data Compra</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reembolso</TableHead>
                  <TableHead>Closer R1</TableHead>
                  <TableHead>Closer R2</TableHead>
                  <TableHead>SDR</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredContracts.map(contract => (
                  <TableRow key={contract.id}>
                    <TableCell className="font-medium">{contract.customer_name || '-'}</TableCell>
                    <TableCell className="max-w-[180px] truncate">{contract.customer_email || '-'}</TableCell>
                    <TableCell>{formatDate(contract.sale_date)}</TableCell>
                    <TableCell>
                      <Badge variant={contract.is_scheduled ? 'default' : 'secondary'}>
                        {contract.is_scheduled ? (
                          <><CalendarCheck className="h-3 w-3 mr-1" /> Agendado</>
                        ) : (
                          <><CalendarX className="h-3 w-3 mr-1" /> Não Agendado</>
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {contract.is_refund ? (
                        <Badge variant="destructive">
                          <RotateCcw className="h-3 w-3 mr-1" /> Sim
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">Não</span>
                      )}
                    </TableCell>
                    <TableCell>{contract.closer_r1 || '-'}</TableCell>
                    <TableCell>{contract.closer_r2 || '-'}</TableCell>
                    <TableCell>{contract.sdr_name || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
