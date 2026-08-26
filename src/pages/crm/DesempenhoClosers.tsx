import { useMemo, useState } from 'react';
import { format, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CalendarIcon,
  Info,
  Printer,
  TrendingUp,
} from 'lucide-react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { RoleGuard } from '@/components/auth/RoleGuard';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';
import {
  bucketDate,
  Granularidade,
  SegmentoFiltro,
  TemaIA,
  useClosersSlots,
  useEtapasVendaVsNaoVenda,
  useRelatorioCloserEtapas,
  useRelatorioCloserResumo,
  useRelatorioClosersSerie,
  useResumoIA,
} from '@/hooks/useRelatorioClosers';

const CORES = [
  'hsl(217 91% 60%)',
  'hsl(142 71% 45%)',
  'hsl(38 92% 50%)',
  'hsl(0 84% 60%)',
  'hsl(280 65% 60%)',
  'hsl(190 80% 42%)',
  'hsl(24 90% 55%)',
  'hsl(340 75% 55%)',
  'hsl(160 60% 40%)',
  'hsl(255 60% 65%)',
];

const n0 = (v: number) => Math.round(v || 0).toLocaleString('pt-BR');
const n1 = (v: number | null | undefined) =>
  v === null || v === undefined || Number.isNaN(v) ? '—' : (Math.round(v * 10) / 10).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

type SortKey = 'closer' | 'reunioes' | 'participantes' | 'contratos' | 'conversao' | 'nota' | 'cobertura';

function nomeCurto(email: string, nome?: string | null) {
  if (nome) return nome.split(' ').slice(0, 2).join(' ');
  return email.split('@')[0];
}

function DesempenhoClosersContent() {
  const hoje = new Date();
  const [de, setDe] = useState<string>(format(subDays(hoje, 29), 'yyyy-MM-dd'));
  const [ate, setAte] = useState<string>(format(hoje, 'yyyy-MM-dd'));
  const [gran, setGran] = useState<Granularidade>('day');
  const [segmento, setSegmento] = useState<SegmentoFiltro>('todos');
  const [metricaNota, setMetricaNota] = useState<'nota' | 'aderencia'>('nota');
  const [isolado, setIsolado] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('contratos');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [drawerCloser, setDrawerCloser] = useState<{ id: string; email: string; nome: string } | null>(null);

  const serieQ = useRelatorioClosersSerie(de, ate, gran, segmento);
  const slotsQ = useClosersSlots(de, ate, segmento);

  const aplicarAtalho = (dias: number) => {
    setDe(format(subDays(new Date(), dias - 1), 'yyyy-MM-dd'));
    setAte(format(new Date(), 'yyyy-MM-dd'));
  };

  const slots = slotsQ.data ?? [];
  const serie = serieQ.data ?? [];

  const vendasPorSlot = useMemo(() => {
    const m = new Map<string, boolean>();
    slots.forEach((s) => m.set(s.id, s.teveContrato));
    return m;
  }, [slots]);

  const diffQ = useEtapasVendaVsNaoVenda(de, ate, segmento, vendasPorSlot);

  // ---- Agregações por closer (totais de meeting_slots) ----
  const porCloser = useMemo(() => {
    const map = new Map<
      string,
      { email: string; nome: string; ativo: boolean; reunioes: number; contratos: number; participantes: number }
    >();
    slots.forEach((s) => {
      const cur =
        map.get(s.closer_email) ?? {
          email: s.closer_email,
          nome: nomeCurto(s.closer_email, s.closer_name),
          ativo: s.closer_ativo,
          reunioes: 0,
          contratos: 0,
          participantes: 0,
        };
      cur.reunioes += 1;
      cur.contratos += s.contratos;
      cur.participantes += s.participantes;
      cur.ativo = s.closer_ativo;
      map.set(s.closer_email, cur);
    });

    // avaliadas + nota da RPC
    const aval = new Map<string, { id: string; avaliadas: number; somaNota: number; nNota: number }>();
    serie.forEach((r) => {
      const cur = aval.get(r.closer_email) ?? { id: r.closer_id, avaliadas: 0, somaNota: 0, nNota: 0 };
      cur.avaliadas += r.reunioes;
      if (r.nota_media !== null) {
        cur.somaNota += r.nota_media * r.reunioes;
        cur.nNota += r.reunioes;
      }
      aval.set(r.closer_email, cur);
    });

    const emails = new Set<string>([...map.keys(), ...aval.keys()]);
    return Array.from(emails).map((email) => {
      const base = map.get(email) ?? { email, nome: nomeCurto(email), ativo: true, reunioes: 0, contratos: 0, participantes: 0 };
      const a = aval.get(email);
      return {
        ...base,
        closerId: a?.id ?? null,
        avaliadas: a?.avaliadas ?? 0,
        nota: a && a.nNota > 0 ? a.somaNota / a.nNota : null,
        conversao: base.participantes > 0 ? (base.contratos / base.participantes) * 100 : 0,
        cobertura: base.reunioes > 0 ? ((a?.avaliadas ?? 0) / base.reunioes) * 100 : 0,
      };
    });
  }, [slots, serie]);

  const corPorCloser = useMemo(() => {
    const ordenados = [...porCloser].sort((a, b) => b.contratos - a.contratos).map((c) => c.email);
    const m: Record<string, string> = {};
    ordenados.forEach((e, i) => (m[e] = CORES[i % CORES.length]));
    return m;
  }, [porCloser]);

  const resumo = useMemo(() => {
    const reunioes = slots.length;
    const contratos = slots.reduce((acc, s) => acc + s.contratos, 0);
    const participantes = slots.reduce((acc, s) => acc + s.participantes, 0);
    const avaliadas = serie.reduce((acc, r) => acc + r.reunioes, 0);
    const somaNota = serie.reduce((acc, r) => acc + (r.nota_media ?? 0) * r.reunioes, 0);
    const nNota = serie.reduce((acc, r) => acc + (r.nota_media !== null ? r.reunioes : 0), 0);
    return {
      reunioes,
      contratos,
      participantes,
      conversao: participantes > 0 ? (contratos / participantes) * 100 : 0,
      nota: nNota > 0 ? somaNota / nNota : null,
      cobertura: reunioes > 0 ? (avaliadas / reunioes) * 100 : 0,
    };
  }, [slots, serie]);

  // ---- Séries dos gráficos ----
  const dadosContratos = useMemo(() => {
    const map = new Map<string, Record<string, number | string>>();
    slots.forEach((s) => {
      const b = bucketDate(s.ymd, gran);
      const row = map.get(b) ?? { periodo: b };
      row[s.closer_email] = ((row[s.closer_email] as number) ?? 0) + s.contratos;
      map.set(b, row);
    });
    return Array.from(map.values()).sort((a, b) => String(a.periodo).localeCompare(String(b.periodo)));
  }, [slots, gran]);

  const dadosNota = useMemo(() => {
    const map = new Map<string, Record<string, number | string>>();
    serie.forEach((r) => {
      const b = String(r.periodo).slice(0, 10);
      const row = map.get(b) ?? { periodo: b };
      const val = metricaNota === 'nota' ? r.nota_media : r.aderencia_media;
      if (val !== null && val !== undefined) row[r.closer_email] = Math.round(val * 10) / 10;
      map.set(b, row);
    });
    return Array.from(map.values()).sort((a, b) => String(a.periodo).localeCompare(String(b.periodo)));
  }, [serie, metricaNota]);

  const closersVisiveis = porCloser.filter((c) => !isolado || c.email === isolado);

  const rankingOrdenado = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...porCloser].sort((a, b) => {
      switch (sortKey) {
        case 'closer':
          return a.nome.localeCompare(b.nome) * dir;
        case 'reunioes':
          return (a.reunioes - b.reunioes) * dir;
        case 'participantes':
          return (a.participantes - b.participantes) * dir;
        case 'conversao':
          return (a.conversao - b.conversao) * dir;
        case 'nota':
          return ((a.nota ?? -1) - (b.nota ?? -1)) * dir;
        case 'cobertura':
          return (a.cobertura - b.cobertura) * dir;
        default:
          return (a.contratos - b.contratos) * dir;
      }
    });
  }, [porCloser, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const etapasQ = useRelatorioCloserEtapas(drawerCloser?.id ?? null, de, ate, segmento);
  const resumoQ = useRelatorioCloserResumo(de, ate, segmento);
  const nomePorEmail = useMemo(() => {
    const m = new Map<string, string>();
    porCloser.forEach((c) => m.set(c.email, c.nome));
    return m;
  }, [porCloser]);
  const etapasOrdenadas = useMemo(
    () => [...(etapasQ.data ?? [])].sort((a, b) => b.pct_falha - a.pct_falha),
    [etapasQ.data],
  );

  const rotuloPeriodo = `${format(new Date(`${de}T12:00:00`), 'dd/MM/yyyy', { locale: ptBR })} — ${format(new Date(`${ate}T12:00:00`), 'dd/MM/yyyy', { locale: ptBR })}`;

  const loading = serieQ.isLoading || slotsQ.isLoading;

  const SortHead = ({ k, children, className }: { k: SortKey; children: React.ReactNode; className?: string }) => (
    <TableHead className={cn('cursor-pointer select-none', className)} onClick={() => toggleSort(k)}>
      <span className="inline-flex items-center gap-1">
        {children}
        {sortKey === k &&
          (sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
      </span>
    </TableHead>
  );

  return (
    <div className="space-y-6 print-root">
      <style>{`
        @media print {
          .no-print, .no-print * { display: none !important; }
          body { background: #fff !important; color: #000 !important; }
          .print-root, .print-root * {
            background: #fff !important;
            color: #000 !important;
            box-shadow: none !important;
          }
          .print-only { display: block !important; }
          .print-block { break-inside: avoid; page-break-inside: avoid; }
          .print-card-resumo { break-inside: avoid; page-break-inside: avoid; }
          .print-chart { width: 700px !important; height: 300px !important; }
          .recharts-wrapper, .recharts-surface { width: 700px !important; }
          table { break-inside: avoid; page-break-inside: avoid; }
        }
        .print-only { display: none; }
      `}</style>

      <div className="print-only mb-2 text-sm">
        <strong>Desempenho dos closers · R1 · BU Incorporador</strong>
        <div>Período: {rotuloPeriodo} · Segmento: {segmento === 'todos' ? 'Todos' : segmento}</div>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-primary" />
            Desempenho dos closers · R1 · BU Incorporador
          </h1>
          <p className="text-sm text-muted-foreground">{rotuloPeriodo}</p>
        </div>
        <Button variant="outline" className="no-print" onClick={() => window.print()}>
          <Printer className="h-4 w-4 mr-2" />
          Baixar PDF
        </Button>
      </div>

      {/* Filtros */}
      <Card className="no-print">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => aplicarAtalho(7)}>7 dias</Button>
            <Button variant="outline" size="sm" onClick={() => aplicarAtalho(30)}>30 dias</Button>
            <Button variant="outline" size="sm" onClick={() => aplicarAtalho(90)}>90 dias</Button>
          </div>

          <div className="h-6 w-px bg-border" />

          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  {format(new Date(`${de}T12:00:00`), 'dd/MM/yyyy')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={new Date(`${de}T12:00:00`)}
                  onSelect={(d) => d && setDe(format(d, 'yyyy-MM-dd'))}
                  locale={ptBR}
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
            <span className="text-muted-foreground">—</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  {format(new Date(`${ate}T12:00:00`), 'dd/MM/yyyy')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={new Date(`${ate}T12:00:00`)}
                  onSelect={(d) => d && setAte(format(d, 'yyyy-MM-dd'))}
                  locale={ptBR}
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="h-6 w-px bg-border" />

          <Select value={gran} onValueChange={(v) => setGran(v as Granularidade)}>
            <SelectTrigger className="w-[140px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Diário</SelectItem>
              <SelectItem value="week">Semanal</SelectItem>
              <SelectItem value="month">Mensal</SelectItem>
            </SelectContent>
          </Select>

          <Select value={segmento} onValueChange={(v) => setSegmento(v as SegmentoFiltro)}>
            <SelectTrigger className="w-[160px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os segmentos</SelectItem>
              <SelectItem value="A">Segmento A</SelectItem>
              <SelectItem value="B">Segmento B</SelectItem>
              <SelectItem value="C">Segmento C</SelectItem>
            </SelectContent>
          </Select>

          {isolado && (
            <Button variant="ghost" size="sm" onClick={() => setIsolado(null)}>
              Mostrar todos os closers
            </Button>
          )}
        </CardContent>
      </Card>

      <Alert className="print-block">
        <Info className="h-4 w-4" />
        <AlertDescription>
          Cada participante não-sócio com contrato pago conta como um contrato — reunião coletiva com
          três pagantes são três contratos. A conversão é contratos dividido por participantes.
        </AlertDescription>
      </Alert>

      {resumo.cobertura < 50 && (
        <Alert variant="destructive" className="print-block">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Cobertura de avaliações no período: {n1(resumo.cobertura)}%. A nota representa apenas parte
            da operação — interprete com cautela.
          </AlertDescription>
        </Alert>
      )}

      {/* Cartões */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-6 print-block">
        {[
          { label: 'Reuniões', valor: n0(resumo.reunioes) },
          { label: 'Participantes', valor: n0(resumo.participantes) },
          { label: 'Contratos', valor: n0(resumo.contratos) },
          { label: 'Conversão', valor: `${n1(resumo.conversao)}%` },
          { label: 'Nota média', valor: n1(resumo.nota) },
          { label: 'Cobertura', valor: `${n1(resumo.cobertura)}%` },
        ].map((c) => (
          <Card key={c.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">{c.label}</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? <Skeleton className="h-7 w-16" /> : <div className="text-2xl font-bold">{c.valor}</div>}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Gráfico 1 — Contratos */}
      <Card className="print-block">
        <CardHeader>
          <CardTitle className="text-base">Contratos por período</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[380px] print-chart">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dadosContratos}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="periodo" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <RTooltip />
                <Legend
                  onClick={(e: any) => setIsolado((prev) => (prev === e.dataKey ? null : String(e.dataKey)))}
                  wrapperStyle={{ cursor: 'pointer', fontSize: 12 }}
                />
                {closersVisiveis.map((c) => (
                  <Line
                    key={c.email}
                    type="monotone"
                    dataKey={c.email}
                    name={c.nome}
                    stroke={corPorCloser[c.email]}
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Gráfico 2 — Nota / Aderência */}
      <Card className="print-block">
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base">
            {metricaNota === 'nota' ? 'Nota por período' : 'Aderência por período'}
          </CardTitle>
          <ToggleGroup
            type="single"
            value={metricaNota}
            onValueChange={(v) => v && setMetricaNota(v as 'nota' | 'aderencia')}
            className="no-print"
          >
            <ToggleGroupItem value="nota" className="text-xs px-3">Nota</ToggleGroupItem>
            <ToggleGroupItem value="aderencia" className="text-xs px-3">Aderência</ToggleGroupItem>
          </ToggleGroup>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] print-chart">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dadosNota}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="periodo" tick={{ fontSize: 11 }} />
                <YAxis domain={metricaNota === 'nota' ? [0, 10] : [0, 100]} tick={{ fontSize: 11 }} />
                <RTooltip />
                <Legend
                  onClick={(e: any) => setIsolado((prev) => (prev === e.dataKey ? null : String(e.dataKey)))}
                  wrapperStyle={{ cursor: 'pointer', fontSize: 12 }}
                />
                {closersVisiveis.map((c) => (
                  <Line
                    key={c.email}
                    type="monotone"
                    dataKey={c.email}
                    name={c.nome}
                    stroke={corPorCloser[c.email]}
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Nota alta não garante contrato. Use os dois gráficos juntos, nunca isolados.
          </p>
        </CardContent>
      </Card>

      {/* O que separou as reuniões com contrato */}
      <Card className="print-block">
        <CardHeader>
          <CardTitle className="text-base">O que separou as reuniões com contrato</CardTitle>
          <p className="text-sm text-muted-foreground">
            Taxa de cumprimento de cada etapa em reuniões com contrato versus as sem contrato.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {diffQ.isLoading && <Skeleton className="h-32 w-full" />}
          {!diffQ.isLoading && (diffQ.data ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">
              Sem avaliações suficientes no período para comparar etapas.
            </p>
          )}
          {(diffQ.data ?? []).map((d) => (
            <div key={d.etapa} className="rounded-lg border border-border p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{d.etapa}</span>
                <span
                  className={cn(
                    'text-sm font-bold',
                    d.diferenca >= 0 ? 'text-success' : 'text-destructive',
                  )}
                >
                  {d.diferenca >= 0 ? '+' : ''}
                  {n1(d.diferenca)} p.p.
                </span>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                Com contrato: {n1(d.pctVendeu)}% ({n0(d.nVendeu)} reuniões) · Sem contrato: {n1(d.pctNaoVendeu)}% (
                {n0(d.nNaoVendeu)} reuniões)
              </div>
              <Progress
                value={Math.min(100, Math.abs(d.diferenca))}
                className={cn('mt-2 h-2', d.diferenca >= 0 ? '[&>div]:bg-success' : '[&>div]:bg-destructive')}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Ranking */}
      <Card className="print-block">
        <CardHeader>
          <CardTitle className="text-base">Ranking de closers</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <SortHead k="closer">Closer</SortHead>
                <SortHead k="reunioes" className="text-right">Reuniões</SortHead>
                <SortHead k="participantes" className="text-right">Participantes</SortHead>
                <SortHead k="contratos" className="text-right">Contratos</SortHead>
                <SortHead k="conversao" className="text-right">Conversão</SortHead>
                <SortHead k="nota" className="text-right">Nota</SortHead>
                <SortHead k="cobertura" className="text-right">Cobertura</SortHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rankingOrdenado.map((c) => (
                <TableRow
                  key={c.email}
                  className="cursor-pointer"
                  onClick={() =>
                    c.closerId && setDrawerCloser({ id: c.closerId, email: c.email, nome: c.nome })
                  }
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: corPorCloser[c.email] }}
                      />
                      <span className="font-medium">{c.nome}</span>
                      {!c.ativo && <Badge variant="secondary" className="text-[10px]">ex-closer</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">{n0(c.reunioes)}</TableCell>
                  <TableCell className="text-right">{n0(c.participantes)}</TableCell>
                  <TableCell className="text-right font-semibold">{n0(c.contratos)}</TableCell>
                  <TableCell className="text-right">{n1(c.conversao)}%</TableCell>
                  <TableCell className="text-right">{n1(c.nota)}</TableCell>
                  <TableCell className="text-right">
                    <span className="inline-flex items-center gap-1">
                      {c.cobertura < 30 && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                          </TooltipTrigger>
                          <TooltipContent>
                            Cobertura baixa: a nota representa pouco da operação
                          </TooltipContent>
                        </Tooltip>
                      )}
                      {n1(c.cobertura)}%
                    </span>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && rankingOrdenado.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                    Nenhuma reunião R1 encontrada no período.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Por que cada nota está onde está */}
      <Card className="print-block">
        <CardHeader>
          <CardTitle className="text-base">Por que cada nota está onde está</CardTitle>
          <p className="text-sm text-muted-foreground">
            Leitura das etapas que mais falham e das observações registradas nas reuniões avaliadas.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {resumoQ.isLoading && <Skeleton className="h-40 w-full" />}
          {!resumoQ.isLoading && (resumoQ.data ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">
              O resumo só aparece quando existem reuniões avaliadas no período selecionado. Ajuste o
              período ou o segmento para ver a explicação das notas.
            </p>
          )}
          {(resumoQ.data ?? []).map((r) => (
            <div
              key={r.closer_id ?? r.closer_email}
              className="print-card-resumo rounded-lg border border-border p-4"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="flex items-baseline gap-2">
                  <span className="font-medium">
                    {nomePorEmail.get(r.closer_email) ?? r.closer_email}
                  </span>
                  <span className="text-2xl font-bold">{n1(r.nota_media)}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {n0(r.reunioes_avaliadas)} reuniões avaliadas
                  {r.aderencia_media !== null && ` · aderência ${n1(r.aderencia_media)}%`}
                </span>
              </div>

              {r.reunioes_avaliadas < 10 && (
                <p className="mt-1 text-xs text-warning">
                  Poucas reuniões avaliadas — leia com cautela.
                </p>
              )}

              {(r.pior_etapa || r.melhor_etapa) && (
                <p className="mt-2 text-sm">
                  {r.pior_etapa && (
                    <>
                      Perde nota principalmente em <strong>{r.pior_etapa}</strong>
                      {r.pior_etapa_pct !== null && ` (${n1(r.pior_etapa_pct)}% de falha)`}
                      {r.segunda_pior_etapa && (
                        <>
                          {' '}e <strong>{r.segunda_pior_etapa}</strong>
                          {r.segunda_pior_pct !== null && ` (${n1(r.segunda_pior_pct)}%)`}
                        </>
                      )}
                      {'. '}
                    </>
                  )}
                  {r.melhor_etapa && (
                    <>
                      Melhor execução em <strong>{r.melhor_etapa}</strong>
                      {r.melhor_etapa_pct !== null && ` (${n1(r.melhor_etapa_pct)}% de falha)`}.
                    </>
                  )}
                </p>
              )}

              <TemasIACloser
                closerId={r.closer_id}
                de={de}
                ate={ate}
                segmento={segmento}
              />

            </div>
          ))}
        </CardContent>
      </Card>



      {/* Drawer de etapas */}
      <Sheet open={!!drawerCloser} onOpenChange={(o) => !o && setDrawerCloser(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Etapas · {drawerCloser?.nome}</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-3">
            {etapasQ.isLoading && <Skeleton className="h-40 w-full" />}
            {!etapasQ.isLoading && etapasOrdenadas.length === 0 && (
              <p className="text-sm text-muted-foreground">Sem avaliações no período.</p>
            )}
            {etapasOrdenadas.map((e) => (
              <div key={`${e.ordem}-${e.etapa}`} className="rounded-lg border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">
                    {e.ordem}. {e.etapa}
                  </span>
                  <span className="text-sm font-bold text-destructive">{n1(e.pct_falha)}%</span>
                </div>
                <Progress value={Math.min(100, e.pct_falha)} className="mt-2 h-2 [&>div]:bg-destructive" />
                <div className="mt-1 text-xs text-muted-foreground">
                  falhou em {n0(e.falhou)} de {n0(e.avaliacoes)} reuniões · nota média{' '}
                  {n1(e.nota_media_etapa)}
                </div>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export default function DesempenhoClosers() {
  return (
    <RoleGuard allowedRoles={['admin', 'manager']}>
      <DesempenhoClosersContent />
    </RoleGuard>
  );
}

function ListaTemas({
  titulo,
  temas,
  tom,
}: {
  titulo: string;
  temas: TemaIA[];
  tom: 'sucesso' | 'alerta';
}) {
  if (temas.length === 0) return null;
  return (
    <div>
      <p
        className={cn(
          'text-xs font-medium',
          tom === 'sucesso' ? 'text-success' : 'text-destructive',
        )}
      >
        {titulo}
      </p>
      <div className="mt-2 space-y-2">
        {temas.map((t, i) => (
          <div key={`${titulo}-${i}`}>
            <p className="text-[13px]">{t.tema}</p>
            <p className="text-[11px] text-muted-foreground">
              {n0(t.reunioes)} de {n0(t.total_reunioes)} reuniões · {n1(t.pct)}%
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function TemasIACloser({
  closerId,
  de,
  ate,
  segmento,
}: {
  closerId: string;
  de: string;
  ate: string;
  segmento: SegmentoFiltro;
}) {
  const q = useResumoIA(closerId, de, ate, segmento);
  const d = q.data;
  const semTema = d?.frases_sem_tema ?? 0;
  const vazio =
    !!d && (d.vazio === true || (d.temas_fortes.length === 0 && d.temas_melhoria.length === 0));

  const temResumo = !!d && !!d.resumo && d.resumo.trim().length > 0;
  const reunioesUsadas = d?.reunioes_usadas ?? 0;
  const rotuloResumo =
    reunioesUsadas > 0 && reunioesUsadas < (d?.reunioes ?? 0)
      ? `Resumo da IA · baseado em ${n0(reunioesUsadas)} de ${n0(d?.reunioes ?? 0)} reuniões avaliadas`
      : `Resumo da IA · baseado em ${n0(reunioesUsadas)} reuniões avaliadas`;

  return (
    <>
      {q.isLoading && (
        <>
          <div className="mt-3 space-y-1.5">
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-11/12" />
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </>
      )}

      {q.isError && (
        <div className="mt-3 flex items-center gap-2">
          <p className="text-xs text-muted-foreground">Não foi possível gerar os temas agora.</p>
          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => q.refetch()}>
            Tentar de novo
          </Button>
        </div>
      )}

      {!q.isLoading && !q.isError && vazio && (
        <p className="mt-3 text-sm text-muted-foreground">
          Sem observações suficientes para identificar temas.
        </p>
      )}

      {!q.isLoading && !q.isError && d && !vazio && (
        <>
          {temResumo && (
            <div className="mt-3">
              <p className="text-[11px] text-muted-foreground">{rotuloResumo}</p>
              <p className="mt-1 text-[13px] leading-relaxed text-foreground whitespace-pre-line">
                {d.resumo}
              </p>
            </div>
          )}

          <p className="mt-3 text-[11px] text-muted-foreground">
            Temas recorrentes nas reuniões avaliadas
          </p>
          <div className="mt-1 grid gap-3 md:grid-cols-2">
            <ListaTemas titulo="Pontos fortes" temas={d.temas_fortes} tom="sucesso" />
            <ListaTemas titulo="A melhorar" temas={d.temas_melhoria} tom="alerta" />
          </div>
          {semTema > 0 && (
            <p className="mt-2 text-[11px] text-muted-foreground">
              {n0(semTema)} observações não se encaixaram em nenhum tema.
            </p>
          )}
        </>
      )}
    </>
  );
}
