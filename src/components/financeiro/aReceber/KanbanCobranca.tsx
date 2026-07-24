import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { MoreVertical, Wallet, PhoneCall, Gavel, ExternalLink, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Search, ChevronDown, ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { useArTitulos, useUpdateCobrancaStage, useRegistrarCobrancaContato, useMarkArParcelaPaga } from '@/hooks/useAReceber';
import type { ArCobrancaStage, ArTitulo, ArParcela } from '@/types/aReceber';
import { AR_COBRANCA_STAGE_LABEL } from '@/types/aReceber';
import { parcelaDocNumber } from '@/lib/arTicketNumber';

const brl = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

const STAGES: { id: ArCobrancaStage; title: string; accent: string; icon: any }[] = [
  { id: 'mes', title: AR_COBRANCA_STAGE_LABEL.mes, accent: 'border-t-blue-500', icon: Clock },
  { id: 'atraso', title: AR_COBRANCA_STAGE_LABEL.atraso, accent: 'border-t-amber-500', icon: AlertTriangle },
  { id: 'judicial', title: AR_COBRANCA_STAGE_LABEL.judicial, accent: 'border-t-red-600', icon: Gavel },
];

export function CobrancaStageBadge({ stage }: { stage: ArCobrancaStage }) {
  const map: Record<ArCobrancaStage, string> = {
    mes: 'bg-blue-500/15 text-blue-600 border-blue-500/30',
    atraso: 'bg-amber-500/15 text-amber-600 border-amber-500/30',
    judicial: 'bg-red-500/15 text-red-600 border-red-500/30',
  };
  return (
    <Badge variant="outline" className={map[stage]}>
      {AR_COBRANCA_STAGE_LABEL[stage]}
    </Badge>
  );
}

type ParcelaCard = {
  parcela: ArParcela;
  titulo: ArTitulo;
  stage: ArCobrancaStage;
  diasAtraso: number;
};

function ContatoDialog({ titulo, onDone }: { titulo: ArTitulo; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const contato = useRegistrarCobrancaContato();
  const submit = async () => {
    if (!text.trim()) return toast.error('Descreva o contato realizado');
    try {
      await contato.mutateAsync({ tituloId: titulo.id, descricao: text.trim() });
      toast.success('Contato registrado');
      setText('');
      setOpen(false);
      onDone();
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao registrar');
    }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setOpen(true); }}>
          <PhoneCall className="w-4 h-4 mr-2" /> Registrar contato
        </DropdownMenuItem>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar contato de cobrança</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label>Cliente</Label>
          <div className="text-sm text-muted-foreground">{titulo.customer_name}</div>
          <Label>Descrição</Label>
          <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} placeholder="Ex.: Ligação realizada. Cliente prometeu pagamento até 20/07..." />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={contato.isPending}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BaixarParcelaDialog({ item, onConfirm }: { item: ParcelaCard; onConfirm: (valor: number, data: string, forma: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [valor, setValor] = useState<string>(String(item.parcela.valor ?? 0));
  const [data, setData] = useState<string>(new Date().toISOString().slice(0, 10));
  const [forma, setForma] = useState<string>(item.titulo.payment_method || 'pix');
  const [loading, setLoading] = useState(false);
  const submit = async () => {
    setLoading(true);
    try {
      await onConfirm(Number(valor) || 0, data, forma);
      setOpen(false);
      toast.success('Parcela baixada');
    } catch (e: any) {
      toast.error(e?.message || 'Erro');
    } finally {
      setLoading(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setOpen(true); }}>
          <CheckCircle2 className="w-4 h-4 mr-2" /> Baixar parcela
        </DropdownMenuItem>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Baixar parcela {item.parcela.numero}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="text-sm text-muted-foreground">{item.titulo.customer_name}</div>
          <div>
            <Label>Valor pago</Label>
            <input className="w-full mt-1 rounded-md border bg-background px-3 py-2 text-sm" type="number" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} />
          </div>
          <div>
            <Label>Data do pagamento</Label>
            <input className="w-full mt-1 rounded-md border bg-background px-3 py-2 text-sm" type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </div>
          <div>
            <Label>Forma de pagamento</Label>
            <input className="w-full mt-1 rounded-md border bg-background px-3 py-2 text-sm" value={forma} onChange={(e) => setForma(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={loading}>Confirmar baixa</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function isVencimentoNaSemanaCorrente(dataVencimento: string | null): boolean {
  if (!dataVencimento) return false;
  const venc = new Date(dataVencimento + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const limite = new Date(today);
  limite.setDate(today.getDate() + 7);
  limite.setHours(23, 59, 59, 999);
  return venc >= today && venc <= limite;
}

function Card_({ item, onOpen, onJudicial, onBaixar }: { item: ParcelaCard; onOpen: () => void; onJudicial: () => void; onBaixar: (valor: number, data: string, forma: string) => Promise<void> }) {
  const { titulo, parcela, diasAtraso } = item;
  const venc = parcela.data_vencimento ? format(new Date(parcela.data_vencimento + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR }) : '—';
  const venceEstaSemana = isVencimentoNaSemanaCorrente(parcela.data_vencimento);
  return (
    <div className={`rounded-md border bg-card p-3 shadow-sm hover:shadow-md transition-all space-y-2 ${venceEstaSemana ? 'ring-2 ring-lime-500 border-lime-500/70 bg-lime-500/5' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-medium text-sm truncate">{titulo.customer_name}</div>
          <div className="text-xs text-muted-foreground truncate">
            {titulo.product_code} · {titulo.product_name}
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" className="h-6 w-6">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <BaixarParcelaDialog item={item} onConfirm={onBaixar} />
            <DropdownMenuItem onSelect={onOpen}>
              <ExternalLink className="w-4 h-4 mr-2" /> Abrir detalhes
            </DropdownMenuItem>
            <ContatoDialog titulo={titulo} onDone={() => {}} />
            <DropdownMenuSeparator />
            {item.stage !== 'judicial' && (
              <DropdownMenuItem onSelect={onJudicial} className="text-red-600">
                <Gavel className="w-4 h-4 mr-2" /> Mover para judicial
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Documento</span>
        <span className="font-mono font-medium">{parcelaDocNumber(titulo.id, parcela.numero)}</span>
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Parcela</span>
        <span className="font-medium">{parcela.numero}/{titulo.total_installments_hubla || parcela.numero}</span>
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Valor</span>
        <span className="font-semibold text-amber-600">{brl(Number(parcela.valor) || 0)}</span>
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Vencimento</span>
        <span className={venceEstaSemana ? 'font-semibold text-lime-600' : ''}>{venc}</span>
      </div>
      <div className="flex items-center gap-2 pt-1 flex-wrap">
        {venceEstaSemana && (
          <Badge variant="outline" className="bg-lime-500/15 text-lime-700 border-lime-500/40 text-[10px] animate-pulse">
            Vence em até 7 dias
          </Badge>
        )}
        {diasAtraso > 0 && (
          <Badge variant="outline" className="bg-red-500/15 text-red-600 border-red-500/30 text-[10px]">
            {diasAtraso}d em atraso
          </Badge>
        )}
        {parcela.tipo_parcela === 'entrada' && (
          <Badge variant="outline" className="text-[10px]">Entrada</Badge>
        )}
      </div>
    </div>
  );
}

function JudicialGroupCard({
  titulo,
  items,
  onOpen,
  onBaixar,
}: {
  titulo: ArTitulo;
  items: ParcelaCard[];
  onOpen: () => void;
  onBaixar: (item: ParcelaCard, valor: number, data: string, forma: string) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(items.length <= 1);
  const total = items.reduce((s, i) => s + (Number(i.parcela.valor) || 0), 0);
  const maxAtraso = items.reduce((m, i) => Math.max(m, i.diasAtraso), 0);
  return (
    <div className="rounded-md border bg-card p-3 shadow-sm hover:shadow-md transition-all space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-medium text-sm truncate">{titulo.customer_name}</div>
          <div className="text-xs text-muted-foreground truncate">
            {titulo.product_code} · {titulo.product_name}
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" className="h-6 w-6">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onOpen}>
              <ExternalLink className="w-4 h-4 mr-2" /> Abrir detalhes
            </DropdownMenuItem>
            <ContatoDialog titulo={titulo} onDone={() => {}} />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Parcelas em cobrança</span>
        <span className="font-medium">{items.length}</span>
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Total em aberto</span>
        <span className="font-semibold text-red-600 text-sm">{brl(total)}</span>
      </div>
      {maxAtraso > 0 && (
        <div className="flex flex-wrap gap-1 pt-1">
          <Badge variant="outline" className="bg-red-500/15 text-red-600 border-red-500/30 text-[10px]">
            Máx. {maxAtraso}d em atraso
          </Badge>
        </div>
      )}
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="w-full mt-1 flex items-center justify-center gap-1 text-[11px] text-muted-foreground hover:text-foreground border-t pt-2"
      >
        {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        {expanded ? 'Ocultar detalhes' : `Ver ${items.length} parcela${items.length > 1 ? 's' : ''}`}
      </button>
      {expanded && (
        <div className="space-y-1.5 pt-1">
          {items.map(it => {
            const venc = it.parcela.data_vencimento
              ? format(new Date(it.parcela.data_vencimento + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR })
              : '—';
            return (
              <div key={it.parcela.id} className="rounded border bg-muted/30 px-2 py-1.5 text-[11px] space-y-0.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono">{parcelaDocNumber(titulo.id, it.parcela.numero)}</span>
                  <span className="font-semibold">{brl(Number(it.parcela.valor) || 0)}</span>
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>
                    Parc. {it.parcela.numero}/{titulo.total_installments_hubla || it.parcela.numero} · venc. {venc}
                  </span>
                  {it.diasAtraso > 0 && (
                    <span className="text-red-600 font-medium">{it.diasAtraso}d</span>
                  )}
                </div>
                <div className="flex justify-end pt-0.5">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]">
                        Ações
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <BaixarParcelaDialog
                        item={it}
                        onConfirm={(v, d, f) => onBaixar(it, v, d, f)}
                      />
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function KanbanCobranca() {
  const navigate = useNavigate();
  // Buscamos todos os títulos (inclusive quitados) — os cards do Kanban são
  // gerados a partir das parcelas em aberto, então títulos sem parcela pendente
  // simplesmente não aparecem. Isso evita ocultar cobranças futuras quando o
  // título foi marcado como quitado apenas com base na entrada.
  const { data: titulos, isLoading } = useArTitulos({ status: 'todos' });
  const updateStage = useUpdateCobrancaStage();
  const baixar = useMarkArParcelaPaga();

  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [nameFilter, setNameFilter] = useState<string>('');

  const tituloIds = useMemo(() => (titulos ?? []).map(t => t.id), [titulos]);

  const { data: parcelas, isLoading: loadingParcelas } = useQuery({
    queryKey: ['ar-parcelas-kanban', tituloIds],
    enabled: tituloIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ar_parcelas' as any)
        .select('*')
        .in('titulo_id', tituloIds)
        .neq('status', 'pago')
        .neq('status', 'cancelado')
        .order('data_vencimento', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as ArParcela[];
    },
  });

  const byStage = useMemo(() => {
    const buckets: Record<ArCobrancaStage, ParcelaCard[]> = { mes: [], atraso: [], judicial: [] };
    const tituloMap = new Map<string, ArTitulo>((titulos ?? []).map(t => [t.id, t]));
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const q = nameFilter.trim().toLowerCase();

    (parcelas ?? []).forEach(p => {
      const titulo = tituloMap.get(p.titulo_id);
      if (!titulo) return;
      if (q && !(titulo.customer_name || '').toLowerCase().includes(q)) return;

      const dv = p.data_vencimento ? new Date(p.data_vencimento + 'T00:00:00') : null;
      const diasAtraso = dv && dv < today ? Math.floor((today.getTime() - dv.getTime()) / 86400000) : 0;

      let stage: ArCobrancaStage;
      // Título marcado judicial (manual) leva apenas parcelas em aberto
      // (em atraso ou vencendo no mês corrente) para a coluna judicial.
      // Parcelas futuras além do mês corrente ficam ocultas.
      if (titulo.cobranca_stage === 'judicial') {
        const vencidaOuNoMes =
          diasAtraso > 0 || (dv && dv >= monthStart && dv <= monthEnd);
        if (!vencidaOuNoMes) return;
        stage = 'judicial';
      } else if (diasAtraso > 0) {
        stage = 'atraso';
      } else {
        stage = 'mes';
      }
      buckets[stage].push({ parcela: p, titulo, stage, diasAtraso });
    });

    // ordena cada bucket por vencimento (atraso primeiro pelos mais antigos)
    (Object.keys(buckets) as ArCobrancaStage[]).forEach(k => {
      buckets[k].sort((a, b) => (a.parcela.data_vencimento || '').localeCompare(b.parcela.data_vencimento || ''));
    });
    return buckets;
  }, [titulos, parcelas, nameFilter]);

  const totalsFiltered = useMemo(() => {
    const totals: Record<ArCobrancaStage, number> = { mes: 0, atraso: 0, judicial: 0 };
    const counts: Record<ArCobrancaStage, number> = { mes: 0, atraso: 0, judicial: 0 };
    (Object.keys(byStage) as ArCobrancaStage[]).forEach(k => {
      byStage[k].forEach(item => {
        const dv = item.parcela.data_vencimento || '';
        if (dateFrom && dv < dateFrom) return;
        if (dateTo && dv > dateTo) return;
        totals[k] += Number(item.parcela.valor) || 0;
        counts[k] += 1;
      });
    });
    return { totals, counts };
  }, [byStage, dateFrom, dateTo]);

  const onDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    const stage = result.destination.droppableId as ArCobrancaStage;
    const src = result.source.droppableId as ArCobrancaStage;
    if (stage === src) return;
    const draggableId = result.draggableId;
    let tituloId: string | undefined;
    if (draggableId.startsWith('judicial-')) {
      tituloId = draggableId.replace('judicial-', '');
    } else {
      const item = byStage[src].find(i => i.parcela.id === draggableId);
      tituloId = item?.titulo.id;
    }
    if (!tituloId) return;
    try {
      await updateStage.mutateAsync({ tituloId, stage });
      toast.success(`Movido para ${AR_COBRANCA_STAGE_LABEL[stage]}`);
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao mover');
    }
  };

  const moveToJudicial = async (tituloId: string) => {
    try {
      await updateStage.mutateAsync({ tituloId, stage: 'judicial', motivo: 'Enviado para cobrança judicial' });
      toast.success('Movido para Cobrança judicial');
    } catch (e: any) {
      toast.error(e?.message || 'Erro');
    }
  };

  if (isLoading || loadingParcelas) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {STAGES.map(s => <Skeleton key={s.id} className="h-96" />)}
      </div>
    );
  }

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="space-y-4 mb-4">
        <div className="flex flex-wrap items-end gap-3 rounded-md border bg-card p-3">
          <div className="flex-1 min-w-[220px] max-w-sm">
            <Label className="text-xs">Buscar cliente</Label>
            <div className="relative mt-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={nameFilter}
                onChange={(e) => setNameFilter(e.target.value)}
                placeholder="Nome do cliente..."
                className="pl-8 h-9"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Vencimento de</Label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="mt-1 block rounded-md border bg-background px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs">até</Label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="mt-1 block rounded-md border bg-background px-3 py-1.5 text-sm"
            />
          </div>
          {(dateFrom || dateTo || nameFilter) && (
            <Button variant="ghost" size="sm" onClick={() => { setDateFrom(''); setDateTo(''); setNameFilter(''); }}>
              Limpar
            </Button>
          )}
          <div className="ml-auto text-xs text-muted-foreground">
            Totais consideram vencimento no período selecionado
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {STAGES.map(s => {
            const Icon = s.icon;
            const color =
              s.id === 'mes' ? 'text-blue-600' :
              s.id === 'atraso' ? 'text-amber-600' : 'text-red-600';
            return (
              <Card key={s.id} className={`border-t-4 ${s.accent}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <Icon className={`w-4 h-4 ${color}`} />
                      {s.title}
                    </div>
                    <Badge variant="secondary">{totalsFiltered.counts[s.id]}</Badge>
                  </div>
                  <div className={`mt-2 text-2xl font-bold ${color}`}>
                    {brl(totalsFiltered.totals[s.id])}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {STAGES.map(stage => {
          const list = byStage[stage.id];
          const totalSaldo = list.reduce((s, i) => s + (Number(i.parcela.valor) || 0), 0);
          const Icon = stage.icon;
          // Para judicial, agrupa parcelas por título (um card por cliente/título)
          const judicialGroups: { titulo: ArTitulo; items: ParcelaCard[] }[] = [];
          if (stage.id === 'judicial') {
            const map = new Map<string, { titulo: ArTitulo; items: ParcelaCard[] }>();
            list.forEach(item => {
              const g = map.get(item.titulo.id);
              if (g) g.items.push(item);
              else map.set(item.titulo.id, { titulo: item.titulo, items: [item] });
            });
            judicialGroups.push(...Array.from(map.values()));
          }
          const displayCount = stage.id === 'judicial' ? judicialGroups.length : list.length;
          return (
            <Card key={stage.id} className={`border-t-4 ${stage.accent}`}>
              <CardContent className="p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-muted-foreground" />
                    <div className="font-semibold text-sm">{stage.title}</div>
                  </div>
                  <Badge variant="secondary">{displayCount}</Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  Saldo: <span className="font-medium text-foreground">{brl(totalSaldo)}</span>
                </div>
                <Droppable droppableId={stage.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`space-y-2 min-h-[200px] rounded-md p-1 transition-colors ${snapshot.isDraggingOver ? 'bg-muted/60' : ''}`}
                    >
                      {displayCount === 0 && (
                        <div className="text-center text-xs text-muted-foreground py-8">
                          <Wallet className="w-6 h-6 mx-auto mb-2 opacity-30" />
                          Sem parcelas
                        </div>
                      )}
                      {stage.id !== 'judicial' && list.map((item, idx) => (
                        <Draggable key={item.parcela.id} draggableId={item.parcela.id} index={idx}>
                          {(dp) => (
                            <div
                              ref={dp.innerRef}
                              {...dp.draggableProps}
                              {...dp.dragHandleProps}
                            >
                              <Card_
                                item={item}
                                onOpen={() => navigate(`/financeiro/a-receber/${item.titulo.id}`)}
                                onJudicial={() => moveToJudicial(item.titulo.id)}
                                onBaixar={(valor, data, forma) => baixar.mutateAsync({
                                  id: item.parcela.id,
                                  tituloId: item.titulo.id,
                                  valor_pago: valor,
                                  data_pagamento: data,
                                  forma_pagamento: forma,
                                })}
                              />
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {stage.id === 'judicial' && judicialGroups.map((g, idx) => (
                        <Draggable key={g.titulo.id} draggableId={`judicial-${g.titulo.id}`} index={idx}>
                          {(dp) => (
                            <div
                              ref={dp.innerRef}
                              {...dp.draggableProps}
                              {...dp.dragHandleProps}
                            >
                              <JudicialGroupCard
                                titulo={g.titulo}
                                items={g.items}
                                onOpen={() => navigate(`/financeiro/a-receber/${g.titulo.id}`)}
                                onBaixar={(it, valor, data, forma) => baixar.mutateAsync({
                                  id: it.parcela.id,
                                  tituloId: it.titulo.id,
                                  valor_pago: valor,
                                  data_pagamento: data,
                                  forma_pagamento: forma,
                                })}
                              />
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </DragDropContext>
  );
}