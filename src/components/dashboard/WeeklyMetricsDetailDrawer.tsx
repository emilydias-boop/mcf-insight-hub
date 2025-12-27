import { useState } from "react";
import { format, parseISO, subWeeks } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Calendar,
  DollarSign,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Users,
  BarChart3,
  Check,
  X,
  Clock,
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useWeekTransactions, useWeekCosts, WeeklyMetricsRow } from "@/hooks/useWeeklyMetricsList";
import { formatCurrency, formatPercent } from "@/lib/formatters";
import { useWeeklyMetrics } from "@/hooks/useWeeklyMetrics";

interface WeeklyMetricsDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  weekData: WeeklyMetricsRow | null;
  onRecalculate: () => void;
  isRecalculating: boolean;
}

export function WeeklyMetricsDetailDrawer({
  open,
  onOpenChange,
  weekData,
  onRecalculate,
  isRecalculating,
}: WeeklyMetricsDetailDrawerProps) {
  const [activeTab, setActiveTab] = useState("resumo");

  const { data: transactions, isLoading: loadingTransactions } = useWeekTransactions(
    weekData?.start_date || '',
    weekData?.end_date || '',
    open && !!weekData
  );

  const { data: costs, isLoading: loadingCosts } = useWeekCosts(
    weekData?.start_date || '',
    weekData?.end_date || '',
    open && !!weekData
  );

  // Buscar semana anterior para comparação
  const { data: allWeeks } = useWeeklyMetrics(52);
  const previousWeek = allWeeks?.find((w, idx) => {
    const currentIdx = allWeeks.findIndex(ww => ww.id === weekData?.id);
    return idx === currentIdx + 1;
  });

  const formatWeekLabel = () => {
    if (!weekData) return '';
    if (weekData.week_label) return weekData.week_label;
    const start = parseISO(weekData.start_date);
    const end = parseISO(weekData.end_date);
    return `${format(start, "dd/MM", { locale: ptBR })} - ${format(end, "dd/MM/yyyy", { locale: ptBR })}`;
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'approved':
        return <Badge variant="default" className="bg-green-600"><Check className="h-3 w-3 mr-1" /> Aprovada</Badge>;
      case 'rejected':
        return <Badge variant="destructive"><X className="h-3 w-3 mr-1" /> Rejeitada</Badge>;
      case 'pending':
        return <Badge variant="secondary" className="bg-amber-500/20 text-amber-600"><Clock className="h-3 w-3 mr-1" /> Pendente</Badge>;
      default:
        return <Badge variant="outline">—</Badge>;
    }
  };

  const calcChange = (current: number, previous: number) => {
    if (!previous || previous === 0) return null;
    return ((current - previous) / previous) * 100;
  };

  const ChangeIndicator = ({ current, previous }: { current: number; previous?: number }) => {
    const change = calcChange(current, previous || 0);
    if (change === null) return null;
    const isPositive = change >= 0;
    return (
      <span className={`text-xs flex items-center gap-1 ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
        {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
        {Math.abs(change).toFixed(1)}%
      </span>
    );
  };

  if (!weekData) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-hidden">
        <SheetHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <SheetTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                {formatWeekLabel()}
              </SheetTitle>
              <SheetDescription className="flex items-center gap-2 mt-1">
                {getStatusBadge(weekData.approval_status)}
                {weekData.updated_at && (
                  <span className="text-xs text-muted-foreground">
                    Atualizado: {format(parseISO(weekData.updated_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </span>
                )}
              </SheetDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={onRecalculate}
              disabled={isRecalculating}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isRecalculating ? 'animate-spin' : ''}`} />
              Recalcular
            </Button>
          </div>
        </SheetHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-[calc(100%-80px)]">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="resumo">Resumo</TabsTrigger>
            <TabsTrigger value="transacoes">Transações</TabsTrigger>
            <TabsTrigger value="custos">Custos</TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[calc(100%-48px)] mt-4">
            {/* Aba Resumo */}
            <TabsContent value="resumo" className="space-y-4 pr-4">
              {/* KPIs principais */}
              <div className="grid grid-cols-2 gap-3">
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-xs text-muted-foreground">Faturamento Total</p>
                    <p className="text-xl font-bold">
                      {formatCurrency(weekData.faturamento_total || weekData.total_revenue || 0)}
                    </p>
                    <ChangeIndicator 
                      current={weekData.faturamento_total || weekData.total_revenue || 0}
                      previous={previousWeek?.total_revenue || 0}
                    />
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-xs text-muted-foreground">Incorporador 50k</p>
                    <p className="text-xl font-bold">{formatCurrency(weekData.incorporador_50k || 0)}</p>
                    <ChangeIndicator 
                      current={weekData.incorporador_50k || 0}
                      previous={previousWeek?.incorporador_50k || 0}
                    />
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-xs text-muted-foreground">Lucro Operacional</p>
                    <p className={`text-xl font-bold ${(weekData.operating_profit || 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {formatCurrency(weekData.operating_profit || 0)}
                    </p>
                    <ChangeIndicator 
                      current={weekData.operating_profit || 0}
                      previous={previousWeek?.operating_profit || 0}
                    />
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-xs text-muted-foreground">ROI</p>
                    <p className="text-xl font-bold">{formatPercent((weekData.roi || 0) / 100)}</p>
                    <ChangeIndicator 
                      current={weekData.roi || 0}
                      previous={previousWeek?.roi || 0}
                    />
                  </CardContent>
                </Card>
              </div>

              {/* Detalhamento de receitas */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Receitas por Produto
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">A010</span>
                      <span>{formatCurrency(weekData.a010_revenue || 0)} ({weekData.a010_sales || 0} vendas)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Incorporador 50k</span>
                      <span>{formatCurrency(weekData.incorporador_50k || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Contratos</span>
                      <span>{formatCurrency(weekData.contract_revenue || 0)} ({weekData.contract_sales || 0} vendas)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">OB Construir</span>
                      <span>{formatCurrency(weekData.ob_construir_revenue || 0)} ({weekData.ob_construir_sales || 0})</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">OB Vitalício</span>
                      <span>{formatCurrency(weekData.ob_vitalicio_revenue || 0)} ({weekData.ob_vitalicio_sales || 0})</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">OB Evento</span>
                      <span>{formatCurrency(weekData.ob_evento_revenue || 0)} ({weekData.ob_evento_sales || 0})</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Clint Revenue</span>
                      <span>{formatCurrency(weekData.clint_revenue || 0)}</span>
                    </div>
                    <Separator className="my-2" />
                    <div className="flex justify-between font-medium">
                      <span>Total</span>
                      <span>{formatCurrency(weekData.faturamento_total || weekData.total_revenue || 0)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Custos */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    Custos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Ads</span>
                      <span>{formatCurrency(weekData.ads_cost || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Equipe</span>
                      <span>{formatCurrency(weekData.team_cost || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Escritório</span>
                      <span>{formatCurrency(weekData.office_cost || 0)}</span>
                    </div>
                    <Separator className="my-2" />
                    <div className="flex justify-between font-medium">
                      <span>Custo Operacional</span>
                      <span>{formatCurrency(weekData.operating_cost || 0)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Métricas */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Métricas</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">ROAS</span>
                      <p className="font-medium">{(weekData.roas || 0).toFixed(2)}x</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">CPL</span>
                      <p className="font-medium">{formatCurrency(weekData.cpl || 0)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Ultrameta Clint</span>
                      <p className="font-medium">{formatCurrency(weekData.ultrameta_clint || 0)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Ultrameta Líquido</span>
                      <p className="font-medium">{formatCurrency(weekData.ultrameta_liquido || 0)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Comparação com semana anterior */}
              {previousWeek && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      Comparação com Semana Anterior
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Faturamento</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            {formatCurrency(previousWeek.total_revenue || 0)}
                          </span>
                          <ChevronRight className="h-3 w-3" />
                          <span>{formatCurrency(weekData.faturamento_total || weekData.total_revenue || 0)}</span>
                          <ChangeIndicator 
                            current={weekData.faturamento_total || weekData.total_revenue || 0}
                            previous={previousWeek.total_revenue || 0}
                          />
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Lucro</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            {formatCurrency(previousWeek.operating_profit || 0)}
                          </span>
                          <ChevronRight className="h-3 w-3" />
                          <span>{formatCurrency(weekData.operating_profit || 0)}</span>
                          <ChangeIndicator 
                            current={weekData.operating_profit || 0}
                            previous={previousWeek.operating_profit || 0}
                          />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Aba Transações */}
            <TabsContent value="transacoes" className="space-y-4 pr-4">
              {loadingTransactions ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </div>
              ) : (
                <>
                  {/* Resumo por categoria */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Resumo por Categoria</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm">
                        {Object.entries(transactions?.summary.by_category || {}).map(([category, data]) => (
                          <div key={category} className="flex justify-between">
                            <span className="text-muted-foreground capitalize">{category.replace(/_/g, ' ')}</span>
                            <span>{formatCurrency(data.revenue)} ({data.count} vendas)</span>
                          </div>
                        ))}
                        <Separator className="my-2" />
                        <div className="flex justify-between font-medium">
                          <span>Total</span>
                          <span>{formatCurrency(transactions?.summary.total_revenue || 0)} ({transactions?.summary.total_transactions || 0} transações)</span>
                        </div>
                        {(transactions?.summary.incorporador_unique_emails || 0) > 0 && (
                          <div className="flex justify-between text-amber-600">
                            <span>Incorporador 50k (emails únicos)</span>
                            <span>{transactions?.summary.incorporador_unique_emails} pessoas</span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Link para transações */}
                  <Link to={`/receita/transacoes?start=${weekData.start_date}&end=${weekData.end_date}`}>
                    <Button variant="outline" className="w-full">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Ver Todas as Transações ({transactions?.transactions.length || 0})
                    </Button>
                  </Link>

                  {/* Lista das últimas transações */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Últimas Transações</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Produto</TableHead>
                            <TableHead>Cliente</TableHead>
                            <TableHead className="text-right">Valor</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {transactions?.transactions.slice(0, 10).map((tx) => (
                            <TableRow key={tx.id}>
                              <TableCell className="text-xs">
                                <Badge variant="outline" className="text-[10px]">
                                  {tx.product_category || 'outros'}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs truncate max-w-32">
                                {tx.customer_name || tx.customer_email || '—'}
                              </TableCell>
                              <TableCell className="text-right text-xs">
                                {formatCurrency(tx.net_value || 0)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </>
              )}
            </TabsContent>

            {/* Aba Custos */}
            <TabsContent value="custos" className="space-y-4 pr-4">
              {loadingCosts ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </div>
              ) : (
                <>
                  {/* Resumo por tipo */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Custos por Tipo</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm">
                        {Object.entries(costs?.byType || {}).map(([type, data]) => (
                          <div key={type} className="flex justify-between">
                            <span className="text-muted-foreground capitalize">{type}</span>
                            <span>{formatCurrency(data.amount)} ({data.count} registros)</span>
                          </div>
                        ))}
                        <Separator className="my-2" />
                        <div className="flex justify-between font-medium">
                          <span>Total</span>
                          <span>{formatCurrency(costs?.total || 0)}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Lista de custos */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Detalhamento</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Data</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead className="text-right">Valor</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {costs?.costs.map((cost) => (
                            <TableRow key={cost.id}>
                              <TableCell className="text-xs">
                                {format(parseISO(cost.date), "dd/MM", { locale: ptBR })}
                              </TableCell>
                              <TableCell className="text-xs">
                                <Badge variant="outline" className="text-[10px]">
                                  {cost.cost_type}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right text-xs">
                                {formatCurrency(cost.amount || 0)}
                              </TableCell>
                            </TableRow>
                          ))}
                          {(!costs?.costs || costs.costs.length === 0) && (
                            <TableRow>
                              <TableCell colSpan={3} className="text-center py-4 text-muted-foreground">
                                Nenhum custo registrado
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </>
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
