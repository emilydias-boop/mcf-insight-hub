import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { KPICard } from "@/components/ui/KPICard";
import { DollarSign, TrendingUp, Users, BookOpen } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { useCoursesSales, useCoursesSummary } from "@/hooks/useCoursesSales";
import { CourseFilters } from "@/components/courses/CourseFilters";
import { CourseComparison } from "@/components/courses/CourseComparison";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function A010() {
  const [period, setPeriod] = useState<'semana' | 'mes'>('mes');
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [courseType, setCourseType] = useState<'all' | 'a010' | 'construir_para_alugar'>('all');
  const [search, setSearch] = useState("");

  const { data: sales, isLoading: salesLoading } = useCoursesSales({ 
    period, 
    startDate, 
    endDate,
    courseType,
    search 
  });

  const { data: summary, isLoading: summaryLoading } = useCoursesSummary({ 
    period, 
    startDate, 
    endDate,
    courseType
  });

  const handleApply = (filters: { periodo: { tipo: 'semana' | 'mes'; inicio: Date; fim: Date }; curso: string }) => {
    setPeriod(filters.periodo.tipo);
    setStartDate(filters.periodo.inicio);
    setEndDate(filters.periodo.fim);
    setCourseType(filters.curso as 'all' | 'a010' | 'construir_para_alugar');
  };

  const handleClear = () => {
    setPeriod('mes');
    setStartDate(undefined);
    setEndDate(undefined);
    setCourseType('all');
    setSearch("");
  };

  const handleExport = () => {
    if (!sales) return;

    const csvContent = [
      ['Data', 'Curso', 'Cliente', 'Email', 'Telefone', 'Valor'].join(','),
      ...sales.map(sale => 
        [
          formatDate(sale.sale_date),
          sale.product_name,
          sale.customer_name,
          sale.customer_email || '',
          sale.customer_phone || '',
          sale.product_price
        ].join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `cursos-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Cursos</h1>
        <p className="text-muted-foreground">
          Acompanhe as vendas de todos os cursos em tempo real
        </p>
      </div>

      <CourseFilters 
        onApply={handleApply}
        onClear={handleClear}
        onExport={handleExport}
      />

      <div className="mb-6">
        <Input
          placeholder="Buscar por nome, email ou telefone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md"
        />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
              value={summary?.totalSales.toString() || "0"}
              icon={Users}
              variant="neutral"
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

      {/* Comparação de Cursos */}
      {courseType === 'all' && summary && (
        <CourseComparison 
          a010Summary={summary.a010Summary}
          construirSummary={summary.construirSummary}
        />
      )}

      {/* Gráfico de Evolução */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-foreground">
            Evolução de Vendas por Curso
          </CardTitle>
        </CardHeader>
        <CardContent>
          {summaryLoading ? (
            <Skeleton className="h-[300px]" />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={summary?.chartData || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="date" 
                  stroke="hsl(var(--muted-foreground))"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px'
                  }}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                />
                <Legend />
                {courseType === 'all' ? (
                  <>
                    <Line 
                      type="monotone" 
                      dataKey="a010" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      name="A010 - Consultoria"
                      dot={{ fill: 'hsl(var(--primary))' }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="construir" 
                      stroke="hsl(var(--success))" 
                      strokeWidth={2}
                      name="Construir Para Alugar"
                      dot={{ fill: 'hsl(var(--success))' }}
                    />
                  </>
                ) : (
                  <Line 
                    type="monotone" 
                    dataKey="total" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    name="Receita"
                    dot={{ fill: 'hsl(var(--primary))' }}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Tabela de Transações */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Transações de Cursos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Curso</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {salesLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  </TableRow>
                ))
              ) : sales && sales.length > 0 ? (
                sales.map((sale) => (
                  <TableRow key={sale.id}>
                    <TableCell>{formatDate(sale.sale_date)}</TableCell>
                    <TableCell className="font-medium">{sale.product_name}</TableCell>
                    <TableCell>{sale.customer_name}</TableCell>
                    <TableCell>{sale.customer_email || "-"}</TableCell>
                    <TableCell>{sale.customer_phone || "-"}</TableCell>
                    <TableCell className="text-right font-semibold text-success">
                      {formatCurrency(sale.product_price)}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Nenhuma transação encontrada para o período selecionado
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
