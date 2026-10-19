import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addDays, addMonths, addWeeks, endOfMonth, endOfWeek, format, isSameDay, isSameMonth,
  startOfDay, startOfMonth, startOfWeek,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarDays, ChevronLeft, ChevronRight, Plus, Video, ExternalLink, Loader2, RefreshCw, Columns3, Search, ArrowUpDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { POS_VENDA_ORIGIN_ID } from '@/lib/posVenda';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// Agenda própria do Pós Venda — separada de closers/meeting_slots para não afetar métricas de outras BUs.
// Visual inspirado na Agenda R1, recriado aqui (sem reaproveitar componentes ligados a meeting_slots/closers).
const db = supabase as any;

type Reuniao = {
  id: string; deal_id: string; gerente_id: string; tipo: 'viabilidade_1' | 'viabilidade_2';
  inicio: string; duracao_min: number; link_reuniao: string | null; status: string; observacao: string | null;
  crm_deals?: { name: string | null } | null; profiles?: { full_name: string | null; email: string | null } | null;
};

type ViewMode = 'day' | 'week' | 'month';

const TIPO_LABEL = { viabilidade_1: 'Viabilidade 1', viabilidade_2: 'Viabilidade 2' } as const;
const STATUS_LABEL: Record<string, string> = { agendada: 'Agendada', realizada: 'Realizada', no_show: 'No-show', cancelada: 'Cancelada' };
const STATUS_CLASS: Record<string, string> = {
  agendada: 'bg-primary/15 text-primary border-primary/30',
  realizada: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  no_show: 'bg-destructive/15 text-destructive border-destructive/30',
  cancelada: 'bg-muted text-muted-foreground border-border line-through',
};
const BLOCO_CLASS: Record<string, string> = {
  agendada: 'border-l-primary bg-primary/10 hover:bg-primary/20',
  realizada: 'border-l-emerald-500 bg-emerald-500/10 hover:bg-emerald-500/20',
  no_show: 'border-l-destructive bg-destructive/10 hover:bg-destructive/20',
  cancelada: 'border-l-muted-foreground bg-muted/60 hover:bg-muted opacity-70',
};

const HORA_INICIO = 8;
const HORA_FIM = 20;
const SLOT_PX = 40; // 30 min
const SLOTS = (HORA_FIM - HORA_INICIO) * 2;

const semAcento = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const iniciais = (n?: string | null) => (n ?? '?').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');
const primeiroNome = (n?: string | null) => (n ?? '').split(/\s+/)[0] ?? '';

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn('inline-flex items-center rounded border px-1.5 py-0 text-[10px] font-medium leading-4', STATUS_CLASS[status] ?? STATUS_CLASS.agendada)}>
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

/** Distribui reuniões sobrepostas em colunas lado a lado. */
function layoutDia(lista: Reuniao[]) {
  const ord = [...lista].sort((a, b) => +new Date(a.inicio) - +new Date(b.inicio));
  const res: { r: Reuniao; col: number; cols: number }[] = [];
  let grupo: { r: Reuniao; col: number; fim: number }[] = [];
  let grupoFim = 0;
  const fechar = () => { const n = Math.max(1, ...grupo.map((g) => g.col + 1)); grupo.forEach((g) => res.push({ r: g.r, col: g.col, cols: n })); grupo = []; };
  for (const r of ord) {
    const ini = +new Date(r.inicio); const fim = ini + (r.duracao_min || 30) * 60000;
    if (grupo.length && ini >= grupoFim) fechar();
    const ocupadas = new Set(grupo.filter((g) => g.fim > ini).map((g) => g.col));
    let col = 0; while (ocupadas.has(col)) col++;
    grupo.push({ r, col, fim }); grupoFim = Math.max(grupoFim, fim);
  }
  if (grupo.length) fechar();
  return res;
}

function posicao(r: Reuniao) {
  const d = new Date(r.inicio);
  const min = (d.getHours() - HORA_INICIO) * 60 + d.getMinutes();
  const top = Math.max(0, (min / 30) * SLOT_PX);
  const altura = Math.max(SLOT_PX * 0.9, ((r.duracao_min || 30) / 30) * SLOT_PX - 2);
  return { top, altura: Math.min(altura, SLOTS * SLOT_PX - top) };
}

function useAgora() {
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setAgora(new Date()), 60_000); return () => clearInterval(t); }, []);
  return agora;
}

function BlocoReuniao({ r, style, onClick, mostrarGerente = true }: { r: Reuniao; style?: React.CSSProperties; onClick: () => void; mostrarGerente?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={style}
      title={`${format(new Date(r.inicio), 'HH:mm')} · ${TIPO_LABEL[r.tipo]} · ${r.crm_deals?.name ?? 'Cliente'} · ${r.profiles?.full_name ?? ''}`}
      className={cn('absolute overflow-hidden rounded-md border border-border border-l-4 px-1.5 py-1 text-left text-[11px] leading-tight shadow-sm transition-colors', BLOCO_CLASS[r.status] ?? BLOCO_CLASS.agendada)}
    >
      <div className="font-semibold truncate">{format(new Date(r.inicio), 'HH:mm')} · {TIPO_LABEL[r.tipo]}</div>
      <div className="truncate">{r.crm_deals?.name ?? 'Cliente'}</div>
      <div className="mt-0.5 flex items-center gap-1">
        {mostrarGerente && (
          <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-muted px-1 text-[9px] font-semibold text-foreground" title={r.profiles?.full_name ?? ''}>
            {iniciais(r.profiles?.full_name)}
          </span>
        )}
        {mostrarGerente && <span className="truncate text-muted-foreground">{primeiroNome(r.profiles?.full_name)}</span>}
        <StatusBadge status={r.status} />
      </div>
    </button>
  );
}

/** Grade de horários: coluna de horas + uma coluna por "coluna" (dia ou gerente). */
function GradeHorarios({ colunas, onSelect, mostrarGerente }: {
  colunas: { key: string; titulo: React.ReactNode; destaque?: boolean; dia: Date; reunioes: Reuniao[] }[];
  onSelect: (r: Reuniao) => void; mostrarGerente: boolean;
}) {
  const agora = useAgora();
  const minAgora = (agora.getHours() - HORA_INICIO) * 60 + agora.getMinutes();
  const linhaAgora = minAgora >= 0 && minAgora <= (HORA_FIM - HORA_INICIO) * 60 ? (minAgora / 30) * SLOT_PX : null;
  const horas = Array.from({ length: SLOTS }, (_, i) => `${String(HORA_INICIO + Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`);
  return (
    <div className="rounded-lg border border-border bg-card overflow-auto max-h-[calc(100vh-280px)]">
      <div className="grid min-w-full" style={{ gridTemplateColumns: `64px repeat(${colunas.length}, minmax(140px, 1fr))` }}>
        <div className="sticky top-0 left-0 z-30 border-b border-r border-border bg-card" />
        {colunas.map((c) => (
          <div key={c.key} className={cn('sticky top-0 z-20 border-b border-r border-border bg-card px-2 py-2 text-center text-xs font-medium capitalize', c.destaque && 'bg-primary/10 text-primary')}>
            {c.titulo}
          </div>
        ))}
        <div className="sticky left-0 z-10 border-r border-border bg-card">
          {horas.map((h, i) => (
            <div key={h} style={{ height: SLOT_PX }} className={cn('pr-2 text-right text-[10px] text-muted-foreground -translate-y-1.5', i % 2 && 'opacity-60')}>{h}</div>
          ))}
        </div>
        {colunas.map((c) => (
          <div key={c.key} className={cn('relative border-r border-border', c.destaque && 'bg-primary/[0.03]')} style={{ height: SLOTS * SLOT_PX }}>
            {horas.map((h, i) => (
              <div key={h} style={{ top: i * SLOT_PX, height: SLOT_PX }} className={cn('absolute inset-x-0 border-b', i % 2 ? 'border-border/60' : 'border-dashed border-border/40')} />
            ))}
            {layoutDia(c.reunioes).map(({ r, col, cols }) => {
              const { top, altura } = posicao(r);
              const w = 100 / cols;
              return (
                <BlocoReuniao key={r.id} r={r} onClick={() => onSelect(r)} mostrarGerente={mostrarGerente}
                  style={{ top, height: altura, left: `calc(${col * w}% + 2px)`, width: `calc(${w}% - 4px)` }} />
              );
            })}
            {isSameDay(c.dia, agora) && linhaAgora !== null && (
              <div className="pointer-events-none absolute inset-x-0 z-10" style={{ top: linhaAgora }}>
                <div className="relative h-0.5 bg-destructive"><span className="absolute -left-1 -top-1 h-2.5 w-2.5 rounded-full bg-destructive" /></div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function VisaoMes({ data, reunioes, onSelect, onDia }: { data: Date; reunioes: Reuniao[]; onSelect: (r: Reuniao) => void; onDia: (d: Date) => void }) {
  const ini = startOfWeek(startOfMonth(data), { weekStartsOn: 1 });
  const fim = endOfWeek(endOfMonth(data), { weekStartsOn: 1 });
  const dias: Date[] = []; for (let d = ini; d <= fim; d = addDays(d, 1)) dias.push(d);
  const hoje = new Date();
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="grid grid-cols-7 border-b border-border">
        {['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'].map((d) => <div key={d} className="py-2 text-center text-xs font-medium text-muted-foreground">{d}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {dias.map((d) => {
          const doDia = reunioes.filter((r) => isSameDay(new Date(r.inicio), d)).sort((a, b) => +new Date(a.inicio) - +new Date(b.inicio));
          return (
            <div key={d.toISOString()} className={cn('min-h-[110px] border-b border-r border-border p-1', !isSameMonth(d, data) && 'bg-muted/30 text-muted-foreground')}>
              <button type="button" onClick={() => onDia(d)} className={cn('mb-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs hover:bg-muted', isSameDay(d, hoje) && 'bg-primary text-primary-foreground hover:bg-primary')}>
                {format(d, 'd')}
              </button>
              <div className="space-y-0.5">
                {doDia.slice(0, 3).map((r) => (
                  <button key={r.id} type="button" onClick={() => onSelect(r)} className={cn('block w-full truncate rounded border-l-2 px-1 text-left text-[10px] leading-4', BLOCO_CLASS[r.status] ?? BLOCO_CLASS.agendada)}>
                    {format(new Date(r.inicio), 'HH:mm')} {r.crm_deals?.name ?? 'Cliente'}
                  </button>
                ))}
                {doDia.length > 3 && <button type="button" onClick={() => onDia(d)} className="text-[10px] text-primary hover:underline">+{doDia.length - 3} mais</button>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function AgendaPosVenda() {
  const qc = useQueryClient();
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [dataSel, setDataSel] = useState(() => new Date());
  const [calAberto, setCalAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const [fGerente, setFGerente] = useState('todos');
  const [fStatus, setFStatus] = useState('todos');
  const [fTipo, setFTipo] = useState('todos');
  const [ordemAsc, setOrdemAsc] = useState(true);
  const [novaAberta, setNovaAberta] = useState(false);
  const [selecionada, setSelecionada] = useState<Reuniao | null>(null);
  const { data: gerentes = [] } = useGerentes();

  const { inicio, fim } = useMemo(() => {
    if (viewMode === 'day') return { inicio: startOfDay(dataSel), fim: addDays(startOfDay(dataSel), 1) };
    if (viewMode === 'week') { const s = startOfWeek(dataSel, { weekStartsOn: 1 }); return { inicio: s, fim: addDays(s, 7) }; }
    return { inicio: startOfWeek(startOfMonth(dataSel), { weekStartsOn: 1 }), fim: addDays(endOfWeek(endOfMonth(dataSel), { weekStartsOn: 1 }), 1) };
  }, [viewMode, dataSel]);

  const { data: reunioes = [], isLoading, isFetching, refetch } = useQuery({
    queryKey: ['pos-venda-reunioes', inicio.toISOString(), fim.toISOString()],
    queryFn: async () => {
      const { data, error } = await db.from('pos_venda_reunioes')
        .select('*, crm_deals(name), profiles:gerente_id(full_name, email)')
        .gte('inicio', inicio.toISOString()).lt('inicio', fim.toISOString())
        .order('inicio');
      if (error) throw error;
      return data as Reuniao[];
    },
  });

  const filtradas = useMemo(() => {
    const b = semAcento(busca.trim());
    return reunioes.filter((r) =>
      (!b || semAcento(r.crm_deals?.name ?? '').includes(b)) &&
      (fGerente === 'todos' || r.gerente_id === fGerente) &&
      (fStatus === 'todos' || r.status === fStatus) &&
      (fTipo === 'todos' || r.tipo === fTipo));
  }, [reunioes, busca, fGerente, fStatus, fTipo]);

  const andar = (dir: 1 | -1) => setDataSel((d) => viewMode === 'day' ? addDays(d, dir) : viewMode === 'week' ? addWeeks(d, dir) : addMonths(d, dir));

  const rotulo = viewMode === 'day'
    ? format(dataSel, "EEE, dd 'de' MMM", { locale: ptBR })
    : viewMode === 'week'
      ? `${format(inicio, 'dd/MM', { locale: ptBR })} – ${format(addDays(inicio, 6), 'dd/MM/yyyy', { locale: ptBR })}`
      : format(dataSel, 'MMMM yyyy', { locale: ptBR });

  const diasVisiveis = useMemo(() => {
    if (viewMode === 'day') return [startOfDay(dataSel)];
    if (viewMode === 'week') return Array.from({ length: 7 }, (_, i) => addDays(inicio, i));
    return [];
  }, [viewMode, dataSel, inicio]);

  const hoje = new Date();
  const colunasDias = diasVisiveis.map((d) => ({
    key: d.toISOString(), dia: d, destaque: isSameDay(d, hoje),
    titulo: <>{format(d, 'EEE', { locale: ptBR })} <span className="font-bold">{format(d, 'dd/MM')}</span></>,
    reunioes: filtradas.filter((r) => isSameDay(new Date(r.inicio), d)),
  }));

  // Por Gerente: no Dia, uma coluna por gerente; na Semana/Mês, colunas por gerente com a lista do período.
  const gerentesVisiveis = useMemo(() => {
    const ids = new Set(filtradas.map((r) => r.gerente_id));
    const base = fGerente === 'todos' ? gerentes.filter((g) => ids.has(g.id) || viewMode === 'day') : gerentes.filter((g) => g.id === fGerente);
    const extras = [...ids].filter((id) => !base.some((g) => g.id === id)).map((id) => {
      const r = filtradas.find((x) => x.gerente_id === id);
      return { id, full_name: r?.profiles?.full_name ?? null, email: r?.profiles?.email ?? null };
    });
    return [...base, ...extras];
  }, [gerentes, filtradas, fGerente, viewMode]);

  const ordenadas = useMemo(() => [...filtradas].sort((a, b) => (ordemAsc ? 1 : -1) * (+new Date(a.inicio) - +new Date(b.inicio))), [filtradas, ordemAsc]);
  const invalidar = () => qc.invalidateQueries({ queryKey: ['pos-venda-reunioes'] });

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 sm:gap-3">
          <CalendarDays className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
          <div>
            <h1 className="text-lg sm:text-2xl font-bold">Agenda de Reuniões — Viabilidade</h1>
            <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">Reuniões de Viabilidade 1 e 2 dos gerentes de relacionamento</p>
          </div>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button variant="outline" size="icon" onClick={() => refetch()} className="h-8 w-8 sm:h-9 sm:w-9" title="Atualizar">
            <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
          </Button>
          <Button onClick={() => setNovaAberta(true)} size="sm" className="flex-1 sm:flex-none">
            <Plus className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Nova reunião</span>
            <span className="sm:hidden">Nova</span>
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 pb-2">
        <div className="flex flex-wrap items-center gap-2">
          <ToggleGroup type="single" value={viewMode} onValueChange={(v) => { if (v) { setViewMode(v as ViewMode); setDataSel(new Date()); } }} className="flex-shrink-0">
            <ToggleGroupItem value="day" className="text-xs px-2 sm:px-3">Dia</ToggleGroupItem>
            <ToggleGroupItem value="week" className="text-xs px-2 sm:px-3">Sem</ToggleGroupItem>
            <ToggleGroupItem value="month" className="text-xs px-2 sm:px-3">Mês</ToggleGroupItem>
          </ToggleGroup>
          <div className="flex items-center gap-1 border rounded-md px-1 py-0.5 bg-muted/30">
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => andar(-1)} title="Período anterior"><ChevronLeft className="h-4 w-4" /></Button>
            <Popover open={calAberto} onOpenChange={setCalAberto}>
              <PopoverTrigger asChild>
                <Button variant="ghost" className="text-xs sm:text-sm font-medium px-1 sm:px-2 min-w-[100px] sm:min-w-[140px] text-center capitalize h-7 hover:bg-muted" title="Clique para selecionar data">
                  {rotulo}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="center">
                <Calendar mode="single" selected={dataSel} onSelect={(d) => { if (d) { setDataSel(d); setCalAberto(false); } }} locale={ptBR} className="pointer-events-auto" />
              </PopoverContent>
            </Popover>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => andar(1)} title="Próximo período"><ChevronRight className="h-4 w-4" /></Button>
          </div>
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setDataSel(new Date())}>Hoje</Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-[220px]">
            <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar cliente..." className="h-9 pl-8 text-sm" />
          </div>
          <Select value={fGerente} onValueChange={setFGerente}>
            <SelectTrigger className="h-9 w-[200px] text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os gerentes</SelectItem>
              {gerentes.map((g) => <SelectItem key={g.id} value={g.id}>{g.full_name ?? g.email}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={fStatus} onValueChange={setFStatus}>
            <SelectTrigger className="h-9 w-[150px] text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos status</SelectItem>
              {Object.entries(STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={fTipo} onValueChange={setFTipo}>
            <SelectTrigger className="h-9 w-[160px] text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os tipos</SelectItem>
              <SelectItem value="viabilidade_1">Viabilidade 1</SelectItem>
              <SelectItem value="viabilidade_2">Viabilidade 2</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">{filtradas.length} reunião(ões)</span>
        </div>
      </div>

      <Tabs defaultValue="calendar" className="w-full">
        <TabsList>
          <TabsTrigger value="calendar" className="flex items-center gap-1.5"><CalendarDays className="h-4 w-4" />Calendário</TabsTrigger>
          <TabsTrigger value="gerentes" className="flex items-center gap-1.5"><Columns3 className="h-4 w-4" />Por Gerente</TabsTrigger>
          <TabsTrigger value="list">Lista</TabsTrigger>
        </TabsList>

        <TabsContent value="calendar" className="mt-4">
          {isLoading ? <Skeleton className="h-[600px] w-full" /> : viewMode === 'month'
            ? <VisaoMes data={dataSel} reunioes={filtradas} onSelect={setSelecionada} onDia={(d) => { setDataSel(d); setViewMode('day'); }} />
            : <GradeHorarios colunas={colunasDias} onSelect={setSelecionada} mostrarGerente />}
        </TabsContent>

        <TabsContent value="gerentes" className="mt-4">
          {isLoading ? <Skeleton className="h-[600px] w-full" /> : gerentesVisiveis.length === 0 ? (
            <p className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">Nenhuma reunião no período.</p>
          ) : viewMode === 'day' ? (
            <GradeHorarios mostrarGerente={false} onSelect={setSelecionada}
              colunas={gerentesVisiveis.map((g) => ({
                key: g.id, dia: startOfDay(dataSel), titulo: <span className="normal-case">{g.full_name ?? g.email}</span>,
                reunioes: filtradas.filter((r) => r.gerente_id === g.id),
              }))} />
          ) : (
            <div className="rounded-lg border border-border bg-card overflow-auto">
              <div className="grid" style={{ gridTemplateColumns: `repeat(${gerentesVisiveis.length}, minmax(200px, 1fr))` }}>
                {gerentesVisiveis.map((g) => {
                  const dele = filtradas.filter((r) => r.gerente_id === g.id).sort((a, b) => +new Date(a.inicio) - +new Date(b.inicio));
                  return (
                    <div key={g.id} className="border-r border-border last:border-r-0">
                      <div className="sticky top-0 border-b border-border bg-card px-3 py-2 text-xs font-medium">
                        <span className="mr-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px] font-semibold">{iniciais(g.full_name)}</span>
                        {g.full_name ?? g.email} <span className="text-muted-foreground">({dele.length})</span>
                      </div>
                      <div className="space-y-1.5 p-2">
                        {dele.length === 0 && <p className="text-xs text-muted-foreground">—</p>}
                        {dele.map((r) => (
                          <button key={r.id} type="button" onClick={() => setSelecionada(r)}
                            className={cn('w-full rounded-md border border-border border-l-4 px-2 py-1.5 text-left text-[11px] leading-tight transition-colors', BLOCO_CLASS[r.status] ?? BLOCO_CLASS.agendada)}>
                            <div className="font-semibold capitalize">{format(new Date(r.inicio), "EEE dd/MM · HH:mm", { locale: ptBR })} · {TIPO_LABEL[r.tipo]}</div>
                            <div className="truncate">{r.crm_deals?.name ?? 'Cliente'}</div>
                            <div className="mt-0.5"><StatusBadge status={r.status} /></div>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="list" className="mt-4">
          {isLoading ? <Skeleton className="h-[400px] w-full" /> : (
            <div className="rounded-lg border border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <button type="button" className="inline-flex items-center gap-1" onClick={() => setOrdemAsc((v) => !v)}>Data <ArrowUpDown className="h-3 w-3" /></button>
                    </TableHead>
                    <TableHead>Hora</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Gerente</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ordenadas.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground">Nenhuma reunião no período.</TableCell></TableRow>
                  )}
                  {ordenadas.map((r) => (
                    <TableRow key={r.id} className="cursor-pointer" onClick={() => setSelecionada(r)}>
                      <TableCell className="capitalize">{format(new Date(r.inicio), 'EEE dd/MM/yyyy', { locale: ptBR })}</TableCell>
                      <TableCell className="tabular-nums">{format(new Date(r.inicio), 'HH:mm')}</TableCell>
                      <TableCell>{TIPO_LABEL[r.tipo]}</TableCell>
                      <TableCell>{r.crm_deals?.name ?? 'Cliente'}</TableCell>
                      <TableCell>{r.profiles?.full_name ?? '—'}</TableCell>
                      <TableCell><StatusBadge status={r.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {novaAberta && <NovaReuniaoDialog onClose={() => setNovaAberta(false)} onSalvo={invalidar} />}
      {selecionada && <ReuniaoDialog reuniao={selecionada} onClose={() => setSelecionada(null)} onSalvo={invalidar} />}
    </div>
  );
}

function useGerentes() {
  return useQuery({
    queryKey: ['pos-venda-gerentes'],
    queryFn: async () => {
      const { data: roles } = await db.from('user_roles').select('user_id, role').in('role', ['gerente_relacionamento', 'admin']);
      const ids = [...new Set((roles ?? []).map((r: any) => r.user_id))];
      if (!ids.length) return [];
      const { data } = await db.from('profiles').select('id, full_name, email').in('id', ids).order('full_name');
      return (data ?? []) as { id: string; full_name: string | null; email: string | null }[];
    },
    staleTime: 5 * 60_000,
  });
}

function NovaReuniaoDialog({ onClose, onSalvo }: { onClose: () => void; onSalvo: () => void }) {
  const { user } = useAuth();
  const { data: gerentes = [] } = useGerentes();
  const [busca, setBusca] = useState('');
  const [dealId, setDealId] = useState('');
  const [gerenteId, setGerenteId] = useState(user?.id ?? '');
  const [tipo, setTipo] = useState<'viabilidade_1' | 'viabilidade_2'>('viabilidade_1');
  const [data, setData] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [hora, setHora] = useState('10:00');
  const [duracao, setDuracao] = useState(60);
  const [link, setLink] = useState('');

  const { data: deals = [] } = useQuery({
    queryKey: ['pos-venda-deals-busca', busca],
    queryFn: async () => {
      let q = db.from('crm_deals').select('id, name').eq('origin_id', POS_VENDA_ORIGIN_ID).order('created_at', { ascending: false }).limit(30);
      const termo = busca.trim().replace(/[%,()]/g, ' ').trim();
      if (termo) {
        // Ignora acentos: cada letra que pode ter acento vira curinga de 1 caractere.
        const semAcento = termo.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const padrao = `%${semAcento.replace(/[aeiouc]/gi, '_')}%`;
        const digitos = termo.replace(/\D/g, '');
        const filtrosContato = [`name.ilike.${padrao}`, `email.ilike.%${termo}%`];
        if (digitos.length >= 4) filtrosContato.push(`phone.ilike.%${digitos.slice(-9)}%`);
        const { data: contatos } = await db.from('crm_contacts').select('id').or(filtrosContato.join(',')).limit(200);
        const ids = ((contatos ?? []) as { id: string }[]).map((c) => c.id);
        q = ids.length
          ? q.or(`name.ilike.${padrao},contact_id.in.(${ids.join(',')})`)
          : q.ilike('name', padrao);
      }
      const { data } = await q;
      return (data ?? []) as { id: string; name: string | null }[];
    },
  });

  const salvar = useMutation({
    mutationFn: async () => {
      const inicio = new Date(`${data}T${hora}:00`).toISOString();
      const { error } = await db.from('pos_venda_reunioes').insert({
        deal_id: dealId, gerente_id: gerenteId, tipo, inicio, duracao_min: duracao, link_reuniao: link || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success('Reunião agendada'); onSalvo(); onClose(); },
    onError: (e: any) => toast.error(e.message ?? 'Erro ao agendar'),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Nova reunião de viabilidade</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Cliente (pipeline Relacionamento - Pós venda)</Label>
            <Input placeholder="Buscar pelo nome" value={busca} onChange={(e) => setBusca(e.target.value)} />
            <Select value={dealId} onValueChange={setDealId}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Escolha o cliente" /></SelectTrigger>
              <SelectContent>{deals.map((d) => <SelectItem key={d.id} value={d.id}>{d.name ?? d.id}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Reunião</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="viabilidade_1">Viabilidade 1</SelectItem>
                  <SelectItem value="viabilidade_2">Viabilidade 2</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Gerente</Label>
              <Select value={gerenteId} onValueChange={setGerenteId}>
                <SelectTrigger><SelectValue placeholder="Gerente" /></SelectTrigger>
                <SelectContent>{gerentes.map((g) => <SelectItem key={g.id} value={g.id}>{g.full_name ?? g.email}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div><Label>Data</Label><Input type="date" value={data} onChange={(e) => setData(e.target.value)} /></div>
            <div><Label>Hora</Label><Input type="time" value={hora} onChange={(e) => setHora(e.target.value)} /></div>
            <div><Label>Duração (min)</Label><Input type="number" min={10} max={480} value={duracao} onChange={(e) => setDuracao(Number(e.target.value))} /></div>
          </div>
          <div><Label>Link da reunião (opcional)</Label><Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://meet.google.com/..." /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button disabled={!dealId || !gerenteId || salvar.isPending} onClick={() => salvar.mutate()}>Agendar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReuniaoDialog({ reuniao, onClose, onSalvo }: { reuniao: Reuniao; onClose: () => void; onSalvo: () => void }) {
  const [status, setStatus] = useState(reuniao.status);
  const [obs, setObs] = useState(reuniao.observacao ?? '');
  const [abrindo, setAbrindo] = useState<string | null>(null);

  const { data: gravacoes = [], isLoading } = useQuery({
    queryKey: ['pos-venda-gravacoes', reuniao.id],
    queryFn: async () => {
      const { data, error } = await db.rpc('pos_venda_gravacoes_da_reuniao', { p_reuniao_id: reuniao.id });
      if (error) throw error;
      return (data ?? []) as { id: string; title: string | null; started_at: string | null; duration_minutes: number | null; summary: any }[];
    },
  });

  const salvar = useMutation({
    mutationFn: async () => {
      const { error } = await db.from('pos_venda_reunioes').update({ status, observacao: obs || null }).eq('id', reuniao.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success('Reunião atualizada'); onSalvo(); onClose(); },
    onError: (e: any) => toast.error(e.message ?? 'Erro ao salvar'),
  });

  const assistir = async (recordingId: string) => {
    setAbrindo(recordingId);
    const { data, error } = await supabase.functions.invoke('pos-venda-gravacao', { body: { reuniao_id: reuniao.id, recording_id: recordingId } });
    setAbrindo(null);
    if (error || !data?.link) { toast.error(data?.mensagem ?? 'Não foi possível abrir a gravação'); return; }
    window.open(data.link, '_blank', 'noopener');
  };

  const resumo = (s: any) => typeof s === 'string' ? s : s?.summary ?? null;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>{TIPO_LABEL[reuniao.tipo]} — {reuniao.crm_deals?.name}</DialogTitle></DialogHeader>
        <div className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            {format(new Date(reuniao.inicio), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} · {reuniao.duracao_min} min · {reuniao.profiles?.full_name}
          </p>
          {reuniao.link_reuniao && (
            <a href={reuniao.link_reuniao} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary underline">
              <ExternalLink className="h-3 w-3" />Entrar na reunião
            </a>
          )}
          <div>
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Observação</Label><Textarea value={obs} onChange={(e) => setObs(e.target.value)} /></div>

          <div className="border-t border-border pt-3">
            <div className="flex items-center gap-2 font-medium mb-2"><Video className="h-4 w-4" />Gravações (MeetGeek)</div>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : gravacoes.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Nenhuma gravação encontrada ainda. Ela aparece aqui quando o MeetGeek do gerente grava a reunião neste horário (pode levar alguns minutos depois do fim).
              </p>
            ) : gravacoes.map((g) => (
              <div key={g.id} className="rounded border border-border p-2 mb-2 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium truncate">{g.title ?? 'Gravação'}</span>
                  <Button size="sm" variant="outline" disabled={abrindo === g.id} onClick={() => assistir(g.id)}>
                    {abrindo === g.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Assistir'}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {g.started_at ? format(new Date(g.started_at), 'dd/MM HH:mm') : ''}{g.duration_minutes ? ` · ${g.duration_minutes} min` : ''}
                </p>
                {resumo(g.summary) && <p className="text-xs whitespace-pre-line line-clamp-6">{resumo(g.summary)}</p>}
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
          <Button disabled={salvar.isPending} onClick={() => salvar.mutate()}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
