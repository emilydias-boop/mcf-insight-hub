import { useState, useMemo } from 'react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';
import { FileSpreadsheet, Filter, BarChart3, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { DatePickerCustom } from '@/components/ui/DatePickerCustom';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';

import { useR2QualificationReport, useR2Closers, R2QualificationReportRow } from '@/hooks/useR2QualificationReport';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

const COLORS = ['#8B5CF6', '#EC4899', '#10B981', '#F59E0B', '#3B82F6', '#6366F1', '#14B8A6', '#F97316', '#06B6D4', '#84CC16'];

function groupBy<T>(arr: T[], key: keyof T): Record<string, number> {
  return arr.reduce((acc, item) => {
    const value = String(item[key] || 'Não informado');
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}

function toChartData(grouped: Record<string, number>): { name: string; value: number }[] {
  return Object.entries(grouped)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);
}

const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Agendada',
  completed: 'Realizada',
  no_show: 'No-show',
  rescheduled: 'Reagendada',
  contract_paid: 'Contrato Pago',
  canceled: 'Cancelada',
  refunded: 'Reembolso',
};

export function R2QualificationReportPanel() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  const [closerFilter, setCloserFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const { data: closers = [] } = useR2Closers();
  const { data = [], isLoading, isFetching, dataUpdatedAt } = useR2QualificationReport({
    startDate: dateRange?.from || startOfMonth(new Date()),
    endDate: dateRange?.to || endOfMonth(new Date()),
    closerId: closerFilter !== 'all' ? closerFilter : undefined,
    status: statusFilter !== 'all' ? statusFilter : undefined,
  });

  // Aggregations for charts
  const estadoStats = useMemo(() => toChartData(groupBy(data, 'estado')), [data]);
  const rendaStats = useMemo(() => toChartData(groupBy(data, 'renda')), [data]);
  const profissaoStats = useMemo(() => toChartData(groupBy(data, 'profissao')), [data]);
  const jaConstruiStats = useMemo(() => toChartData(groupBy(data, 'jaConstroi')), [data]);
  const terrenoStats = useMemo(() => toChartData(groupBy(data, 'terreno')), [data]);

  // Summary stats
  const totalLeads = data.length;
  const completedCount = data.filter((r) => r.status === 'completed' || r.status === 'contract_paid').length;
  const noShowCount = data.filter((r) => r.status === 'no_show').length;
  const conversionRate = totalLeads > 0 ? ((completedCount / totalLeads) * 100).toFixed(1) : '0';

  // Export to Excel
  const handleExport = () => {
    const ws = XLSX.utils.json_to_sheet(
      data.map((row) => ({
        Nome: row.leadName,
        Telefone: row.phone,
        Email: row.email,
        'Data Reunião': format(new Date(row.scheduledAt), 'dd/MM/yyyy'),
        Horário: format(new Date(row.scheduledAt), 'HH:mm'),
        Status: STATUS_LABELS[row.status] || row.status,
        'Sócio R2': row.closerName,
        'SDR Responsável': row.sdrName,
        Estado: row.estado,
        Profissão: row.profissao,
        Renda: row.renda,
        Idade: row.idade,
        'Já Constrói': row.jaConstroi,
        'Tem Terreno': row.terreno,
        'Tem Imóvel': row.imovel,
        'Conhece MCF': row.tempoMcf,
        'Tem Sócio': row.temSocio === true ? 'Sim' : row.temSocio === false ? 'Não' : '',
        'Nome Sócio': row.nomeSocio,
      }))
    );

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Qualificação R2');
    XLSX.writeFile(wb, `qualificacao_r2_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium mb-2 block">Período</label>
              <DatePickerCustom
                mode="range"
                selected={dateRange}
                onSelect={(value) => setDateRange(value as DateRange)}
                placeholder="Selecione o período"
              />
            </div>

            <div className="min-w-[180px]">
              <label className="text-sm font-medium mb-2 block">Sócio R2</label>
              <Select value={closerFilter} onValueChange={setCloserFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filtrar closer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {closers.map((closer) => (
                    <SelectItem key={closer.id} value={closer.id}>
                      {closer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="min-w-[150px]">
              <label className="text-sm font-medium mb-2 block">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="scheduled">Agendadas</SelectItem>
                  <SelectItem value="completed">Realizadas</SelectItem>
                  <SelectItem value="no_show">No-show</SelectItem>
                  <SelectItem value="contract_paid">Contrato Pago</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {isFetching && !isLoading && (
                  <Loader2 className="h-3 w-3 animate-spin" />
                )}
                <span>
                  Atualizado: {format(new Date(dataUpdatedAt), 'HH:mm:ss', { locale: ptBR })}
                </span>
              </div>
              <Button onClick={handleExport} disabled={data.length === 0}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Exportar Excel
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{totalLeads}</div>
            <div className="text-sm text-muted-foreground">Total de Leads</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">{completedCount}</div>
            <div className="text-sm text-muted-foreground">Realizadas</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-red-600">{noShowCount}</div>
            <div className="text-sm text-muted-foreground">No-shows</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-purple-600">{conversionRate}%</div>
            <div className="text-sm text-muted-foreground">Taxa Conversão</div>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-[300px] w-full" />
          <Skeleton className="h-[400px] w-full" />
        </div>
      ) : (
        <>
          {/* Distribution Charts */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Por Estado */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Por Estado</CardTitle>
              </CardHeader>
              <CardContent>
                {estadoStats.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={estadoStats}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={70}
                        paddingAngle={2}
                        dataKey="value"
                        label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                        labelLine={false}
                      >
                        {estadoStats.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                    Sem dados
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Por Renda */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Por Renda</CardTitle>
              </CardHeader>
              <CardContent>
                {rendaStats.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={rendaStats} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="value" fill="#8B5CF6" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                    Sem dados
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Por Profissão */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Por Profissão</CardTitle>
              </CardHeader>
              <CardContent>
                {profissaoStats.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={profissaoStats} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="value" fill="#EC4899" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                    Sem dados
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Additional Charts Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Já Constrói */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Já Constrói?</CardTitle>
              </CardHeader>
              <CardContent>
                {jaConstruiStats.length > 0 ? (
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie
                        data={jaConstruiStats}
                        cx="50%"
                        cy="50%"
                        outerRadius={60}
                        dataKey="value"
                        label={({ name, value }) => `${name}: ${value}`}
                      >
                        {jaConstruiStats.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[180px] flex items-center justify-center text-muted-foreground">
                    Sem dados
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Tem Terreno */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Tem Terreno?</CardTitle>
              </CardHeader>
              <CardContent>
                {terrenoStats.length > 0 ? (
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie
                        data={terrenoStats}
                        cx="50%"
                        cy="50%"
                        outerRadius={60}
                        dataKey="value"
                        label={({ name, value }) => `${name}: ${value}`}
                      >
                        {terrenoStats.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[180px] flex items-center justify-center text-muted-foreground">
                    Sem dados
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Detailed Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Dados Detalhados ({data.length} registros)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Sócio R2</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Renda</TableHead>
                      <TableHead>Profissão</TableHead>
                      <TableHead>Já Constrói</TableHead>
                      <TableHead>Terreno</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                          Nenhum dado encontrado para o período selecionado.
                        </TableCell>
                      </TableRow>
                    ) : (
                      data.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="font-medium">{row.leadName || '-'}</TableCell>
                          <TableCell>
                            {format(new Date(row.scheduledAt), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={
                                row.status === 'completed'
                                  ? 'bg-green-500/10 text-green-600 border-green-500/20'
                                  : row.status === 'no_show'
                                    ? 'bg-red-500/10 text-red-600 border-red-500/20'
                                    : row.status === 'contract_paid'
                                      ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                                      : 'bg-purple-500/10 text-purple-600 border-purple-500/20'
                              }
                            >
                              {STATUS_LABELS[row.status] || row.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{row.closerName || '-'}</TableCell>
                          <TableCell>{row.estado || '-'}</TableCell>
                          <TableCell>{row.renda || '-'}</TableCell>
                          <TableCell>{row.profissao || '-'}</TableCell>
                          <TableCell>{row.jaConstroi || '-'}</TableCell>
                          <TableCell>{row.terreno || '-'}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
