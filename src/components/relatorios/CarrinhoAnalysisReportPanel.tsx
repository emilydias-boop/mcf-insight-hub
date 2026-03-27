import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChevronLeft, ChevronRight, Download, TrendingDown, TrendingUp, AlertTriangle, CheckCircle2, XCircle, Users, Phone, Calendar } from 'lucide-react';
import { format, startOfMonth, endOfMonth, addWeeks, subWeeks, addMonths, subMonths, startOfWeek, endOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DatePickerCustom } from '@/components/ui/DatePickerCustom';
import { useCarrinhoAnalysisReport, LeadDetalhado, LeadAvancado } from '@/hooks/useCarrinhoAnalysisReport';
import { BusinessUnit } from '@/hooks/useMyBU';
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx';
import { DateRange } from 'react-day-picker';
import { BrazilMap } from './BrazilMap';

type PeriodType = 'semana' | 'mes' | 'personalizado';

function getCartWeekStart(date: Date): Date {
  return startOfWeek(date, { weekStartsOn: 4 });
}

function getCartWeekEnd(date: Date): Date {
  return endOfWeek(date, { weekStartsOn: 4 });
}

interface CarrinhoAnalysisReportPanelProps {
  bu: BusinessUnit;
}

export function CarrinhoAnalysisReportPanel({ bu }: CarrinhoAnalysisReportPanelProps) {
  const [periodType, setPeriodType] = useState<PeriodType>('semana');
  const [weekDate, setWeekDate] = useState(new Date());
  const [monthDate, setMonthDate] = useState(new Date());
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  
  // Filters for detailed table
  const [filterMotivo, setFilterMotivo] = useState<string>('all');
  const [filterEstado, setFilterEstado] = useState<string>('all');
  const [filterTipo, setFilterTipo] = useState<string>('all');
  // Filters for advanced leads
  const [filterCloser, setFilterCloser] = useState<string>('all');
  const [filterEstadoAv, setFilterEstadoAv] = useState<string>('all');

  const [activeTab, setActiveTab] = useState<string>('avancados');

  const { startDate, endDate } = useMemo(() => {
    if (periodType === 'semana') {
      return { startDate: getCartWeekStart(weekDate), endDate: getCartWeekEnd(weekDate) };
    }
    if (periodType === 'mes') {
      return { startDate: startOfMonth(monthDate), endDate: endOfMonth(monthDate) };
    }
    if (periodType === 'personalizado' && customRange?.from && customRange?.to) {
      return { startDate: customRange.from, endDate: customRange.to };
    }
    return { startDate: null as Date | null, endDate: null as Date | null };
  }, [periodType, weekDate, monthDate, customRange]);

  const { data, isLoading } = useCarrinhoAnalysisReport(startDate, endDate);

  const filteredLeads = useMemo(() => {
    if (!data) return [];
    return data.leadsDetalhados.filter(l => {
      if (filterMotivo !== 'all' && l.motivoPerda !== filterMotivo) return false;
      if (filterEstado !== 'all' && l.estado !== filterEstado) return false;
      if (filterTipo !== 'all' && l.tipoPerda !== filterTipo) return false;
      return true;
    });
  }, [data, filterMotivo, filterEstado, filterTipo]);

  const filteredAvancados = useMemo(() => {
    if (!data) return [];
    return data.leadsAvancados.filter(l => {
      if (filterCloser !== 'all' && l.closerName !== filterCloser) return false;
      if (filterEstadoAv !== 'all' && l.estado !== filterEstadoAv) return false;
      return true;
    });
  }, [data, filterCloser, filterEstadoAv]);

  const uniqueMotivos = useMemo(() => data ? [...new Set(data.leadsDetalhados.map(l => l.motivoPerda))] : [], [data]);
  const uniqueEstados = useMemo(() => data ? [...new Set(data.leadsDetalhados.map(l => l.estado))].sort() : [], [data]);
  const uniqueClosers = useMemo(() => data ? [...new Set(data.leadsAvancados.map(l => l.closerName).filter(Boolean))].sort() : [], [data]);
  const uniqueEstadosAv = useMemo(() => data ? [...new Set(data.leadsAvancados.map(l => l.estado))].sort() : [], [data]);

  const gapOperacional = useMemo(() => {
    if (!data) return 0;
    return data.leadsDetalhados.filter(l => l.tipoPerda === 'operacional').length;
  }, [data]);

  const exportExcel = () => {
    if (activeTab === 'avancados') {
      if (!filteredAvancados.length) return;
      const ws = XLSX.utils.json_to_sheet(filteredAvancados.map(l => ({
        Nome: l.nome,
        Telefone: l.telefone,
        Estado: l.estado,
        'Data Compra': format(new Date(l.dataCompra), 'dd/MM/yyyy'),
        Status: l.statusAtual,
        Closer: l.closerName || '—',
        'Data R2': l.dataR2 ? format(new Date(l.dataR2), 'dd/MM/yyyy HH:mm') : '—',
        Outside: l.isOutside ? 'Sim' : 'Não',
      })));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Leads Avançaram');
      XLSX.writeFile(wb, `carrinho-avancaram-${format(startDate!, 'yyyy-MM-dd')}.xlsx`);
    } else {
      if (!filteredLeads.length) return;
      const ws = XLSX.utils.json_to_sheet(filteredLeads.map(l => ({
        Nome: l.nome,
        Telefone: l.telefone,
        Estado: l.estado,
        'Data Compra': format(new Date(l.dataCompra), 'dd/MM/yyyy'),
        Produto: l.produto,
        'Status Atual': l.statusAtual,
        'R2 Agendada': l.r2Agendada ? 'Sim' : 'Não',
        'R2 Realizada': l.r2Realizada ? 'Sim' : 'Não',
        'Motivo Perda': l.motivoPerda,
        'Tipo': l.tipoPerda === 'legitima' ? 'Exclusão Legítima' : 'Falha Operacional',
        Responsável: l.responsavel,
        'Última Interação': l.ultimaInteracao ? format(new Date(l.ultimaInteracao), 'dd/MM/yyyy') : '',
        'Dias Sem Andamento': l.diasSemAndamento,
      })));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Leads Perdidos');
      XLSX.writeFile(wb, `carrinho-perdidos-${format(startDate!, 'yyyy-MM-dd')}.xlsx`);
    }
  };

  const periodLabel = useMemo(() => {
    if (!startDate || !endDate) return 'Selecione um período';
    if (periodType === 'semana') {
      return `Semana: ${format(startDate, 'dd/MM', { locale: ptBR })} - ${format(endDate, 'dd/MM/yyyy', { locale: ptBR })}`;
    }
    if (periodType === 'mes') {
      return format(startDate, 'MMMM yyyy', { locale: ptBR });
    }
    return `${format(startDate, 'dd/MM/yyyy')} - ${format(endDate, 'dd/MM/yyyy')}`;
  }, [startDate, endDate, periodType]);

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5" />
            Análise de Carrinho
          </CardTitle>
          <CardDescription>Aproveitamento do carrinho até a R2 — identifique onde os leads se perdem</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1 block">Período</label>
              <Select value={periodType} onValueChange={(v) => setPeriodType(v as PeriodType)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="semana">Semana (Qui-Qua)</SelectItem>
                  <SelectItem value="mes">Mês</SelectItem>
                  <SelectItem value="personalizado">Personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {periodType === 'semana' && (
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={() => setWeekDate(d => subWeeks(d, 1))}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-medium min-w-[200px] text-center">{periodLabel}</span>
                <Button variant="outline" size="icon" onClick={() => setWeekDate(d => addWeeks(d, 1))}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}

            {periodType === 'mes' && (
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={() => setMonthDate(d => subMonths(d, 1))}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-medium min-w-[200px] text-center capitalize">{periodLabel}</span>
                <Button variant="outline" size="icon" onClick={() => setMonthDate(d => addMonths(d, 1))}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}

            {periodType === 'personalizado' && (
              <DatePickerCustom
                mode="range"
                selected={customRange}
                onSelect={(d) => setCustomRange(d as DateRange)}
                placeholder="Selecione o período"
              />
            )}
          </div>
        </CardContent>
      </Card>

      {isLoading && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Carregando dados...
          </CardContent>
        </Card>
      )}

      {data && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-3 md:grid-cols-3 lg:grid-cols-9 gap-3">
            {[
              { label: 'Contratos', value: data.kpis.novosContratos, icon: Users, color: 'text-blue-600' },
              { label: 'Elegíveis', value: data.kpis.totalElegivel, icon: Users, color: 'text-indigo-600' },
              { label: 'Comunicados', value: data.kpis.comunicados, icon: Phone, color: 'text-cyan-600' },
              { label: 'R2 Agendadas', value: data.kpis.r2Agendadas, icon: Calendar, color: 'text-amber-600' },
              { label: 'R2 Realizadas', value: data.kpis.r2Realizadas, icon: CheckCircle2, color: 'text-green-600' },
              { label: 'Perdidos', value: data.kpis.perdidos, icon: XCircle, color: 'text-red-600' },
              { label: 'Aproveitamento', value: `${data.kpis.taxaAproveitamento.toFixed(1)}%`, icon: TrendingUp, color: 'text-green-600' },
              { label: 'Taxa Perda', value: `${data.kpis.taxaPerda.toFixed(1)}%`, icon: TrendingDown, color: 'text-red-600' },
              { label: 'Gap', value: data.kpis.totalElegivel - data.kpis.r2Realizadas, icon: AlertTriangle, color: 'text-orange-600' },
            ].map((kpi, i) => (
              <Card key={i}>
                <CardContent className="pt-4 pb-3 px-3 text-center">
                  <kpi.icon className={cn('h-5 w-5 mx-auto mb-1', kpi.color)} />
                  <div className="text-xl font-bold">{kpi.value}</div>
                  <div className="text-xs text-muted-foreground">{kpi.label}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Funnel */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Funil do Carrinho</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.funnelSteps.map((step, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{step.label}</span>
                    <span className="text-muted-foreground">{step.count} ({step.pct.toFixed(1)}%)</span>
                  </div>
                  <div className="h-6 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        i === 0 ? 'bg-blue-500' : i === 1 ? 'bg-cyan-500' : i === 2 ? 'bg-amber-500' : 'bg-green-500'
                      )}
                      style={{ width: `${Math.max(step.pct, 2)}%` }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Motivos de Perda + Mapa do Brasil side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Motivos de Perda</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Motivo</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="text-right">Qtd</TableHead>
                      <TableHead className="text-right">%</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.motivosPerda.map((m, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{m.motivo}</TableCell>
                        <TableCell>
                          <Badge variant={m.tipo === 'legitima' ? 'secondary' : 'destructive'} className="text-xs">
                            {m.tipo === 'legitima' ? 'Legítima' : 'Operacional'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{m.count}</TableCell>
                        <TableCell className="text-right">{m.pct.toFixed(1)}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Distribuição por Estado</CardTitle>
                <CardDescription>Clique em um estado para filtrar a tabela abaixo</CardDescription>
              </CardHeader>
              <CardContent>
                <BrazilMap
                  stateData={data.analysisByState}
                  onStateClick={(uf) => setFilterEstado(prev => prev === uf ? 'all' : uf)}
                  selectedState={filterEstado !== 'all' ? filterEstado : undefined}
                />
                <div className="mt-4 space-y-1.5">
                  {data.analysisByState.slice(0, 5).map((s, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="font-medium w-8">{s.uf}</span>
                      <div className="flex-1 mx-2 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.max((s.contratos / (data.analysisByState[0]?.contratos || 1)) * 100, 4)}%`,
                            background: `hsl(${120 - (s.taxaPerda / 100) * 120}, 65%, 48%)`,
                          }}
                        />
                      </div>
                      <span className="text-muted-foreground w-20 text-right">
                        {s.contratos} contr. · {s.taxaPerda.toFixed(0)}%
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Comparativo Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-green-200 bg-green-50/50 dark:bg-green-950/20 dark:border-green-900">
              <CardContent className="pt-4 pb-3 px-4 flex items-center gap-3">
                <CheckCircle2 className="h-8 w-8 text-green-600 shrink-0" />
                <div>
                  <div className="text-2xl font-bold text-green-700 dark:text-green-400">{data.leadsAvancados.length}</div>
                  <div className="text-sm text-green-600 dark:text-green-500">
                    Avançaram ({data.kpis.totalElegivel > 0 ? ((data.leadsAvancados.length / data.kpis.totalElegivel) * 100).toFixed(1) : 0}%)
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-red-200 bg-red-50/50 dark:bg-red-950/20 dark:border-red-900">
              <CardContent className="pt-4 pb-3 px-4 flex items-center gap-3">
                <XCircle className="h-8 w-8 text-red-600 shrink-0" />
                <div>
                  <div className="text-2xl font-bold text-red-700 dark:text-red-400">{data.leadsDetalhados.length}</div>
                  <div className="text-sm text-red-600 dark:text-red-500">
                    Perdidos ({data.kpis.totalElegivel > 0 ? ((data.leadsDetalhados.length / data.kpis.totalElegivel) * 100).toFixed(1) : 0}%)
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-900">
              <CardContent className="pt-4 pb-3 px-4 flex items-center gap-3">
                <AlertTriangle className="h-8 w-8 text-amber-600 shrink-0" />
                <div>
                  <div className="text-2xl font-bold text-amber-700 dark:text-amber-400">{gapOperacional}</div>
                  <div className="text-sm text-amber-600 dark:text-amber-500">
                    Gap Operacional (poderiam avançar)
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tabela Detalhada com Tabs */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Detalhamento de Leads</CardTitle>
                  <CardDescription>Compare quem avançou vs quem se perdeu no funil</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={exportExcel} disabled={activeTab === 'avancados' ? !filteredAvancados.length : !filteredLeads.length}>
                  <Download className="h-4 w-4 mr-2" />
                  Exportar Excel
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="mb-4">
                  <TabsTrigger value="avancados">
                    ✅ Avançaram ({data.leadsAvancados.length})
                  </TabsTrigger>
                  <TabsTrigger value="perdidos">
                    ❌ Perdidos ({data.leadsDetalhados.length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="avancados">
                  {/* Filters */}
                  <div className="flex flex-wrap gap-3 mb-4">
                    <Select value={filterCloser} onValueChange={setFilterCloser}>
                      <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="Closer" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os closers</SelectItem>
                        {uniqueClosers.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Select value={filterEstadoAv} onValueChange={setFilterEstadoAv}>
                      <SelectTrigger className="w-[120px]">
                        <SelectValue placeholder="Estado" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos UFs</SelectItem>
                        {uniqueEstadosAv.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="max-h-[500px] overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead>Telefone</TableHead>
                          <TableHead>UF</TableHead>
                          <TableHead>Data Compra</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Closer</TableHead>
                          <TableHead>Data R2</TableHead>
                          <TableHead>Outside</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredAvancados.slice(0, 200).map((l, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-medium max-w-[150px] truncate">{l.nome}</TableCell>
                            <TableCell className="text-xs">{l.telefone}</TableCell>
                            <TableCell>{l.estado}</TableCell>
                            <TableCell className="text-xs">{format(new Date(l.dataCompra), 'dd/MM/yy')}</TableCell>
                            <TableCell>
                              <Badge className={cn('text-xs', l.r2Realizada ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800')}>
                                {l.statusAtual}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs">{l.closerName || '—'}</TableCell>
                            <TableCell className="text-xs">{l.dataR2 ? format(new Date(l.dataR2), 'dd/MM/yy HH:mm') : '—'}</TableCell>
                            <TableCell>
                              {l.isOutside ? (
                                <Badge className="bg-purple-100 text-purple-800 text-xs">Sim</Badge>
                              ) : (
                                <span className="text-muted-foreground text-xs">—</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {filteredAvancados.length > 200 && (
                      <p className="text-sm text-muted-foreground text-center mt-2">
                        Mostrando 200 de {filteredAvancados.length} leads. Exporte para ver todos.
                      </p>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="perdidos">
                  {/* Filters */}
                  <div className="flex flex-wrap gap-3 mb-4">
                    <Select value={filterMotivo} onValueChange={setFilterMotivo}>
                      <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="Motivo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os motivos</SelectItem>
                        {uniqueMotivos.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Select value={filterEstado} onValueChange={setFilterEstado}>
                      <SelectTrigger className="w-[120px]">
                        <SelectValue placeholder="Estado" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos UFs</SelectItem>
                        {uniqueEstados.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Select value={filterTipo} onValueChange={setFilterTipo}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os tipos</SelectItem>
                        <SelectItem value="operacional">Falha Operacional</SelectItem>
                        <SelectItem value="legitima">Exclusão Legítima</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="max-h-[500px] overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead>Telefone</TableHead>
                          <TableHead>UF</TableHead>
                          <TableHead>Data Compra</TableHead>
                          <TableHead>Produto</TableHead>
                          <TableHead>Outside</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>R2</TableHead>
                          <TableHead>Motivo</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Responsável</TableHead>
                          <TableHead className="text-right">Dias Parado</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredLeads.slice(0, 200).map((l, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-medium max-w-[150px] truncate">{l.nome}</TableCell>
                            <TableCell className="text-xs">{l.telefone}</TableCell>
                            <TableCell>{l.estado}</TableCell>
                            <TableCell className="text-xs">{format(new Date(l.dataCompra), 'dd/MM/yy')}</TableCell>
                            <TableCell className="text-xs max-w-[120px] truncate">{l.produto}</TableCell>
                            <TableCell>
                              {l.isOutside ? (
                                <Badge className="bg-purple-100 text-purple-800 text-xs">Sim</Badge>
                              ) : (
                                <span className="text-muted-foreground text-xs">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">{l.statusAtual}</Badge>
                            </TableCell>
                            <TableCell>
                              {l.r2Agendada ? (
                                l.r2Realizada ? 
                                  <Badge className="bg-green-100 text-green-800 text-xs">Realizada</Badge> :
                                  <Badge className="bg-amber-100 text-amber-800 text-xs">Agendada</Badge>
                              ) : (
                                <Badge variant="secondary" className="text-xs">Não</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-xs">{l.motivoPerda}</TableCell>
                            <TableCell>
                              <Badge variant={l.tipoPerda === 'operacional' ? 'destructive' : 'secondary'} className="text-xs">
                                {l.tipoPerda === 'operacional' ? 'Oper.' : 'Legít.'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs">{l.responsavel || '—'}</TableCell>
                            <TableCell className="text-right">
                              <span className={cn(l.diasSemAndamento > 7 ? 'text-red-600 font-medium' : '')}>
                                {l.diasSemAndamento}d
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {filteredLeads.length > 200 && (
                      <p className="text-sm text-muted-foreground text-center mt-2">
                        Mostrando 200 de {filteredLeads.length} leads. Exporte para ver todos.
                      </p>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
