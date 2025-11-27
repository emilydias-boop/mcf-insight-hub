import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { KPICard } from "@/components/ui/KPICard";
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingUp, Users, BookOpen, ChevronLeft, ChevronRight, Eye } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { useCoursesSales, useCoursesSummary, CourseSale } from "@/hooks/useCoursesSales";
import { CourseFilters } from "@/components/courses/CourseFilters";
import { CourseComparison } from "@/components/courses/CourseComparison";
import { LeadDetailsDrawer } from "@/components/courses/LeadDetailsDrawer";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { getCustomWeekStart, getCustomWeekEnd } from "@/lib/dateHelpers";

export default function A010() {
  const [period, setPeriod] = useState<'semana' | 'mes' | 'all'>('semana');
  const [startDate, setStartDate] = useState<Date>(getCustomWeekStart(new Date()));
  const [endDate, setEndDate] = useState<Date>(getCustomWeekEnd(new Date()));
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [weeksToShow, setWeeksToShow] = useState(12);
  const [transactionCourseFilter, setTransactionCourseFilter] = useState<'all' | 'a010' | 'construir_para_alugar'>('all');
  const [selectedLead, setSelectedLead] = useState<CourseSale | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Buscar TODAS as transações (sem filtro de período)
  const { data: sales, isLoading: salesLoading } = useCoursesSales({ 
    period: 'all',
    courseType: transactionCourseFilter,
    search,
    limit: 1000
  });

  // Buscar dados dos KPIs e comparação (com filtro de período)
  const { data: summaryData, isLoading: isSummaryLoading } = useCoursesSummary({
    period,
    startDate,
    endDate,
    courseType: 'all'
  });

  // Buscar dados do gráfico de evolução (SEM filtro de período - mostra todo histórico)
  const { data: evolutionData, isLoading: isEvolutionLoading } = useCoursesSummary({
    period: 'all',
    startDate: new Date('2024-06-01'),
    endDate: new Date(),
    courseType: 'all'
  });

  const handleApply = (filters: { 
    periodo: { tipo: 'semana' | 'mes' | 'all'; inicio: Date; fim: Date };
  }) => {
    setPeriod(filters.periodo.tipo);
    setStartDate(filters.periodo.inicio);
    setEndDate(filters.periodo.fim);
  };

  const handleClear = () => {
    setPeriod('semana');
    setStartDate(getCustomWeekStart(new Date()));
    setEndDate(getCustomWeekEnd(new Date()));
    setSearch("");
    setCurrentPage(1);
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

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {isSummaryLoading ? (
          <>
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </>
        ) : (
          <>
            <KPICard
              title="Total de Vendas"
              value={summaryData?.totalSales.toString() || "0"}
              icon={Users}
              variant="neutral"
            />
            <KPICard
              title="Receita Total"
              value={formatCurrency(summaryData?.totalRevenue || 0)}
              icon={DollarSign}
              variant="success"
            />
            <KPICard
              title="Ticket Médio"
              value={formatCurrency(summaryData?.averageTicket || 0)}
              icon={TrendingUp}
              variant="neutral"
            />
          </>
        )}
      </div>

      {/* Comparação de Cursos */}
      {summaryData && (
        <CourseComparison 
          a010Summary={summaryData.a010Summary}
          construirSummary={summaryData.construirSummary}
        />
      )}

      {/* Gráfico de Evolução */}
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-semibold text-foreground">
            Evolução de Vendas por Curso (Histórico Completo)
          </CardTitle>
          <div className="flex gap-2">
            <Button
              variant={weeksToShow === 12 ? "default" : "outline"}
              size="sm"
              onClick={() => setWeeksToShow(12)}
            >
              12 Semanas
            </Button>
            <Button
              variant={weeksToShow === 26 ? "default" : "outline"}
              size="sm"
              onClick={() => setWeeksToShow(26)}
            >
              26 Semanas
            </Button>
            <Button
              variant={weeksToShow === 52 ? "default" : "outline"}
              size="sm"
              onClick={() => setWeeksToShow(52)}
            >
              52 Semanas
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isEvolutionLoading ? (
            <Skeleton className="h-[300px]" />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={evolutionData?.chartData?.slice(-weeksToShow) || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="weekLabel" 
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
                <Line 
                  type="monotone" 
                  dataKey="a010" 
                  stroke="hsl(var(--chart-1))" 
                  strokeWidth={2}
                  name="A010"
                  dot={{ fill: 'hsl(var(--chart-1))' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="construir" 
                  stroke="hsl(var(--chart-2))" 
                  strokeWidth={2}
                  name="Construir Para Alugar"
                  dot={{ fill: 'hsl(var(--chart-2))' }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Tabela de Transações */}
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Transações de Cursos
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select
              value={transactionCourseFilter}
              onValueChange={(value: 'all' | 'a010' | 'construir_para_alugar') => {
                setTransactionCourseFilter(value);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filtrar por curso" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Cursos</SelectItem>
                <SelectItem value="a010">A010</SelectItem>
                <SelectItem value="construir_para_alugar">Construir Para Alugar</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder="Buscar por nome, email ou telefone..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="max-w-md"
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Curso</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {salesLoading ? (
                Array.from({ length: rowsPerPage }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-10" /></TableCell>
                  </TableRow>
                ))
              ) : sales && sales.length > 0 ? (
                sales
                  .slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage)
                  .map((sale) => (
                    <TableRow 
                      key={sale.id}
                      className={sale.sale_status === 'refunded' ? 'bg-destructive/10' : ''}
                    >
                      <TableCell>{formatDate(sale.sale_date)}</TableCell>
                      <TableCell className="font-medium">{sale.product_name}</TableCell>
                      <TableCell>{sale.customer_name}</TableCell>
                      <TableCell>{sale.customer_email || "-"}</TableCell>
                      <TableCell>{sale.customer_phone || "-"}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(sale.product_price)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={sale.sale_status === 'refunded' ? 'destructive' : 'default'}>
                          {sale.sale_status === 'refunded' ? 'Reembolso' : 'Pago'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setSelectedLead(sale);
                            setIsDrawerOpen(true);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
              ) : (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    Nenhuma transação encontrada
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {/* Paginação */}
          {sales && sales.length > 0 && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Linhas por página:</span>
                <Select
                  value={rowsPerPage.toString()}
                  onValueChange={(value) => {
                    setRowsPerPage(Number(value));
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="w-[70px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-4">
                <span className="text-sm text-muted-foreground">
                  Exibindo {Math.min((currentPage - 1) * rowsPerPage + 1, sales.length)}-
                  {Math.min(currentPage * rowsPerPage, sales.length)} de {sales.length} transações
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(Math.ceil(sales.length / rowsPerPage), prev + 1))}
                    disabled={currentPage >= Math.ceil(sales.length / rowsPerPage)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <LeadDetailsDrawer
        open={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        sale={selectedLead}
      />
    </div>
  );
}
