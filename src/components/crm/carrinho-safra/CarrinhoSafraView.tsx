import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, RefreshCw, Settings, MoreHorizontal, Download, ArrowUpDown, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useUpdateAttendeeAndSlotStatus } from '@/hooks/useAgendaData';
import { useR2StatusOptions, useR2ThermometerOptions } from '@/hooks/useR2StatusOptions';
import { useActiveR2Closers } from '@/hooks/useR2AgendaData';
import { R2QuickScheduleModal } from '@/components/crm/R2QuickScheduleModal';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/formatters';

const TZ = 'America/Sao_Paulo';
const rpc = (fn: string, args: Record<string, unknown>) => (supabase.rpc as any)(fn, args);

interface Safra {
  id: string; bu: string; data_inicial: string; data_final: string; fechamento_carrinho: string;
  editada_manual: boolean; observacao: string | null; updated_at: string;
}
interface LeadRow {
  contrato_attendee_id: string; deal_id: string | null; contact_id: string | null; lead_name: string | null;
  telefone: string | null; email: string | null; data_compra: string | null; contract_paid_at: string | null;
  closer_r1: string | null; sdr_name: string | null; r2_attendee_id: string | null; r2_meeting_id: string | null;
  r2_data: string | null; closer_r2: string | null; r2_posicao: string | null; r2_status_nome: string | null;
  r2_tentativas: number | null; r2_no_shows: number | null; status_reuniao: string | null;
  reembolsado_em: string | null; desistencia: boolean | null; motivo: string | null; observacao: string | null;
  proximo_contato: string | null; acompanhamento_atualizado_em: string | null; acompanhamento_atualizado_por: string | null;
  movimento: 'movido_para' | 'veio_de' | null; safra_vinculo_id: string | null; safra_vinculo_label: string | null;
  parceria_rotulo: string | null; parceria_produtos: string | null; parceria_data: string | null;
  parceria_liquido: number | null; parceria_quando: 'carrinho' | 'pos_carrinho' | null; situacao: string | null;
  origem: 'agenda' | 'transacao' | null; reembolso_solicitado: boolean | null;
}

// ---------- helpers de data (fuso SP) ----------
const fmtTz = (iso: string | null | undefined, opts: Intl.DateTimeFormatOptions) =>
  iso ? new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, ...opts }).format(new Date(iso)) : '';
const ddmmHHmm = (iso?: string | null) => fmtTz(iso, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', '');
const dDate = (d?: string | null, ano = false) => {
  if (!d) return '';
  const [y, m, dd] = d.slice(0, 10).split('-');
  return ano ? `${dd}/${m}/${y}` : `${dd}/${m}`;
};
const hojeSP = () => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
const somaDias = (d: string, n: number) => {
  const dt = new Date(`${d}T12:00:00Z`); dt.setUTCDate(dt.getUTCDate() + n); return dt.toISOString().slice(0, 10);
};
const isoParaPartesSP = (iso: string) => {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(iso));
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? '';
  return { data: `${g('year')}-${g('month')}-${g('day')}`, hora: `${g('hour')}:${g('minute')}` };
};
const fechamentoLabel = (iso: string) => {
  const dia = fmtTz(iso, { weekday: 'short' }).replace('.', '');
  return `${dia} ${ddmmHHmm(iso)}`;
};
const waLink = (tel: string) => {
  const dig = tel.replace(/\D/g, '');
  return `https://wa.me/${dig.startsWith('55') ? dig : '55' + dig}`;
};

const STATUS_CLS: Record<string, string> = {
  'Realizado': 'bg-green-500/15 text-green-400 border-green-500/40',
  'No Show': 'bg-red-500/15 text-red-400 border-red-500/40',
  'Agendado': 'bg-blue-500/15 text-blue-400 border-blue-500/40',
  'Aguardando marcação': 'bg-amber-500/15 text-amber-400 border-amber-500/40',
  'Pendente': 'bg-muted text-muted-foreground border-border',
  'Prox Semana': 'bg-purple-500/15 text-purple-400 border-purple-500/40',
  'Desistência': 'bg-orange-500/15 text-orange-400 border-orange-500/40',
};
const STATUS_TIP: Record<string, string> = {
  'Aguardando marcação': 'A R2 já passou e o closer não marcou realizada/no-show',
  'Pendente': 'Contrato pago sem R2',
};
const SITUACOES = ['comprou', 'reembolsado', 'reembolso_solicitado', 'desistente', 'movido', 'reprovado', 'no_carrinho', 'no_show', 'pendente', 'aguardando_marcacao', 'agendado'];

type CardKey = 'contratos' | 'realizadas' | 'noshow' | 'pendentes' | 'aguardando' | 'reembolsos' | 'desistencias' | 'nocarrinho' | 'compraram' | 'pos';
const CARD_FILTER: Record<CardKey, (r: LeadRow) => boolean> = {
  contratos: () => true,
  realizadas: (r) => r.status_reuniao === 'Realizado',
  noshow: (r) => r.status_reuniao === 'No Show',
  pendentes: (r) => r.status_reuniao === 'Pendente',
  aguardando: (r) => r.status_reuniao === 'Aguardando marcação',
  reembolsos: (r) => !!r.reembolsado_em || !!r.reembolso_solicitado,
  desistencias: (r) => !!r.desistencia,
  nocarrinho: (r) => r.situacao === 'no_carrinho',
  compraram: (r) => r.parceria_quando === 'carrinho',
  pos: (r) => r.parceria_quando === 'pos_carrinho',
};

type SortKey = 'lead_name' | 'telefone' | 'data_compra' | 'r2_data' | 'closer_r1' | 'closer_r2' | 'status_reuniao' | 'parceria_rotulo' | 'proximo_contato';

const csvCell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;

export function CarrinhoSafraView() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { allRoles } = useAuth();
  const podeEditar = (allRoles || []).some((r) => ['admin', 'manager', 'coordenador'].includes(r as string));
  const [searchParams, setSearchParams] = useSearchParams();
  const [dataRef, setDataRef] = useState<string>(() => searchParams.get('safra') || hojeSP());

  const safraQ = useQuery({
    queryKey: ['carrinho-safra', dataRef],
    queryFn: async () => {
      const { data, error } = await rpc('carrinho_safra_para_data', { p_data: dataRef, p_bu: 'incorporador' });
      if (error) throw error;
      return (Array.isArray(data) ? data[0] : data) as Safra;
    },
    staleTime: 60_000, refetchOnWindowFocus: true,
  });
  const safra = safraQ.data;

  useEffect(() => {
    if (!safra) return;
    if (searchParams.get('safra') !== safra.data_inicial) {
      setSearchParams((prev) => { const n = new URLSearchParams(prev); n.set('safra', safra.data_inicial); return n; }, { replace: true });
    }
  }, [safra?.data_inicial]); // eslint-disable-line react-hooks/exhaustive-deps

  const leadsKey = ['carrinho-safra-leads', safra?.id];
  const leadsQ = useQuery({
    queryKey: leadsKey,
    enabled: !!safra?.id,
    queryFn: async () => {
      const { data, error } = await rpc('carrinho_safra_linhas', { p_safra_id: safra!.id });
      if (error) throw error;
      return (data || []) as LeadRow[];
    },
    staleTime: 60_000, refetchOnWindowFocus: true, refetchInterval: 120_000,
  });
  const rows = leadsQ.data || [];

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ['carrinho-safra'] });
    qc.invalidateQueries({ queryKey: ['carrinho-safra-leads'] });
  };

  const salvarAcomp = async (row: LeadRow, campos: Record<string, unknown>, otimista?: Partial<LeadRow>) => {
    const anterior = qc.getQueryData<LeadRow[]>(leadsKey);
    if (otimista && anterior) {
      qc.setQueryData<LeadRow[]>(leadsKey, anterior.map((r) => r.contrato_attendee_id === row.contrato_attendee_id ? { ...r, ...otimista } : r));
    }
    const { error } = await rpc('carrinho_acompanhamento_salvar', {
      p_contrato_attendee_id: row.contrato_attendee_id, p_deal_id: row.deal_id, p_campos: campos,
    });
    if (error) {
      if (anterior) qc.setQueryData(leadsKey, anterior);
      toast.error(error.message || 'Erro ao salvar');
      return false;
    }
    toast.success('Salvo');
    invalidar();
    return true;
  };

  // ---------- filtros ----------
  const [cardFiltro, setCardFiltro] = useState<CardKey | null>(null);
  const [busca, setBusca] = useState('');
  const [fCloserR1, setFCloserR1] = useState('todos');
  const [fCloserR2, setFCloserR2] = useState('todos');
  const [fStatus, setFStatus] = useState('todos');
  const [fSituacao, setFSituacao] = useState('todos');
  const [soAguardando, setSoAguardando] = useState(false);
  const [sort, setSort] = useState<{ k: SortKey; dir: 'asc' | 'desc' }>({ k: 'data_compra', dir: 'asc' });

  const contaveis = useMemo(() => rows.filter((r) => r.movimento !== 'movido_para'), [rows]);
  const totais = useMemo(() => {
    const c = (k: CardKey) => contaveis.filter(CARD_FILTER[k]).length;
    return {
      contratos: contaveis.length, realizadas: c('realizadas'), noshow: c('noshow'), pendentes: c('pendentes'),
      aguardando: c('aguardando'), reembolsos: contaveis.filter((r) => !!r.reembolsado_em).length, desistencias: c('desistencias'),
      solicitados: contaveis.filter((r) => r.reembolso_solicitado && !r.reembolsado_em).length,
      nocarrinho: c('nocarrinho'), compraram: c('compraram'), pos: c('pos'),
    };
  }, [contaveis]);

  const opcoes = (k: 'closer_r1' | 'closer_r2' | 'status_reuniao') =>
    Array.from(new Set(rows.map((r) => r[k]).filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b, 'pt-BR'));

  const filtradas = useMemo(() => {
    const t = busca.trim().toLowerCase();
    const td = t.replace(/\D/g, '');
    let out = rows.filter((r) => {
      if (cardFiltro && (r.movimento === 'movido_para' || !CARD_FILTER[cardFiltro](r))) return false;
      if (t) {
        const ok = (r.lead_name || '').toLowerCase().includes(t) || (r.email || '').toLowerCase().includes(t) ||
          (td.length >= 3 && (r.telefone || '').replace(/\D/g, '').includes(td));
        if (!ok) return false;
      }
      if (fCloserR1 !== 'todos' && r.closer_r1 !== fCloserR1) return false;
      if (fCloserR2 !== 'todos' && r.closer_r2 !== fCloserR2) return false;
      if (fStatus !== 'todos' && r.status_reuniao !== fStatus) return false;
      if (fSituacao !== 'todos' && r.situacao !== fSituacao) return false;
      if (soAguardando && r.status_reuniao !== 'Aguardando marcação') return false;
      return true;
    });
    const s = sort.dir === 'asc' ? 1 : -1;
    out = [...out].sort((a, b) => {
      const va = a[sort.k] ?? ''; const vb = b[sort.k] ?? '';
      if (va === '' && vb !== '') return 1;
      if (vb === '' && va !== '') return -1;
      return String(va).localeCompare(String(vb), 'pt-BR', { numeric: true }) * s;
    });
    return out;
  }, [rows, cardFiltro, busca, fCloserR1, fCloserR2, fStatus, fSituacao, soAguardando, sort]);

  const exportar = () => {
    const head = ['Nome', 'Telefone', 'E-mail', 'Data de compra', 'R2', 'Closer R1', 'Closer R2', 'Status', 'Reembolso/Desistência', 'Parceria', 'Observação', 'Próx. contato'];
    const linhas = filtradas.map((r) => [
      r.lead_name, r.telefone, r.email, dDate(r.data_compra, true), ddmmHHmm(r.r2_data), r.closer_r1, r.closer_r2, r.status_reuniao,
      r.reembolsado_em ? `Reembolso ${dDate(r.reembolsado_em)}` : r.reembolso_solicitado ? 'Reembolso solicitado' : r.desistencia ? `Desistência${r.motivo ? ` (${r.motivo})` : ''}` : '',
      `${r.parceria_rotulo || ''}${r.parceria_quando === 'pos_carrinho' ? ' (PÓS CARRINHO)' : ''}`, r.observacao, dDate(r.proximo_contato, true),
    ]);
    const csv = '\uFEFF' + [head, ...linhas].map((l) => l.map(csvCell).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = `carrinho-safra-${safra?.data_inicial || ''}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  // ---------- diálogos ----------
  const [editOpen, setEditOpen] = useState(false);
  const [desistRow, setDesistRow] = useState<LeadRow | null>(null);
  const [moverRow, setMoverRow] = useState<LeadRow | null>(null);
  const [agendarRow, setAgendarRow] = useState<LeadRow | null>(null);
  const updateStatus = useUpdateAttendeeAndSlotStatus();
  const { data: statusOptions = [] } = useR2StatusOptions();
  const { data: thermometerOptions = [] } = useR2ThermometerOptions();
  const { data: r2Closers = [] } = useActiveR2Closers();

  const marcarR2 = async (row: LeadRow, status: 'completed' | 'no_show') => {
    if (!row.r2_attendee_id) return;
    let syncSlot = false;
    if (status === 'completed') {
      const { data } = await supabase.from('meeting_slot_attendees').select('partner_name').eq('id', row.r2_attendee_id).maybeSingle();
      syncSlot = !data?.partner_name;
    }
    updateStatus.mutate(
      { attendeeId: row.r2_attendee_id, status, meetingId: row.r2_meeting_id || undefined, meetingType: 'r2', syncSlot },
      {
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['carrinho-safra-leads'] }); },
        onError: (e: any) => toast.error(e?.message || 'Erro ao atualizar status'),
      },
    );
  };

  const moverProxima = async (row: LeadRow) => {
    if (!safra) return;
    const { data, error } = await rpc('carrinho_safra_para_data', { p_data: somaDias(safra.data_final, 1), p_bu: 'incorporador' });
    if (error) { toast.error(error.message); return; }
    const prox = (Array.isArray(data) ? data[0] : data) as Safra;
    await salvarAcomp(row, { safra_id: prox.id });
  };

  const hoje = hojeSP();

  const SortHead = ({ k, children }: { k: SortKey; children: React.ReactNode }) => (
    <TableHead>
      <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => setSort((s) => ({ k, dir: s.k === k && s.dir === 'asc' ? 'desc' : 'asc' }))}>
        {children}<ArrowUpDown className={cn('h-3 w-3', sort.k === k ? 'text-foreground' : 'opacity-40')} />
      </button>
    </TableHead>
  );

  const conv = (num: number, den: number) => (den ? `${((num / den) * 100).toFixed(1)}%` : '—');

  const cards: { k: CardKey; label: string; valor: number }[] = [
    { k: 'contratos', label: 'Contratos', valor: totais.contratos },
    { k: 'realizadas', label: 'R2 Realizadas', valor: totais.realizadas },
    { k: 'noshow', label: 'No Show', valor: totais.noshow },
    { k: 'pendentes', label: 'Pendentes (sem R2)', valor: totais.pendentes },
    { k: 'aguardando', label: 'Aguardando marcação', valor: totais.aguardando },
    { k: 'reembolsos', label: 'Reembolsos', valor: totais.reembolsos },
    { k: 'desistencias', label: 'Desistências', valor: totais.desistencias },
    { k: 'nocarrinho', label: 'No carrinho', valor: totais.nocarrinho },
    { k: 'compraram', label: 'Compraram', valor: totais.compraram },
    { k: 'pos', label: 'Pós-carrinho', valor: totais.pos },
  ];

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Cabeçalho */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            {safraQ.isLoading ? <Skeleton className="h-7 w-64" /> : safra ? (
              <>
                <h1 className="text-2xl font-bold">Safra {dDate(safra.data_inicial)} – {dDate(safra.data_final, true)}</h1>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Fechamento do carrinho: {fechamentoLabel(safra.fechamento_carrinho)}</span>
                  {safra.editada_manual && (
                    <Tooltip>
                      <TooltipTrigger asChild><Badge variant="outline" className="text-amber-400 border-amber-500/40">ajustada manualmente</Badge></TooltipTrigger>
                      <TooltipContent className="max-w-[320px] whitespace-normal text-[11px]">{safra.observacao || 'Sem observação'}</TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </>
            ) : null}
          </div>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" disabled={!safra} onClick={() => safra && setDataRef(somaDias(safra.data_inicial, -1))} title="Safra anterior"><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="outline" size="sm" onClick={() => setDataRef(hojeSP())}>Hoje</Button>
            <Button variant="outline" size="icon" disabled={!safra} onClick={() => safra && setDataRef(somaDias(safra.data_final, 1))} title="Próxima safra"><ChevronRight className="h-4 w-4" /></Button>
            {podeEditar && <Button variant="outline" size="icon" disabled={!safra} onClick={() => setEditOpen(true)} title="Editar safra"><Settings className="h-4 w-4" /></Button>}
            <Button variant="outline" size="icon" onClick={invalidar} title="Atualizar"><RefreshCw className={cn('h-4 w-4', (safraQ.isFetching || leadsQ.isFetching) && 'animate-spin')} /></Button>
          </div>
        </div>

        {(safraQ.isError || leadsQ.isError) && (
          <Card><CardContent className="p-6 flex items-center justify-between gap-3">
            <span className="text-destructive text-sm">Erro ao carregar: {((safraQ.error || leadsQ.error) as any)?.message}</span>
            <Button variant="outline" size="sm" onClick={() => (safraQ.isError ? safraQ.refetch() : leadsQ.refetch())}>Tentar de novo</Button>
          </CardContent></Card>
        )}

        {/* Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-11 gap-2">
          {cards.map((c) => (
            <Card key={c.k} onClick={() => setCardFiltro((f) => (f === c.k ? null : c.k))}
              className={cn('cursor-pointer transition-colors hover:border-primary/60', cardFiltro === c.k && 'border-primary ring-1 ring-primary')}>
              <CardContent className="p-3">
                <div className="text-xs text-muted-foreground">{c.label}</div>
                {leadsQ.isLoading || safraQ.isLoading ? <Skeleton className="h-7 w-10 mt-1" /> : <div className="text-2xl font-bold">{c.valor}</div>}
                {c.k === 'reembolsos' && totais.solicitados > 0 && <div className="text-[11px] text-amber-400">+{totais.solicitados} solicitados</div>}
              </CardContent>
            </Card>
          ))}
          <Card>
            <CardContent className="p-3">
              <div className="text-xs text-muted-foreground">Conversão</div>
              {leadsQ.isLoading || safraQ.isLoading ? <Skeleton className="h-7 w-14 mt-1" /> : (
                <>
                  <div className="text-2xl font-bold">{conv(totais.compraram, totais.realizadas)}</div>
                  <div className="text-[11px] text-muted-foreground">{conv(totais.compraram, totais.contratos)} dos contratos</div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-2">
          <Input placeholder="Buscar nome, telefone ou e-mail" value={busca} onChange={(e) => setBusca(e.target.value)} className="w-64" />
          <FiltroSelect valor={fCloserR1} onChange={setFCloserR1} todos="Closer R1: todos" itens={opcoes('closer_r1')} />
          <FiltroSelect valor={fCloserR2} onChange={setFCloserR2} todos="Closer R2: todos" itens={opcoes('closer_r2')} />
          <FiltroSelect valor={fStatus} onChange={setFStatus} todos="Status: todos" itens={opcoes('status_reuniao')} />
          <FiltroSelect valor={fSituacao} onChange={setFSituacao} todos="Situação: todas" itens={SITUACOES} rotulo={(s) => s.replace(/_/g, ' ')} />
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={soAguardando} onCheckedChange={(v) => setSoAguardando(!!v)} /> Só aguardando marcação
          </label>
          <span className="text-sm text-muted-foreground ml-auto">{filtradas.length} de {rows.length} leads</span>
          <Button variant="outline" size="sm" onClick={exportar} disabled={!filtradas.length}><Download className="h-4 w-4 mr-1" />Exportar CSV</Button>
        </div>

        {/* Tabela */}
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortHead k="lead_name">Nome</SortHead>
                  <SortHead k="telefone">Telefone</SortHead>
                  <SortHead k="data_compra">Data de compra</SortHead>
                  <SortHead k="r2_data">R2</SortHead>
                  <SortHead k="closer_r1">Closer R1</SortHead>
                  <SortHead k="closer_r2">Closer R2</SortHead>
                  <SortHead k="status_reuniao">Status</SortHead>
                  <TableHead>Reembolso/Desistência</TableHead>
                  <SortHead k="parceria_rotulo">Parceria</SortHead>
                  <TableHead>Observação</TableHead>
                  <SortHead k="proximo_contato">Próx. contato</SortHead>
                  <TableHead className="w-10">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(safraQ.isLoading || leadsQ.isLoading) ? Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>{Array.from({ length: 12 }).map((__, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
                )) : filtradas.length === 0 ? (
                  <TableRow><TableCell colSpan={12} className="text-center text-muted-foreground py-10">
                    {rows.length === 0 ? 'Nenhum contrato nesta safra' : 'Nenhum lead com esses filtros'}
                  </TableCell></TableRow>
                ) : filtradas.map((r) => {
                  const st = r.status_reuniao || '';
                  const atrasado = r.proximo_contato && r.proximo_contato < hoje;
                  return (
                    <TableRow key={r.contrato_attendee_id} className={cn(r.movimento === 'movido_para' && 'opacity-50')}>
                      <TableCell className="min-w-[180px]">
                        <div className="font-medium">{r.lead_name || '—'}</div>
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {r.movimento === 'veio_de' && <Badge variant="outline" className="text-[10px]">↩ veio de {r.safra_vinculo_label}</Badge>}
                          {r.movimento === 'movido_para' && <Badge variant="outline" className="text-[10px]">→ movido p/ {r.safra_vinculo_label}</Badge>}
                          {r.r2_status_nome?.startsWith('Reprovad') && <Badge variant="outline" className="text-[10px] text-red-400 border-red-500/40">Reprovado</Badge>}
                          {(r.r2_tentativas || 0) > 1 && <Badge variant="outline" className="text-[10px]">{r.r2_tentativas} R2</Badge>}
                          {r.origem === 'transacao' && <Badge variant="outline" className="text-[10px] text-sky-400 border-sky-500/40">Sem R1 (outside)</Badge>}
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {r.telefone ? (
                          <Tooltip>
                            <TooltipTrigger asChild><a href={waLink(r.telefone)} target="_blank" rel="noreferrer" className="text-primary hover:underline">{r.telefone}</a></TooltipTrigger>
                            <TooltipContent>{r.email || 'Sem e-mail'}</TooltipContent>
                          </Tooltip>
                        ) : '—'}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{dDate(r.data_compra, true) || '—'}</TableCell>
                      <TableCell className="whitespace-nowrap">{ddmmHHmm(r.r2_data) || '—'}</TableCell>
                      <TableCell>{r.closer_r1 || '—'}</TableCell>
                      <TableCell>{r.closer_r2 || '—'}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild disabled={!podeEditar}>
                            <button type="button" title={STATUS_TIP[st] || r.r2_status_nome || undefined}>
                              <Badge variant="outline" className={cn('whitespace-nowrap cursor-pointer', STATUS_CLS[st])}>{st || '—'}{podeEditar && <ChevronDown className="h-3 w-3 ml-1" />}</Badge>
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start">
                            {r.r2_attendee_id && <>
                              <DropdownMenuItem onClick={() => marcarR2(r, 'completed')}>Realizado</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => marcarR2(r, 'no_show')}>No Show</DropdownMenuItem>
                            </>}
                            {r.r2_meeting_id && ['No Show', 'Aguardando marcação', 'Agendado'].includes(st) && (
                              <DropdownMenuItem onClick={() => navigate(`/crm/agenda-r2?reschedule=${r.r2_meeting_id}`)}>Reagendar R2</DropdownMenuItem>
                            )}
                            {st === 'Pendente' && !r.r2_meeting_id && (
                              <DropdownMenuItem disabled={!r.deal_id} onClick={() => setAgendarRow(r)}>
                                {r.deal_id ? 'Agendar R2' : 'Lead sem negócio no CRM'}
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            {r.desistencia
                              ? <DropdownMenuItem onClick={() => salvarAcomp(r, { desistencia: false }, { desistencia: false })}>Desfazer desistência</DropdownMenuItem>
                              : <DropdownMenuItem onClick={() => setDesistRow(r)}>Desistência</DropdownMenuItem>}
                            {!r.reembolsado_em && (r.reembolso_solicitado
                              ? <DropdownMenuItem onClick={() => salvarAcomp(r, { reembolso_solicitado: false }, { reembolso_solicitado: false })}>Desfazer reembolso solicitado</DropdownMenuItem>
                              : <DropdownMenuItem onClick={() => salvarAcomp(r, { reembolso_solicitado: true }, { reembolso_solicitado: true })}>Reembolso solicitado</DropdownMenuItem>)}
                            {r.movimento
                              ? <DropdownMenuItem onClick={() => salvarAcomp(r, { safra_id: null })}>Voltar para a safra original</DropdownMenuItem>
                              : <DropdownMenuItem onClick={() => setMoverRow(r)}>Mover para próxima safra</DropdownMenuItem>}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {r.reembolsado_em ? <Badge variant="outline" className="text-red-400 border-red-500/40">Reembolso {dDate(r.reembolsado_em)}</Badge>
                          : r.reembolso_solicitado ? <Badge variant="outline" className="text-amber-400 border-amber-500/40">Reembolso solicitado</Badge>
                          : r.desistencia ? (
                            <Tooltip>
                              <TooltipTrigger asChild><Badge variant="outline" className="text-orange-400 border-orange-500/40">Desistência</Badge></TooltipTrigger>
                              <TooltipContent className="max-w-[300px] whitespace-normal">{r.motivo || 'Sem motivo'}</TooltipContent>
                            </Tooltip>
                          ) : '—'}
                      </TableCell>
                      <TableCell>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex flex-wrap items-center gap-1">
                              <span className={cn(r.parceria_rotulo === 'Não comprou' && 'text-muted-foreground')}>{r.parceria_rotulo || '—'}</span>
                              {r.parceria_quando === 'pos_carrinho' && <Badge variant="outline" className="text-[10px] text-purple-400 border-purple-500/40">PÓS CARRINHO</Badge>}
                            </div>
                          </TooltipTrigger>
                          {r.parceria_produtos && (
                            <TooltipContent className="max-w-[320px] whitespace-normal">
                              {r.parceria_produtos}{r.parceria_data ? ` · ${dDate(r.parceria_data, true)}` : ''}{r.parceria_liquido != null ? ` · ${formatCurrency(Number(r.parceria_liquido))}` : ''}
                            </TooltipContent>
                          )}
                        </Tooltip>
                      </TableCell>
                      <TableCell className="min-w-[200px]">
                        <ObservacaoCell row={r} onSave={(v) => salvarAcomp(r, { observacao: v }, { observacao: v })} />
                      </TableCell>
                      <TableCell>
                        <Input type="date" value={r.proximo_contato || ''} className={cn('h-8 w-[140px]', atrasado && 'text-red-400 border-red-500/60')}
                          onChange={(e) => { const v = e.target.value || null; salvarAcomp(r, { proximo_contato: v }, { proximo_contato: v }); }} />
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {r.deal_id && <DropdownMenuItem onClick={() => navigate(`/crm/negocios?deal=${r.deal_id}`)}>Abrir negócio</DropdownMenuItem>}
                            {r.r2_meeting_id && <DropdownMenuItem onClick={() => navigate('/crm/agenda-r2')}>Abrir R2 na agenda</DropdownMenuItem>}
                            {!r.deal_id && !r.r2_meeting_id && <DropdownMenuItem disabled>Sem ações</DropdownMenuItem>}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Conversão */}
        <Collapsible defaultOpen>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-1"><ChevronDown className="h-4 w-4" />Conversão por closer</Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="grid gap-3 lg:grid-cols-2">
              <TabelaConversao titulo="Por Closer R1" rows={contaveis} campo="closer_r1" />
              <TabelaConversao titulo="Por Closer R2" rows={contaveis} campo="closer_r2" />
            </div>
          </CollapsibleContent>
        </Collapsible>

        {safra && <EditarSafraDialog open={editOpen} onOpenChange={setEditOpen} safra={safra} onSaved={invalidar} />}

        <R2QuickScheduleModal
          open={!!agendarRow}
          onOpenChange={(o) => { if (!o) { setAgendarRow(null); qc.invalidateQueries({ queryKey: ['carrinho-safra-leads'] }); } }}
          closers={r2Closers}
          statusOptions={statusOptions}
          thermometerOptions={thermometerOptions}
          preselectedDeal={agendarRow?.deal_id ? {
            id: agendarRow.deal_id,
            name: agendarRow.lead_name || '',
            contact: agendarRow.contact_id ? { id: agendarRow.contact_id, name: agendarRow.lead_name || '', phone: agendarRow.telefone, email: agendarRow.email } : null,
          } : undefined}
        />
        <DesistenciaDialog row={desistRow} onClose={() => setDesistRow(null)}
          onConfirm={async (motivo) => { if (desistRow && await salvarAcomp(desistRow, { desistencia: true, motivo }, { desistencia: true, motivo })) setDesistRow(null); }} />

        <Dialog open={!!moverRow} onOpenChange={(o) => !o && setMoverRow(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Mover para a próxima safra?</DialogTitle>
              <DialogDescription>{moverRow?.lead_name} sai dos totais desta safra e passa a contar na próxima.</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setMoverRow(null)}>Cancelar</Button>
              <Button onClick={async () => { const r = moverRow; setMoverRow(null); if (r) await moverProxima(r); }}>Mover</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}

function FiltroSelect({ valor, onChange, todos, itens, rotulo }: { valor: string; onChange: (v: string) => void; todos: string; itens: string[]; rotulo?: (s: string) => string }) {
  return (
    <Select value={valor} onValueChange={onChange}>
      <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="todos">{todos}</SelectItem>
        {itens.map((i) => <SelectItem key={i} value={i}>{rotulo ? rotulo(i) : i}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function ObservacaoCell({ row, onSave }: { row: LeadRow; onSave: (v: string) => void }) {
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(row.observacao || '');
  useEffect(() => { if (!editando) setValor(row.observacao || ''); }, [row.observacao, editando]);
  const salvar = () => {
    setEditando(false);
    if ((row.observacao || '') !== valor) onSave(valor);
  };
  if (editando) {
    return (
      <Textarea autoFocus value={valor} rows={2} className="text-sm min-h-[60px]"
        onChange={(e) => setValor(e.target.value)} onBlur={salvar}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); salvar(); }
          if (e.key === 'Escape') { setValor(row.observacao || ''); setEditando(false); }
        }} />
    );
  }
  const quem = row.acompanhamento_atualizado_em
    ? `atualizado por ${row.acompanhamento_atualizado_por || '—'} em ${ddmmHHmm(row.acompanhamento_atualizado_em)}` : null;
  const conteudo = (
    <button className="text-left w-full text-sm min-h-[24px] rounded px-1 hover:bg-muted" onClick={() => setEditando(true)}>
      {row.observacao || <span className="text-muted-foreground">Adicionar…</span>}
    </button>
  );
  if (!quem) return conteudo;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{conteudo}</TooltipTrigger>
      <TooltipContent>{quem}</TooltipContent>
    </Tooltip>
  );
}

function DesistenciaDialog({ row, onClose, onConfirm }: { row: LeadRow | null; onClose: () => void; onConfirm: (motivo: string) => void }) {
  const [motivo, setMotivo] = useState('');
  useEffect(() => { if (row) setMotivo(row.motivo || ''); }, [row]);
  return (
    <Dialog open={!!row} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Marcar desistência</DialogTitle>
          <DialogDescription>{row?.lead_name}</DialogDescription>
        </DialogHeader>
        <div className="space-y-1">
          <Label>Motivo (obrigatório)</Label>
          <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button disabled={!motivo.trim()} onClick={() => onConfirm(motivo.trim())}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditarSafraDialog({ open, onOpenChange, safra, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; safra: Safra; onSaved: () => void }) {
  const [ini, setIni] = useState(safra.data_inicial);
  const [fim, setFim] = useState(safra.data_final);
  const [fData, setFData] = useState('');
  const [fHora, setFHora] = useState('');
  const [obs, setObs] = useState(safra.observacao || '');
  const [salvando, setSalvando] = useState(false);
  useEffect(() => {
    if (!open) return;
    setIni(safra.data_inicial); setFim(safra.data_final); setObs(safra.observacao || '');
    const p = isoParaPartesSP(safra.fechamento_carrinho); setFData(p.data); setFHora(p.hora);
  }, [open, safra]);

  const salvar = async () => {
    setSalvando(true);
    const { error } = await rpc('carrinho_safra_salvar', {
      p_id: safra.id, p_data_inicial: ini, p_data_final: fim,
      p_fechamento: `${fData}T${fHora}:00-03:00`, p_observacao: obs || null,
    });
    setSalvando(false);
    if (error) { toast.error(error.message || 'Erro ao salvar safra'); return; }
    toast.success('Safra salva');
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar safra</DialogTitle>
          <DialogDescription>
            Padrão: quarta a terça. Contratos pagos dentro dessas datas entram nesta safra. Compras de parceria até o fechamento contam no carrinho; depois viram PÓS CARRINHO. Ao alterar, as safras vizinhas automáticas se ajustam.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1"><Label>Data inicial</Label><Input type="date" value={ini} onChange={(e) => setIni(e.target.value)} /></div>
          <div className="space-y-1"><Label>Data final</Label><Input type="date" value={fim} onChange={(e) => setFim(e.target.value)} /></div>
          <div className="space-y-1"><Label>Fechamento (data)</Label><Input type="date" value={fData} onChange={(e) => setFData(e.target.value)} /></div>
          <div className="space-y-1"><Label>Fechamento (hora, Brasília)</Label><Input type="time" value={fHora} onChange={(e) => setFHora(e.target.value)} /></div>
          <div className="col-span-2 space-y-1"><Label>Observação</Label><Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={salvando || !ini || !fim || !fData || !fHora} onClick={salvar}>{salvando ? 'Salvando…' : 'Salvar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TabelaConversao({ titulo, rows, campo }: { titulo: string; rows: LeadRow[]; campo: 'closer_r1' | 'closer_r2' }) {
  const linhas = useMemo(() => {
    const m = new Map<string, { contratos: number; realizadas: number; compraram: number; pos: number; reembolsos: number }>();
    rows.forEach((r) => {
      const k = r[campo] || 'Sem closer';
      const a = m.get(k) || { contratos: 0, realizadas: 0, compraram: 0, pos: 0, reembolsos: 0 };
      a.contratos++;
      if (r.status_reuniao === 'Realizado') a.realizadas++;
      if (r.parceria_quando === 'carrinho') a.compraram++;
      if (r.parceria_quando === 'pos_carrinho') a.pos++;
      if (r.reembolsado_em) a.reembolsos++;
      m.set(k, a);
    });
    return Array.from(m.entries()).sort((a, b) => b[1].contratos - a[1].contratos);
  }, [rows, campo]);
  return (
    <Card>
      <CardContent className="p-0">
        <div className="px-4 py-2 font-medium text-sm border-b">{titulo}</div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Closer</TableHead><TableHead className="text-right">Contratos</TableHead><TableHead className="text-right">R2 realizadas</TableHead>
              <TableHead className="text-right">Compraram (carrinho)</TableHead><TableHead className="text-right">Pós-carrinho</TableHead>
              <TableHead className="text-right">Reembolsos</TableHead><TableHead className="text-right">Conversão</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {linhas.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Sem dados</TableCell></TableRow>
            ) : linhas.map(([nome, a]) => (
              <TableRow key={nome}>
                <TableCell>{nome}</TableCell>
                <TableCell className="text-right">{a.contratos}</TableCell>
                <TableCell className="text-right">{a.realizadas}</TableCell>
                <TableCell className="text-right">{a.compraram}</TableCell>
                <TableCell className="text-right">{a.pos}</TableCell>
                <TableCell className="text-right">{a.reembolsos}</TableCell>
                <TableCell className="text-right">{a.realizadas ? `${((a.compraram / a.realizadas) * 100).toFixed(1)}%` : '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
