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

function Card_({ item, onOpen, onJudicial, onBaixar }: { item: ParcelaCard; onOpen: () => void; onJudicial: () => void; onBaixar: (valor: number, data: string, forma: string) => Promise<void> }) {
  const { titulo, parcela, diasAtraso } = item;
  const venc = parcela.data_vencimento ? format(new Date(parcela.data_vencimento + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR }) : '—';
  return (
    <div className="rounded-md border bg-card p-3 shadow-sm hover:shadow-md transition-shadow space-y-2">
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
        <span>{venc}</span>
      </div>
      <div className="flex items-center gap-2 pt-1">
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

export function KanbanCobranca() {
  const navigate = useNavigate();
  const { data: titulos, isLoading } = useArTitulos({ status: 'aberto' });
  const updateStage = useUpdateCobrancaStage();
  const baixar = useMarkArParcelaPaga();

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

    (parcelas ?? []).forEach(p => {
      const titulo = tituloMap.get(p.titulo_id);
      if (!titulo) return;

      const dv = p.data_vencimento ? new Date(p.data_vencimento + 'T00:00:00') : null;
      const diasAtraso = dv && dv < today ? Math.floor((today.getTime() - dv.getTime()) / 86400000) : 0;

      let stage: ArCobrancaStage;
      // Título marcado judicial (manual) leva todas as parcelas em aberto para judicial
      if (titulo.cobranca_stage === 'judicial') {
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
  }, [titulos, parcelas]);

  const onDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    const stage = result.destination.droppableId as ArCobrancaStage;
    // draggableId = parcelaId; recuperar titulo_id do source bucket
    const parcelaId = result.draggableId;
    const src = result.source.droppableId as ArCobrancaStage;
    if (stage === src) return;
    const item = byStage[src].find(i => i.parcela.id === parcelaId);
    if (!item) return;
    try {
      await updateStage.mutateAsync({ tituloId: item.titulo.id, stage });
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {STAGES.map(stage => {
          const list = byStage[stage.id];
          const totalSaldo = list.reduce((s, i) => s + (Number(i.parcela.valor) || 0), 0);
          const Icon = stage.icon;
          return (
            <Card key={stage.id} className={`border-t-4 ${stage.accent}`}>
              <CardContent className="p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-muted-foreground" />
                    <div className="font-semibold text-sm">{stage.title}</div>
                  </div>
                  <Badge variant="secondary">{list.length}</Badge>
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
                      {list.length === 0 && (
                        <div className="text-center text-xs text-muted-foreground py-8">
                          <Wallet className="w-6 h-6 mx-auto mb-2 opacity-30" />
                          Sem parcelas
                        </div>
                      )}
                      {list.map((item, idx) => (
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