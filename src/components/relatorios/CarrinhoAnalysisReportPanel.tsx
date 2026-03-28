import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Download, TrendingDown, TrendingUp, AlertTriangle, CheckCircle2, XCircle, Users, Calendar, ShieldAlert, BarChart3, MapPin } from 'lucide-react';
import { format, startOfMonth, endOfMonth, addWeeks, subWeeks, addMonths, subMonths, startOfWeek, endOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DatePickerCustom } from '@/components/ui/DatePickerCustom';
import { useCarrinhoAnalysisReport, LeadCarrinhoCompleto } from '@/hooks/useCarrinhoAnalysisReport';
import { BusinessUnit } from '@/hooks/useMyBU';
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx';
import { DateRange } from 'react-day-picker';
import { BrazilMap, BrazilMapStateData } from './BrazilMap';

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

  // Filters
  const [filterCloserR1, setFilterCloserR1] = useState('all');
  const [filterCloserR2, setFilterCloserR2] = useState('all');
  const [filterEstado, setFilterEstado] = useState('all');
  const [filterCluster, setFilterCluster] = useState('all');
  const [filterStatusR2, setFilterStatusR2] = useState('all');
  const [filterMotivoGap, setFilterMotivoGap] = useState('all');
  const [filterR2Agendada, setFilterR2Agendada] = useState('all');
  const [filterParceria, setFilterParceria] = useState('all');

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
    return data.leads.filter(l => {
      if (filterCloserR1 !== 'all' && (l.closerR1 || '') !== filterCloserR1) return false;
      if (filterCloserR2 !== 'all' && (l.closerR2 || '') !== filterCloserR2) return false;
      if (filterEstado !== 'all' && l.estado !== filterEstado) return false;
      if (filterCluster !== 'all' && l.cluster !== filterCluster) return false;
      if (filterStatusR2 !== 'all' && (l.statusR2 || '') !== filterStatusR2) return false;
      if (filterMotivoGap !== 'all' && (l.motivoGap || '') !== filterMotivoGap) return false;
      if (filterR2Agendada === 'sim' && !l.r2Agendada) return false;
      if (filterR2Agendada === 'nao' && l.r2Agendada) return false;
      if (filterParceria === 'sim' && !l.comprouParceria) return false;
      if (filterParceria === 'nao' && l.comprouParceria) return false;
      return true;
    });
  }, [data, filterCloserR1, filterCloserR2, filterEstado, filterCluster, filterStatusR2, filterMotivoGap, filterR2Agendada, filterParceria]);

  // Unique values for filters
  const uniqueClosersR1 = useMemo(() => data ? [...new Set(data.leads.map(l => l.closerR1).filter(Boolean) as string[])].sort() : [], [data]);
  const uniqueClosersR2 = useMemo(() => data ? [...new Set(data.leads.map(l => l.closerR2).filter(Boolean) as string[])].sort() : [], [data]);
  const uniqueEstados = useMemo(() => data ? [...new Set(data.leads.map(l => l.estado))].sort() : [], [data]);
  const uniqueStatusR2 = useMemo(() => data ? [...new Set(data.leads.map(l => l.statusR2).filter(Boolean) as string[])].sort() : [], [data]);
  const uniqueMotivos = useMemo(() => data ? [...new Set(data.leads.map(l => l.motivoGap).filter(Boolean) as string[])].sort() : [], [data]);

  const periodLabel = useMemo(() => {
    if (!startDate || !endDate) return 'Selecione um período';
    if (periodType === 'semana') {
      return `Semana: ${format(startDate, 'dd/MM', { locale: ptBR })} - ${format(endDate, 'dd/MM/yyyy', { locale: ptBR })}`;
    }
    if (periodType === 'mes') return format(startDate, 'MMMM yyyy', { locale: ptBR });
    return `${format(startDate, 'dd/MM/yyyy')} - ${format(endDate, 'dd/MM/yyyy')}`;
  }, [startDate, endDate, periodType]);

  const exportExcel = () => {
    if (!filteredLeads.length) return;
    const ws = XLSX.utils.json_to_sheet(filteredLeads.map(l => ({
      Nome: l.nome,
      Telefone: l.telefone,
      Estado: l.estado,
      Cluster: l.cluster,
      'Data A010': l.dataA010 ? format(new Date(l.dataA010), 'dd/MM/yyyy') : '—',
      SDR: l.sdrName || '—',
      'Classificado': l.classificado ? 'Sim' : 'Não',
      'Data R1': l.dataR1 ? format(new Date(l.dataR1), 'dd/MM/yyyy HH:mm') : '—',
      'R1 Realizada': l.r1Realizada ? 'Sim' : 'Não',
      'Closer R1': l.closerR1 || '—',
      'Data Contrato': format(new Date(l.dataContrato), 'dd/MM/yyyy'),
      'Valor Contrato': l.valorContrato,
      'R2 Agendada': l.r2Agendada ? 'Sim' : 'Não',
      'Data R2': l.dataR2 ? format(new Date(l.dataR2), 'dd/MM/yyyy HH:mm') : '—',
      'Closer R2': l.closerR2 || '—',
      'R2 Realizada': l.r2Realizada ? 'Sim' : 'Não',
      'Status R2': l.statusR2 || '—',
      'Parceria': l.comprouParceria ? 'Sim' : 'Não',
      'Reembolso': l.reembolso ? 'Sim' : 'Não',
      'Motivo Gap': l.motivoGap || '—',
      'Tipo Gap': l.tipoGap === 'operacional' ? 'Operacional' : l.tipoGap === 'legitima' ? 'Legítima' : '—',
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Análise Carrinho');
    XLSX.writeFile(wb, `carrinho-analise-${format(startDate!, 'yyyy-MM-dd')}.xlsx`);
  };

  // Audit block data
  const auditData = useMemo(() => {
    if (!data) return null;
    const total = data.kpis.contratosPagos;
    const comR2 = data.kpis.r2Agendadas;
    const semR2 = total - comR2;
    return { total, comR2, semR2, pctComR2: total > 0 ? (comR2 / total) * 100 : 0, pctSemR2: total > 0 ? (semR2 / total) * 100 : 0 };
  }, [data]);

  // Map state data for BrazilMap
  const mapStateData = useMemo(() => {
    if (!data) return [];
    return data.analysisByState.map(s => ({
      uf: s.uf,
      contratos: s.contratos,
      agendados: s.r2Agendadas,
      realizados: s.r2Realizadas,
      perdidos: s.contratos - s.r2Agendadas,
      taxaPerda: s.contratos > 0 ? ((s.contratos - s.r2Agendadas) / s.contratos) * 100 : 0,
    }));
  }, [data]);

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Análise de Carrinho — Funil Completo
          </CardTitle>
          <CardDescription>Acompanhe a jornada do lead desde A010 até a venda da parceria</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1 block">Período</label>
              <Select value={periodType} onValueChange={(v) => setPeriodType(v as PeriodType)}>
                <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="semana">Semana (Qui-Qua)</SelectItem>
                  <SelectItem value="mes">Mês</SelectItem>
                  <SelectItem value="personalizado">Personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {periodType === 'semana' && (
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={() => setWeekDate(d => subWeeks(d, 1))}><ChevronLeft className="h-4 w-4" /></Button>
                <span className="text-sm font-medium min-w-[200px] text-center">{periodLabel}</span>
                <Button variant="outline" size="icon" onClick={() => setWeekDate(d => addWeeks(d, 1))}><ChevronRight className="h-4 w-4" /></Button>
              </div>
            )}
            {periodType === 'mes' && (
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={() => setMonthDate(d => subMonths(d, 1))}><ChevronLeft className="h-4 w-4" /></Button>
                <span className="text-sm font-medium min-w-[200px] text-center capitalize">{periodLabel}</span>
                <Button variant="outline" size="icon" onClick={() => setMonthDate(d => addMonths(d, 1))}><ChevronRight className="h-4 w-4" /></Button>
              </div>
            )}
            {periodType === 'personalizado' && (
              <DatePickerCustom mode="range" selected={customRange} onSelect={(d) => setCustomRange(d as DateRange)} placeholder="Selecione o período" />
            )}
          </div>
        </CardContent>
      </Card>

      {isLoading && (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Carregando dados...</CardContent></Card>
      )}

      {data && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-7 xl:grid-cols-13 gap-2">
            {[
              { label: 'A010', value: data.kpis.entradasA010, color: 'text-slate-600' },
              { label: 'Classificados', value: data.kpis.classificados, color: 'text-blue-600' },
              { label: 'R1 Agend.', value: data.kpis.r1Agendadas, color: 'text-indigo-600' },
              { label: 'R1 Realiz.', value: data.kpis.r1Realizadas, color: 'text-cyan-600' },
              { label: 'Contratos', value: data.kpis.contratosPagos, color: 'text-blue-700' },
              { label: 'R2 Agend.', value: data.kpis.r2Agendadas, color: 'text-amber-600' },
              { label: 'Gap C→R2', value: data.kpis.gapContratoR2, color: 'text-orange-600' },
              { label: 'R2 Realiz.', value: data.kpis.r2Realizadas, color: 'text-green-600' },
              { label: 'Aprovados', value: data.kpis.aprovados, color: 'text-green-700' },
              { label: 'Reprovados', value: data.kpis.reprovados, color: 'text-red-600' },
              { label: 'Próx. Sem.', value: data.kpis.proximaSemana, color: 'text-yellow-600' },
              { label: 'Reembolsos', value: data.kpis.reembolsos, color: 'text-red-500' },
              { label: 'Parcerias', value: data.kpis.parceriasVendidas, color: 'text-emerald-600' },
            ].map((kpi, i) => (
              <Card key={i}>
                <CardContent className="pt-3 pb-2 px-2 text-center">
                  <div className={cn('text-lg font-bold', kpi.color)}>{kpi.value}</div>
                  <div className="text-[10px] text-muted-foreground leading-tight">{kpi.label}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Auditoria Contrato → R2 */}
          {auditData && (
            <Card className="border-orange-200 dark:border-orange-900">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-orange-600" />
                  Auditoria Contrato → R2
                </CardTitle>
                <CardDescription>Gap entre contratos pagos e R2 agendada na semana</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <div className="text-2xl font-bold">{auditData.total}</div>
                    <div className="text-xs text-muted-foreground">Contratos Pagos</div>
                  </div>
                  <div className="text-center p-3 bg-green-50 dark:bg-green-950/30 rounded-lg">
                    <div className="text-2xl font-bold text-green-700 dark:text-green-400">{auditData.comR2}</div>
                    <div className="text-xs text-green-600">Com R2 ({auditData.pctComR2.toFixed(0)}%)</div>
                  </div>
                  <div className="text-center p-3 bg-red-50 dark:bg-red-950/30 rounded-lg">
                    <div className="text-2xl font-bold text-red-700 dark:text-red-400">{auditData.semR2}</div>
                    <div className="text-xs text-red-600">Sem R2 ({auditData.pctSemR2.toFixed(0)}%)</div>
                  </div>
                  <div className="text-center p-3 bg-orange-50 dark:bg-orange-950/30 rounded-lg">
                    <div className="text-2xl font-bold text-orange-700 dark:text-orange-400">
                      {data.motivosPerda.filter(m => m.tipo === 'operacional').reduce((s, m) => s + m.count, 0)}
                    </div>
                    <div className="text-xs text-orange-600">Gap Operacional</div>
                  </div>
                </div>
                {data.motivosPerda.length > 0 && (
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
                          <TableCell className="font-medium text-sm">{m.motivo}</TableCell>
                          <TableCell>
                            <Badge variant={m.tipo === 'operacional' ? 'destructive' : 'secondary'} className="text-xs">
                              {m.tipo === 'operacional' ? 'Operacional' : 'Legítima'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">{m.count}</TableCell>
                          <TableCell className="text-right">{m.pct.toFixed(0)}%</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}

          {/* Funil Visual */}
          <Card>
            <CardHeader><CardTitle className="text-base">Funil do Carrinho</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {data.funnelSteps.map((step, i) => {
                const colors = ['bg-slate-500', 'bg-blue-500', 'bg-indigo-500', 'bg-cyan-500', 'bg-blue-700', 'bg-amber-500', 'bg-green-500', 'bg-emerald-600'];
                return (
                  <div key={i} className="space-y-0.5">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{step.label}</span>
                      <span className="text-muted-foreground">{step.count} ({step.pct.toFixed(0)}%)</span>
                    </div>
                    <div className="h-5 bg-muted rounded-full overflow-hidden">
                      <div className={cn('h-full rounded-full transition-all', colors[i] || 'bg-primary')}
                        style={{ width: `${Math.max(step.pct, 2)}%` }} />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Geo + Map */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><MapPin className="h-4 w-4" /> Análise Geográfica</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>UF</TableHead>
                      <TableHead>Cluster</TableHead>
                      <TableHead className="text-right">Contr.</TableHead>
                      <TableHead className="text-right">R2 Ag.</TableHead>
                      <TableHead className="text-right">R2 Re.</TableHead>
                      <TableHead className="text-right">Aprov.</TableHead>
                      <TableHead className="text-right">Reemb.</TableHead>
                      <TableHead className="text-right">Parc.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.analysisByState.map((s, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{s.uf}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn('text-xs',
                            s.cluster === 'Alto' ? 'border-green-500 text-green-700' :
                            s.cluster === 'Médio' ? 'border-amber-500 text-amber-700' :
                            'border-slate-400 text-slate-600'
                          )}>{s.cluster}</Badge>
                        </TableCell>
                        <TableCell className="text-right">{s.contratos}</TableCell>
                        <TableCell className="text-right">{s.r2Agendadas}</TableCell>
                        <TableCell className="text-right">{s.r2Realizadas}</TableCell>
                        <TableCell className="text-right">{s.aprovados}</TableCell>
                        <TableCell className="text-right">{s.reembolsos}</TableCell>
                        <TableCell className="text-right">{s.parcerias}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Mapa</CardTitle>
              </CardHeader>
              <CardContent>
                <BrazilMap
                  stateData={mapStateData}
                  onStateClick={(uf) => setFilterEstado(prev => prev === uf ? 'all' : uf)}
                  selectedState={filterEstado !== 'all' ? filterEstado : undefined}
                />
              </CardContent>
            </Card>
          </div>

          {/* Tabela Detalhada */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Tabela Detalhada — Todos os Leads</CardTitle>
                  <CardDescription>Jornada completa de cada lead com contrato pago na semana</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={exportExcel} disabled={!filteredLeads.length}>
                  <Download className="h-4 w-4 mr-2" />Exportar Excel
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* Filters */}
              <div className="flex flex-wrap gap-2 mb-4">
                <Select value={filterCloserR1} onValueChange={setFilterCloserR1}>
                  <SelectTrigger className="w-[160px]"><SelectValue placeholder="Closer R1" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Closer R1: Todos</SelectItem>
                    {uniqueClosersR1.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={filterCloserR2} onValueChange={setFilterCloserR2}>
                  <SelectTrigger className="w-[160px]"><SelectValue placeholder="Closer R2" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Closer R2: Todos</SelectItem>
                    {uniqueClosersR2.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={filterEstado} onValueChange={setFilterEstado}>
                  <SelectTrigger className="w-[120px]"><SelectValue placeholder="UF" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">UF: Todos</SelectItem>
                    {uniqueEstados.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={filterCluster} onValueChange={setFilterCluster}>
                  <SelectTrigger className="w-[140px]"><SelectValue placeholder="Cluster" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Cluster: Todos</SelectItem>
                    <SelectItem value="Alto">Alto</SelectItem>
                    <SelectItem value="Médio">Médio</SelectItem>
                    <SelectItem value="Menor">Menor</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterStatusR2} onValueChange={setFilterStatusR2}>
                  <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status R2" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Status R2: Todos</SelectItem>
                    {uniqueStatusR2.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={filterMotivoGap} onValueChange={setFilterMotivoGap}>
                  <SelectTrigger className="w-[180px]"><SelectValue placeholder="Motivo Gap" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Motivo: Todos</SelectItem>
                    {uniqueMotivos.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={filterR2Agendada} onValueChange={setFilterR2Agendada}>
                  <SelectTrigger className="w-[140px]"><SelectValue placeholder="R2?" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">R2: Todos</SelectItem>
                    <SelectItem value="sim">Com R2</SelectItem>
                    <SelectItem value="nao">Sem R2</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterParceria} onValueChange={setFilterParceria}>
                  <SelectTrigger className="w-[140px]"><SelectValue placeholder="Parceria?" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Parceria: Todos</SelectItem>
                    <SelectItem value="sim">Com Parceria</SelectItem>
                    <SelectItem value="nao">Sem Parceria</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Summary badges */}
              <div className="flex flex-wrap gap-2 mb-4">
                <Badge variant="outline" className="text-xs px-2 py-1">{filteredLeads.length} leads</Badge>
                <Badge className="bg-blue-100 text-blue-800 text-xs px-2 py-1">R1: {filteredLeads.filter(l => l.r1Agendada).length}</Badge>
                <Badge className="bg-amber-100 text-amber-800 text-xs px-2 py-1">R2 Ag: {filteredLeads.filter(l => l.r2Agendada).length}</Badge>
                <Badge className="bg-green-100 text-green-800 text-xs px-2 py-1">R2 Re: {filteredLeads.filter(l => l.r2Realizada).length}</Badge>
                <Badge className="bg-emerald-100 text-emerald-800 text-xs px-2 py-1">Parceria: {filteredLeads.filter(l => l.comprouParceria).length}</Badge>
                <Badge className="bg-red-100 text-red-800 text-xs px-2 py-1">Reembolso: {filteredLeads.filter(l => l.reembolso).length}</Badge>
              </div>

              <div className="max-h-[600px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 bg-background z-10">Nome</TableHead>
                      <TableHead>Tel</TableHead>
                      <TableHead>UF</TableHead>
                      <TableHead>Cluster</TableHead>
                      <TableHead>A010</TableHead>
                      <TableHead>SDR</TableHead>
                      <TableHead>Class.</TableHead>
                      <TableHead>R1</TableHead>
                      <TableHead>R1 Re.</TableHead>
                      <TableHead>Closer R1</TableHead>
                      <TableHead>Contrato</TableHead>
                      <TableHead>R2 Ag.</TableHead>
                      <TableHead>Data R2</TableHead>
                      <TableHead>Closer R2</TableHead>
                      <TableHead>R2 Re.</TableHead>
                      <TableHead>Status R2</TableHead>
                      <TableHead>Parceria</TableHead>
                      <TableHead>Reemb.</TableHead>
                      <TableHead>Gap</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLeads.slice(0, 300).map((l, i) => (
                      <TableRow key={i} className={cn(l.reembolso && 'opacity-60')}>
                        <TableCell className="font-medium max-w-[140px] truncate sticky left-0 bg-background z-10">{l.nome}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap">{l.telefone}</TableCell>
                        <TableCell className="text-xs">{l.estado}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn('text-[10px]',
                            l.cluster === 'Alto' ? 'border-green-500 text-green-700' :
                            l.cluster === 'Médio' ? 'border-amber-500 text-amber-700' : 'border-slate-400 text-slate-500'
                          )}>{l.cluster}</Badge>
                        </TableCell>
                        <TableCell className="text-xs">{l.dataA010 ? format(new Date(l.dataA010), 'dd/MM/yy') : '—'}</TableCell>
                        <TableCell className="text-xs max-w-[80px] truncate">{l.sdrName || '—'}</TableCell>
                        <TableCell>{l.classificado ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> : <XCircle className="h-3.5 w-3.5 text-red-400" />}</TableCell>
                        <TableCell className="text-xs">{l.dataR1 ? format(new Date(l.dataR1), 'dd/MM/yy') : '—'}</TableCell>
                        <TableCell>{l.r1Realizada ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> : l.r1Agendada ? <Calendar className="h-3.5 w-3.5 text-amber-500" /> : <span className="text-muted-foreground text-xs">—</span>}</TableCell>
                        <TableCell className="text-xs max-w-[80px] truncate">{l.closerR1 || '—'}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap">{format(new Date(l.dataContrato), 'dd/MM/yy')}</TableCell>
                        <TableCell>{l.r2Agendada ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> : <XCircle className="h-3.5 w-3.5 text-red-400" />}</TableCell>
                        <TableCell className="text-xs">{l.dataR2 ? format(new Date(l.dataR2), 'dd/MM/yy HH:mm') : '—'}</TableCell>
                        <TableCell className="text-xs max-w-[80px] truncate">{l.closerR2 || '—'}</TableCell>
                        <TableCell>{l.r2Realizada ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> : l.r2Agendada ? <Calendar className="h-3.5 w-3.5 text-amber-500" /> : <span className="text-muted-foreground text-xs">—</span>}</TableCell>
                        <TableCell className="text-xs">{l.statusR2 || '—'}</TableCell>
                        <TableCell>
                          {l.comprouParceria ? (
                            <Badge className="bg-green-100 text-green-800 text-[10px]">
                              Sim {l.dataParceria ? format(new Date(l.dataParceria), 'dd/MM') : ''}
                            </Badge>
                          ) : <span className="text-muted-foreground text-xs">—</span>}
                        </TableCell>
                        <TableCell>
                          {l.reembolso ? <Badge variant="destructive" className="text-[10px]">Sim</Badge> : <span className="text-muted-foreground text-xs">—</span>}
                        </TableCell>
                        <TableCell>
                          {l.motivoGap ? (
                            <Badge variant={l.tipoGap === 'operacional' ? 'destructive' : 'secondary'} className="text-[10px] whitespace-nowrap">
                              {l.motivoGap}
                            </Badge>
                          ) : <span className="text-muted-foreground text-xs">—</span>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {filteredLeads.length > 300 && (
                  <p className="text-sm text-muted-foreground text-center mt-2">Mostrando 300 de {filteredLeads.length} leads. Exporte para ver todos.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
