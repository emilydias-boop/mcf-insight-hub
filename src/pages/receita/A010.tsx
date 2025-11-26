import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KPICard } from "@/components/ui/KPICard";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useA010Sales, useA010Summary } from "@/hooks/useA010Sales";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { DollarSign, TrendingUp, Users, Search, Download, Upload } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function A010() {
  const [period, setPeriod] = useState<'semana' | 'mes' | 'all'>('mes');
  const [search, setSearch] = useState('');
  
  const { data: sales, isLoading: salesLoading } = useA010Sales({ period, search, limit: 200 });
  const { data: summary, isLoading: summaryLoading } = useA010Summary({ period });

  const handleExport = () => {
    if (!sales || sales.length === 0) return;

    const headers = ['Data', 'Nome', 'Email', 'Telefone', 'Valor'];
    const rows = sales.map(sale => [
      formatDate(sale.sale_date),
      sale.customer_name,
      sale.customer_email || '',
      sale.customer_phone || '',
      sale.net_value.toString()
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `a010-vendas-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6">
      {/* Controles */}
      <div className="flex items-center justify-between gap-4">
        <Select value={period} onValueChange={(v) => setPeriod(v as any)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="semana">Esta Semana</SelectItem>
            <SelectItem value="mes">Este Mês</SelectItem>
            <SelectItem value="all">Todos</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, email ou telefone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button asChild variant="outline">
            <Link to="/importar-a010">
              <Upload className="h-4 w-4 mr-2" />
              Importar Dados
            </Link>
          </Button>
          <Button variant="outline" size="icon" onClick={handleExport} disabled={!sales || sales.length === 0}>
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-3">
        {summaryLoading ? (
          <>
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </>
        ) : (
          <>
            <KPICard
              title="Total de Vendas"
              value={summary?.totalSales.toString() || '0'}
              icon={Users}
              variant="success"
            />
            <KPICard
              title="Receita Total"
              value={formatCurrency(summary?.totalRevenue || 0)}
              icon={DollarSign}
              variant="success"
            />
            <KPICard
              title="Ticket Médio"
              value={formatCurrency(summary?.averageTicket || 0)}
              icon={TrendingUp}
              variant="neutral"
            />
          </>
        )}
      </div>

      {/* Gráfico de Evolução */}
      {!summaryLoading && summary && summary.chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Evolução de Vendas</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={summary.chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="date" 
                  stroke="hsl(var(--muted-foreground))"
                  tickFormatter={(value) => new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                />
                <YAxis stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  formatter={(value: any) => [formatCurrency(value), 'Receita']}
                  labelFormatter={(label) => formatDate(label)}
                />
                <Line 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--primary))' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Tabela de Transações */}
      <Card>
        <CardHeader>
          <CardTitle>Transações de Cursos</CardTitle>
        </CardHeader>
        <CardContent>
          {salesLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : sales && sales.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sales.map((sale) => (
                    <TableRow key={sale.id}>
                      <TableCell>{formatDate(sale.sale_date)}</TableCell>
                      <TableCell className="font-medium">{sale.customer_name}</TableCell>
                      <TableCell className="text-muted-foreground">{sale.customer_email || '-'}</TableCell>
                      <TableCell className="text-muted-foreground">{sale.customer_phone || '-'}</TableCell>
                      <TableCell className="text-right font-semibold text-success">
                        {formatCurrency(sale.net_value)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma transação encontrada para o período selecionado.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
