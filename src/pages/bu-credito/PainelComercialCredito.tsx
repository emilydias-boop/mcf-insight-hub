import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { endOfDay, endOfMonth, endOfWeek, format, startOfDay, startOfMonth, startOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  AlertCircle,
  AlertTriangle,
  Banknote,
  Briefcase,
  CalendarCheck,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Receipt,
  RefreshCw,
  TrendingUp,
  Users,
  XCircle,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DatePickerCustom } from '@/components/ui/DatePickerCustom';
import { LeadSegmentBadge } from '@/components/crm/LeadSegmentBadge';
import { TeamKPICards, type TeamKpiCardDefinition } from '@/components/sdr/TeamKPICards';
import { getWeekStartsOn } from '@/lib/businessDays';
import { parseYearMonthLocal, parseYmdLocal } from '@/lib/dateHelpers';
import { loadXLSX } from '@/lib/lazyExport';

// ============= Tipos do retorno da RPC painel_comercial_credito =============

interface PCPeriodo {
  from: string;
  to: string;
  fuso: string;
}

interface PCTotais {
  leads_criados: number | string;
  agendadas: number | string;
  realizadas: number | string;
  no_show: number | string;
  pendentes: number | string;
  vendas: number | string;
  volume_financiado: number | string;
  ticket_medio: number | string;
}

interface PCSdr {
  sdr_id: string | null;
  name: string | null;
  agendadas: number | string;
  realizadas: number | string;
  no_show: number | string;
  pendentes: number | string;
  agendadas_icp: number | string;
  vendas: number | string;
}

interface PCCloser {
  closer_id: string | null;
  name: string | null;
  email: string | null;
  color: string | null;
  is_active: boolean;
  agendadas: number | string;
  realizadas: number | string;
  no_show: number | string;
  pendentes: number | string;
  vendas: number | string;
  volume_financiado: number | string;
}

interface PCIcp {
  segmento: 'ICP' | 'Parcial' | 'Fora do ICP' | 'Sem qualificação';
  leads_criados: number | string;
  agendadas: number | string;
  realizadas: number | string;
  vendas: number | string;
  volume_financiado: number | string;
}

interface PCOrigem {
  tag: string;
  label: string;
  leads_criados: number | string;
  agendadas: number | string;
  realizadas: number | string;
  vendas: number | string;
  volume_financiado: number | string;
}

interface PCBanco {
  banco: string;
  modalidade: string;
  vendas: number | string;
  volume: number | string;
}

interface PCResult {
  periodo: PCPeriodo;
  totais: PCTotais;
  por_sdr: PCSdr[];
  por_closer: PCCloser[];
  por_icp: PCIcp[];
  por_origem: PCOrigem[];
  por_banco: PCBanco[];
}

// ============= Helpers =============

const num = (v: number | string | null | undefined): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const fmtBRL = (v: number | string | null | undefined): string =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(num(v));

const fmtInt = (v: number | string | null | undefined): string =>
  new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(num(v));

const fmtPct = (parte: number, total: number): string =>
  total > 0 ? `${((parte / total) * 100).toFixed(1)}%` : '—';

const fmtYmd = (d: Date): string => format(d, 'yyyy-MM-dd');

type Preset = 'today' | 'week' | 'month' | 'custom';
type ActiveTab = 'sdrs' | 'closers';
type IcpMetric = 'leads_criados' | 'agendadas' | 'realizadas' | 'vendas';

// ============= Página =============

export default function PainelComercialCredito() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialPreset = (searchParams.get('preset') as Preset) || 'month';
  const initialMonth = parseYearMonthLocal(searchParams.get('month')) ?? new Date();
  const initialStart = parseYmdLocal(searchParams.get('start'));
  const initialEnd = parseYmdLocal(searchParams.get('end')) ?? initialStart;

  const [datePreset, setDatePreset] = useState<Preset>(initialPreset);
  const [selectedMonth, setSelectedMonth] = useState(initialMonth);
  const [customStartDate, setCustomStartDate] = useState<Date | null>(initialStart);
  const [customEndDate, setCustomEndDate] = useState<Date | null>(initialEnd);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [activeTab, setActiveTab] = useState<ActiveTab>('sdrs');

  const updateUrlParams = (preset: Preset, month?: Date, startDate?: Date | null, endDate?: Date | null) => {
    const params = new URLSearchParams(searchParams);
    params.set('preset', preset);
    if (preset === 'month' && month) {
      params.set('month', format(month, 'yyyy-MM'));
      params.delete('start');
      params.delete('end');
    } else if (preset === 'custom') {
      params.delete('month');
      if (startDate) params.set('start', fmtYmd(startDate));
      else params.delete('start');
      if (endDate) params.set('end', fmtYmd(endDate));
      else params.delete('end');
    } else {
      params.delete('month');
      params.delete('start');
      params.delete('end');
    }
    setSearchParams(params, { replace: true });
  };

  const getDateRange = () => {
    const today = new Date();
    if (datePreset === 'today') return { start: startOfDay(today), end: endOfDay(today) };
    if (datePreset === 'week') {
      const weekStartsOn = getWeekStartsOn('credito');
      return {
        start: startOfWeek(startOfDay(today), { weekStartsOn }),
        end: endOfWeek(startOfDay(today), { weekStartsOn }),
      };
    }
    if (datePreset === 'custom') {
      const customStart = customStartDate ?? startOfMonth(today);
      const customEnd = customEndDate ?? customStartDate ?? endOfMonth(today);
      const start = startOfDay(customStart);
      const end = endOfDay(customEnd);
      return start > end ? { start: end, end: start } : { start, end };
    }
    return { start: startOfMonth(selectedMonth), end: endOfMonth(selectedMonth) };
  };

  const { start, end } = getDateRange();
  const fromStr = fmtYmd(start);
  const toStr = fmtYmd(end);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['painel-comercial-credito', fromStr, toStr],
    staleTime: 60_000,
    queryFn: async (): Promise<PCResult> => {
      const { data: res, error } = await (supabase.rpc as any)('painel_comercial_credito', {
        p_from: fromStr,
        p_to: toStr,
      });
      if (error) throw error;
      return res as PCResult;
    },
  });

  const totais = data?.totais;
  const t = useMemo(() => ({
    leads: num(totais?.leads_criados),
    agendadas: num(totais?.agendadas),
    realizadas: num(totais?.realizadas),
    noShow: num(totais?.no_show),
    pendentes: num(totais?.pendentes),
    vendas: num(totais?.vendas),
    volume: num(totais?.volume_financiado),
    ticket: num(totais?.ticket_medio),
  }), [totais]);

  const segLine = (metric: IcpMetric) => {
    const find = (segmento: PCIcp['segmento']) =>
      num(data?.por_icp.find((row) => row.segmento === segmento)?.[metric]);
    return `ICP ${fmtInt(find('ICP'))} · Parcial ${fmtInt(find('Parcial'))} · Fora ${fmtInt(find('Fora do ICP'))} · s/qualif. ${fmtInt(find('Sem qualificação'))}`;
  };

  const customCards = useMemo<TeamKpiCardDefinition[]>(() => [
    {
      title: 'Leads criados',
      value: fmtInt(t.leads),
      icon: Users,
      color: 'text-sky-500',
      bgColor: 'bg-sky-500/10',
      tooltip: 'Negócios do Crédito criados no período. O segmento ICP vem da qualificação preenchida pelo SDR.',
      segLine: segLine('leads_criados'),
    },
    {
      title: 'R1 Agendada',
      value: fmtInt(t.agendadas),
      icon: CalendarCheck,
      color: 'text-cyan-500',
      bgColor: 'bg-cyan-500/10',
      tooltip: 'Reuniões R1 marcadas para o período, pela data e horário da reunião. O segmento ICP vem da qualificação do SDR.',
      segLine: segLine('agendadas'),
    },
    {
      title: 'R1 Realizada',
      value: fmtInt(t.realizadas),
      icon: CheckCircle,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
      tooltip: 'Reuniões R1 realizadas no período, pela data e horário da reunião. O segmento ICP vem da qualificação do SDR.',
      segLine: segLine('realizadas'),
    },
    {
      title: 'No-Shows',
      value: fmtInt(t.noShow),
      icon: XCircle,
      color: 'text-red-500',
      bgColor: 'bg-red-500/10',
      tooltip: 'Faltas registradas nas reuniões R1 marcadas para o período.',
    },
    ...(t.pendentes > 0 ? [{
      title: 'Pendentes / Sem Desfecho',
      value: fmtInt(t.pendentes),
      icon: AlertCircle,
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-500/10',
      tooltip: 'Reuniões R1 do período que ainda não têm desfecho registrado.',
    }] : []),
    {
      title: 'Vendas de Crédito',
      value: fmtInt(t.vendas),
      icon: FileText,
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10',
      tooltip: 'Vendas de Crédito contadas pela data de assinatura do contrato. O segmento ICP vem da qualificação do SDR.',
      segLine: segLine('vendas'),
    },
    {
      title: 'Volume Financiado',
      value: fmtBRL(t.volume),
      icon: Banknote,
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-500/10',
      tooltip: 'Soma do volume financiado das vendas cuja assinatura ocorreu no período.',
    },
    {
      title: 'Ticket Médio',
      value: fmtBRL(t.ticket),
      icon: Receipt,
      color: 'text-lime-500',
      bgColor: 'bg-lime-500/10',
      tooltip: 'Volume financiado dividido pela quantidade de vendas de Crédito no período.',
    },
    {
      title: 'Taxa Conversão',
      value: fmtPct(t.vendas, t.realizadas),
      icon: TrendingUp,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
      tooltip: 'Vendas de Crédito ÷ reuniões R1 realizadas × 100.',
    },
    {
      title: 'Taxa No-Show',
      value: fmtPct(t.noShow, t.agendadas),
      icon: AlertTriangle,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
      tooltip: 'No-shows ÷ reuniões R1 agendadas × 100.',
    },
  ], [data?.por_icp, t]);

  const sdrTotals = useMemo(() => (data?.por_sdr ?? []).reduce((acc, row) => ({
    agendadas: acc.agendadas + num(row.agendadas),
    agendadasIcp: acc.agendadasIcp + num(row.agendadas_icp),
    realizadas: acc.realizadas + num(row.realizadas),
    noShow: acc.noShow + num(row.no_show),
    vendas: acc.vendas + num(row.vendas),
  }), { agendadas: 0, agendadasIcp: 0, realizadas: 0, noShow: 0, vendas: 0 }), [data?.por_sdr]);

  const closerTotals = useMemo(() => (data?.por_closer ?? []).reduce((acc, row) => ({
    agendadas: acc.agendadas + num(row.agendadas),
    realizadas: acc.realizadas + num(row.realizadas),
    noShow: acc.noShow + num(row.no_show),
    vendas: acc.vendas + num(row.vendas),
    volume: acc.volume + num(row.volume_financiado),
  }), { agendadas: 0, realizadas: 0, noShow: 0, vendas: 0, volume: 0 }), [data?.por_closer]);

  const handlePresetChange = (preset: Preset) => {
    setDatePreset(preset);
    updateUrlParams(preset, selectedMonth, customStartDate, customEndDate);
  };

  const handleMonthChange = (increment: number) => {
    const next = new Date(selectedMonth);
    next.setMonth(next.getMonth() + increment);
    setSelectedMonth(next);
    updateUrlParams('month', next, null, null);
  };

  const handleCustomStartChange = (date: Date | null) => {
    setCustomStartDate(date);
    updateUrlParams('custom', selectedMonth, date, customEndDate);
  };

  const handleCustomEndChange = (date: Date | null) => {
    setCustomEndDate(date);
    updateUrlParams('custom', selectedMonth, customStartDate, date);
  };

  const handleExportExcel = async () => {
    if (!data) return;
    const XLSX = await loadXLSX();
    const workbook = XLSX.utils.book_new();

    if (activeTab === 'sdrs') {
      const rows = data.por_sdr.map((row) => ({
        SDR: row.name ?? 'Sem SDR',
        Agendadas: num(row.agendadas),
        'das quais ICP': num(row.agendadas_icp),
        Realizadas: num(row.realizadas),
        'No-show': num(row.no_show),
        'Comparecimento %': fmtPct(num(row.realizadas), num(row.realizadas) + num(row.no_show)),
        Vendas: num(row.vendas),
      }));
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), 'Resumo SDR');
    } else {
      const rows = data.por_closer.map((row) => ({
        Closer: row.name ?? 'Sem closer',
        Ativo: row.is_active ? 'Sim' : 'Não',
        Agendadas: num(row.agendadas),
        Realizadas: num(row.realizadas),
        'No-show': num(row.no_show),
        'Comparecimento %': fmtPct(num(row.realizadas), num(row.realizadas) + num(row.no_show)),
        Vendas: num(row.vendas),
        Volume: num(row.volume_financiado),
        'Conversão %': fmtPct(num(row.vendas), num(row.realizadas)),
      }));
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), 'Resumo Closers');
    }

    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(data.por_icp.map((row) => ({
      Segmento: row.segmento,
      Leads: num(row.leads_criados),
      Agendadas: num(row.agendadas),
      Realizadas: num(row.realizadas),
      Vendas: num(row.vendas),
      Volume: num(row.volume_financiado),
    }))), 'ICP');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(data.por_origem.map((row) => ({
      Origem: row.label,
      Leads: num(row.leads_criados),
      Agendadas: num(row.agendadas),
      Realizadas: num(row.realizadas),
      Vendas: num(row.vendas),
      Volume: num(row.volume_financiado),
    }))), 'Origem');
    XLSX.writeFile(workbook, `painel_credito_${format(start, 'yyyyMMdd')}_${format(end, 'yyyyMMdd')}.xlsx`);
  };

  const EmptyRow = ({ cols }: { cols: number }) => (
    <TableRow>
      <TableCell colSpan={cols} className="py-8 text-center text-muted-foreground">
        Sem dados no período
      </TableCell>
    </TableRow>
  );

  return (
    <div className="space-y-4 sm:space-y-6 p-3 sm:p-6">
      <h1 className="text-lg font-semibold text-foreground sm:text-xl">Painel Comercial — Crédito Imobiliário</h1>

      <Card className="bg-card border-border">
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-1 bg-muted rounded-lg p-1 w-full sm:w-auto">
              {([
                ['today', 'Hoje'],
                ['week', 'Semana'],
                ['month', 'Mês'],
                ['custom', 'Custom'],
              ] as const).map(([value, label]) => (
                <Button
                  key={value}
                  variant={datePreset === value ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => handlePresetChange(value)}
                  className="flex-1 sm:flex-initial text-xs sm:text-sm"
                >
                  {label}
                </Button>
              ))}
            </div>

            {datePreset === 'month' && (
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={() => handleMonthChange(-1)} aria-label="Mês anterior">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-medium min-w-[120px] text-center capitalize">
                  {format(selectedMonth, 'MMMM yyyy', { locale: ptBR })}
                </span>
                <Button variant="outline" size="icon" onClick={() => handleMonthChange(1)} aria-label="Próximo mês">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}

            {datePreset === 'custom' && (
              <div className="flex items-center gap-2">
                <DatePickerCustom
                  selected={customStartDate ?? undefined}
                  onSelect={(date) => handleCustomStartChange(date as Date | null)}
                  placeholder="Data início"
                />
                <span className="text-muted-foreground">até</span>
                <DatePickerCustom
                  selected={customEndDate ?? undefined}
                  onSelect={(date) => handleCustomEndChange(date as Date | null)}
                  placeholder="Data fim"
                />
              </div>
            )}

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  void refetch();
                  setLastRefresh(new Date());
                }}
                disabled={isFetching}
              >
                <RefreshCw className={`h-4 w-4 mr-1 ${isFetching ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={isLoading || !data}>
                <Download className="h-4 w-4 mr-1" />
                Exportar
              </Button>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
            <span>Período: {format(start, 'dd/MM/yyyy')} - {format(end, 'dd/MM/yyyy')}</span>
            <span>Atualizado às {format(lastRefresh, 'HH:mm')}</span>
          </div>
        </CardContent>
      </Card>

      {isLoading && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-5">
            {Array.from({ length: 10 }).map((_, index) => <Skeleton key={index} className="h-24 w-full" />)}
          </div>
          <Skeleton className="h-72 w-full" />
        </div>
      )}

      {isError && !isLoading && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs sm:text-sm text-destructive flex items-center justify-between gap-3">
          <span>Não foi possível carregar os dados do painel.</span>
          <Button size="sm" variant="outline" onClick={() => void refetch()}>
            <RefreshCw className="h-3 w-3 mr-1" />
            Tentar novamente
          </Button>
        </div>
      )}

      {data && !isLoading && (
        <>
          <TeamKPICards kpis={{} as any} customCards={customCards} isLoading={isLoading} />

          <Card className="bg-card border-border overflow-hidden">
            <CardHeader className="pb-2 sm:pb-3 px-3 sm:px-6">
              <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as ActiveTab)}>
                <TabsList className="bg-muted/50 w-full sm:w-auto">
                  <TabsTrigger value="sdrs" className="flex-1 sm:flex-initial flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
                    <Users className="h-3 w-3 sm:h-4 sm:w-4" />
                    SDRs
                    <span className="text-[10px] sm:text-xs text-muted-foreground">({data.por_sdr.length})</span>
                  </TabsTrigger>
                  <TabsTrigger value="closers" className="flex-1 sm:flex-initial flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
                    <Briefcase className="h-3 w-3 sm:h-4 sm:w-4" />
                    Closers
                    <span className="text-[10px] sm:text-xs text-muted-foreground">({data.por_closer.length})</span>
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </CardHeader>
            <CardContent className="pt-0 px-0 sm:px-6 pb-3 sm:pb-6 overflow-x-auto">
              {activeTab === 'sdrs' ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SDR</TableHead>
                      <TableHead className="text-right">Agendadas</TableHead>
                      <TableHead className="text-right">das quais ICP</TableHead>
                      <TableHead className="text-right">Realizadas</TableHead>
                      <TableHead className="text-right">No-show</TableHead>
                      <TableHead className="text-right">Comparecimento %</TableHead>
                      <TableHead className="text-right">Vendas</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.por_sdr.length === 0 && <EmptyRow cols={7} />}
                    {data.por_sdr.map((row, index) => (
                      <TableRow key={row.sdr_id ?? `sem-sdr-${index}`}>
                        <TableCell className="font-medium">{row.name ?? 'Sem SDR'}</TableCell>
                        <TableCell className="text-right">{fmtInt(row.agendadas)}</TableCell>
                        <TableCell className="text-right">{fmtInt(row.agendadas_icp)}</TableCell>
                        <TableCell className="text-right">{fmtInt(row.realizadas)}</TableCell>
                        <TableCell className="text-right">{fmtInt(row.no_show)}</TableCell>
                        <TableCell className="text-right">{fmtPct(num(row.realizadas), num(row.realizadas) + num(row.no_show))}</TableCell>
                        <TableCell className="text-right">{fmtInt(row.vendas)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  {data.por_sdr.length > 0 && (
                    <TableFooter className="bg-muted/30 font-bold">
                      <TableRow>
                        <TableCell>Total</TableCell>
                        <TableCell className="text-right">{fmtInt(sdrTotals.agendadas)}</TableCell>
                        <TableCell className="text-right">{fmtInt(sdrTotals.agendadasIcp)}</TableCell>
                        <TableCell className="text-right">{fmtInt(sdrTotals.realizadas)}</TableCell>
                        <TableCell className="text-right">{fmtInt(sdrTotals.noShow)}</TableCell>
                        <TableCell className="text-right">{fmtPct(sdrTotals.realizadas, sdrTotals.realizadas + sdrTotals.noShow)}</TableCell>
                        <TableCell className="text-right">{fmtInt(sdrTotals.vendas)}</TableCell>
                      </TableRow>
                    </TableFooter>
                  )}
                </Table>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Closer</TableHead>
                      <TableHead className="text-right">Agendadas</TableHead>
                      <TableHead className="text-right">Realizadas</TableHead>
                      <TableHead className="text-right">No-show</TableHead>
                      <TableHead className="text-right">Comparecimento %</TableHead>
                      <TableHead className="text-right">Vendas</TableHead>
                      <TableHead className="text-right">Volume</TableHead>
                      <TableHead className="text-right">Conversão %</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.por_closer.length === 0 && <EmptyRow cols={8} />}
                    {data.por_closer.map((row, index) => (
                      <TableRow key={row.closer_id ?? `sem-closer-${index}`}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span
                              className="inline-block h-2.5 w-2.5 rounded-full bg-muted-foreground"
                              style={row.color ? { backgroundColor: row.color } : undefined}
                            />
                            <span className="font-medium">{row.name ?? 'Sem closer'}</span>
                            {!row.is_active && <Badge variant="secondary">Inativo</Badge>}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{fmtInt(row.agendadas)}</TableCell>
                        <TableCell className="text-right">{fmtInt(row.realizadas)}</TableCell>
                        <TableCell className="text-right">{fmtInt(row.no_show)}</TableCell>
                        <TableCell className="text-right">{fmtPct(num(row.realizadas), num(row.realizadas) + num(row.no_show))}</TableCell>
                        <TableCell className="text-right">{fmtInt(row.vendas)}</TableCell>
                        <TableCell className="text-right">{fmtBRL(row.volume_financiado)}</TableCell>
                        <TableCell className="text-right">{fmtPct(num(row.vendas), num(row.realizadas))}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  {data.por_closer.length > 0 && (
                    <TableFooter className="bg-muted/30 font-bold">
                      <TableRow>
                        <TableCell>Total</TableCell>
                        <TableCell className="text-right">{fmtInt(closerTotals.agendadas)}</TableCell>
                        <TableCell className="text-right">{fmtInt(closerTotals.realizadas)}</TableCell>
                        <TableCell className="text-right">{fmtInt(closerTotals.noShow)}</TableCell>
                        <TableCell className="text-right">{fmtPct(closerTotals.realizadas, closerTotals.realizadas + closerTotals.noShow)}</TableCell>
                        <TableCell className="text-right">{fmtInt(closerTotals.vendas)}</TableCell>
                        <TableCell className="text-right">{fmtBRL(closerTotals.volume)}</TableCell>
                        <TableCell className="text-right">{fmtPct(closerTotals.vendas, closerTotals.realizadas)}</TableCell>
                      </TableRow>
                    </TableFooter>
                  )}
                </Table>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="bg-card border-border">
              <CardHeader className="px-4 pb-2 pt-4 text-sm font-semibold">Por qualificação (ICP)</CardHeader>
              <CardContent className="overflow-x-auto px-0 pb-3">
                <Table className="text-xs">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Segmento</TableHead>
                      <TableHead className="text-right text-xs">Leads</TableHead>
                      <TableHead className="text-right text-xs">Agend.</TableHead>
                      <TableHead className="text-right text-xs">Realiz.</TableHead>
                      <TableHead className="text-right text-xs">Vendas</TableHead>
                      <TableHead className="text-right text-xs">Volume</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.por_icp.length === 0 && <EmptyRow cols={6} />}
                    {data.por_icp.map((row) => (
                      <TableRow key={row.segmento}>
                        <TableCell>
                          {row.segmento === 'Sem qualificação'
                            ? <span className="text-muted-foreground">Sem qualificação</span>
                            : <LeadSegmentBadge segment={row.segmento} />}
                        </TableCell>
                        <TableCell className="text-right">{fmtInt(row.leads_criados)}</TableCell>
                        <TableCell className="text-right">{fmtInt(row.agendadas)}</TableCell>
                        <TableCell className="text-right">{fmtInt(row.realizadas)}</TableCell>
                        <TableCell className="text-right">{fmtInt(row.vendas)}</TableCell>
                        <TableCell className="text-right">{fmtBRL(row.volume_financiado)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader className="px-4 pb-2 pt-4 text-sm font-semibold">Por origem</CardHeader>
              <CardContent className="overflow-x-auto px-0 pb-3">
                <Table className="text-xs">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Origem</TableHead>
                      <TableHead className="text-right text-xs">Leads</TableHead>
                      <TableHead className="text-right text-xs">Agend.</TableHead>
                      <TableHead className="text-right text-xs">Realiz.</TableHead>
                      <TableHead className="text-right text-xs">Vendas</TableHead>
                      <TableHead className="text-right text-xs">Volume</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.por_origem.length === 0 && <EmptyRow cols={6} />}
                    {data.por_origem.map((row) => (
                      <TableRow key={row.tag}>
                        <TableCell className="font-medium">{row.label}</TableCell>
                        <TableCell className="text-right">{fmtInt(row.leads_criados)}</TableCell>
                        <TableCell className="text-right">{fmtInt(row.agendadas)}</TableCell>
                        <TableCell className="text-right">{fmtInt(row.realizadas)}</TableCell>
                        <TableCell className="text-right">{fmtInt(row.vendas)}</TableCell>
                        <TableCell className="text-right">{fmtBRL(row.volume_financiado)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader className="px-4 pb-2 pt-4 text-sm font-semibold">Por banco e modalidade</CardHeader>
              <CardContent className="overflow-x-auto px-0 pb-3">
                <Table className="text-xs">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Banco</TableHead>
                      <TableHead className="text-xs">Modalidade</TableHead>
                      <TableHead className="text-right text-xs">Vendas</TableHead>
                      <TableHead className="text-right text-xs">Volume</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.por_banco.length === 0 && <EmptyRow cols={4} />}
                    {data.por_banco.map((row, index) => (
                      <TableRow key={`${row.banco}-${row.modalidade}-${index}`}>
                        <TableCell className="font-medium">{row.banco}</TableCell>
                        <TableCell>{row.modalidade}</TableCell>
                        <TableCell className="text-right">{fmtInt(row.vendas)}</TableCell>
                        <TableCell className="text-right">{fmtBRL(row.volume)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
