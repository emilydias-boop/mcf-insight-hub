import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useFinanceiroReceitas } from '@/hooks/useFinanceiroReceitas';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { ReceitaFilters, PRODUCT_CATEGORIES, SOURCE_OPTIONS } from '@/types/financeiro';
import { Download, Filter, X, Calendar } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, subMonths, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';

const today = new Date();

export const FinanceiroReceitas = () => {
  const [filters, setFilters] = useState<ReceitaFilters>({
    dataInicial: startOfMonth(today),
    dataFinal: endOfMonth(today),
  });

  const { data, isLoading } = useFinanceiroReceitas(filters);

  const handleExportCSV = () => {
    if (!data?.receitas) return;

    const headers = ['Data', 'Produto', 'Categoria', 'Cliente', 'Email', 'Origem', 'Valor Bruto', 'Valor Líquido', 'Status'];
    const rows = data.receitas.map((r) => [
      r.sale_date,
      r.product_name,
      r.product_category || '',
      r.customer_name || '',
      r.customer_email || '',
      r.source || '',
      r.product_price || 0,
      r.net_value || 0,
      r.sale_status || '',
    ]);

    const csvContent = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `receitas-${format(filters.dataInicial, 'yyyy-MM-dd')}-${format(filters.dataFinal, 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  const handlePeriodShortcut = (shortcut: string) => {
    const now = new Date();
    switch (shortcut) {
      case 'today':
        setFilters({ ...filters, dataInicial: now, dataFinal: now });
        break;
      case 'week':
        setFilters({ ...filters, dataInicial: startOfWeek(now, { locale: ptBR }), dataFinal: endOfWeek(now, { locale: ptBR }) });
        break;
      case 'month':
        setFilters({ ...filters, dataInicial: startOfMonth(now), dataFinal: endOfMonth(now) });
        break;
      case 'lastMonth':
        const lastMonth = subMonths(now, 1);
        setFilters({ ...filters, dataInicial: startOfMonth(lastMonth), dataFinal: endOfMonth(lastMonth) });
        break;
    }
  };

  const handleClearFilters = () => {
    setFilters({
      dataInicial: startOfMonth(today),
      dataFinal: endOfMonth(today),
    });
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="justify-start text-left font-normal">
                  <Calendar className="mr-2 h-4 w-4" />
                  {format(filters.dataInicial, 'dd/MM/yyyy')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <CalendarComponent
                  mode="single"
                  selected={filters.dataInicial}
                  onSelect={(date) => date && setFilters({ ...filters, dataInicial: date })}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="justify-start text-left font-normal">
                  <Calendar className="mr-2 h-4 w-4" />
                  {format(filters.dataFinal, 'dd/MM/yyyy')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <CalendarComponent
                  mode="single"
                  selected={filters.dataFinal}
                  onSelect={(date) => date && setFilters({ ...filters, dataFinal: date })}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            <Select
              value={filters.produto || 'all'}
              onValueChange={(v) => setFilters({ ...filters, produto: v === 'all' ? undefined : v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Produto" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os produtos</SelectItem>
                {PRODUCT_CATEGORIES.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.origem || 'all'}
              onValueChange={(v) => setFilters({ ...filters, origem: v === 'all' ? undefined : v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Origem" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as origens</SelectItem>
                {SOURCE_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-wrap gap-2 mt-4">
            <Button variant="outline" size="sm" onClick={() => handlePeriodShortcut('today')}>
              Hoje
            </Button>
            <Button variant="outline" size="sm" onClick={() => handlePeriodShortcut('week')}>
              Esta semana
            </Button>
            <Button variant="outline" size="sm" onClick={() => handlePeriodShortcut('month')}>
              Este mês
            </Button>
            <Button variant="outline" size="sm" onClick={() => handlePeriodShortcut('lastMonth')}>
              Mês passado
            </Button>
            <div className="flex-1" />
            <Button variant="outline" size="sm" onClick={handleClearFilters}>
              <X className="h-4 w-4 mr-1" />
              Limpar
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportCSV}>
              <Download className="h-4 w-4 mr-1" />
              Exportar CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Faturamento Bruto</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <p className="text-2xl font-bold">{formatCurrency(data?.summary.faturamentoBruto || 0)}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Faturamento Líquido</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <p className="text-2xl font-bold text-green-500">{formatCurrency(data?.summary.faturamentoLiquido || 0)}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Nº de Vendas</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <p className="text-2xl font-bold">{data?.summary.numeroContratos || 0}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ticket Médio</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <p className="text-2xl font-bold">{formatCurrency(data?.summary.ticketMedio || 0)}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Evolução de Receitas</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-[300px] w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data?.chartData || []}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" className="text-xs" />
                <YAxis
                  tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                  className="text-xs"
                />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  labelFormatter={(label) => `Data: ${label}`}
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="bruto"
                  name="Bruto"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="liquido"
                  name="Líquido"
                  stroke="hsl(var(--chart-2))"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead className="text-right">Valor Bruto</TableHead>
                <TableHead className="text-right">Valor Líquido</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : data?.receitas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Nenhuma receita encontrada para o período.
                  </TableCell>
                </TableRow>
              ) : (
                data?.receitas.slice(0, 50).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{formatDate(r.sale_date)}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium truncate max-w-[200px]" title={r.product_name}>
                          {r.product_name}
                        </p>
                        {r.product_category && (
                          <p className="text-xs text-muted-foreground">{r.product_category}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="truncate max-w-[150px]" title={r.customer_name || undefined}>
                          {r.customer_name || '-'}
                        </p>
                        {r.customer_email && (
                          <p className="text-xs text-muted-foreground truncate max-w-[150px]">
                            {r.customer_email}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {r.source || '-'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(r.product_price || 0)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-green-500">
                      {formatCurrency(r.net_value || 0)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={r.sale_status === 'completed' ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {r.sale_status === 'completed' ? 'Paga' : r.sale_status || '-'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {data && data.receitas.length > 50 && (
            <div className="p-4 text-center text-muted-foreground text-sm">
              Mostrando 50 de {data.receitas.length} registros. Exporte o CSV para ver todos.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
