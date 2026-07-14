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
import { MoreVertical, Wallet, PhoneCall, Gavel, ExternalLink, Clock, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useArTitulos, useUpdateCobrancaStage, useRegistrarCobrancaContato } from '@/hooks/useAReceber';
import type { ArCobrancaStage, ArTitulo } from '@/types/aReceber';
import { AR_COBRANCA_STAGE_LABEL } from '@/types/aReceber';

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

function Card_({ titulo, onOpen, onJudicial }: { titulo: ArTitulo; onOpen: () => void; onJudicial: () => void }) {
  const atrasoBadge = (titulo.dias_atraso ?? 0) > 0;
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
            <DropdownMenuItem onSelect={onOpen}>
              <ExternalLink className="w-4 h-4 mr-2" /> Abrir detalhes
            </DropdownMenuItem>
            <ContatoDialog titulo={titulo} onDone={() => {}} />
            <DropdownMenuSeparator />
            {titulo.stage_effective !== 'judicial' && (
              <DropdownMenuItem onSelect={onJudicial} className="text-red-600">
                <Gavel className="w-4 h-4 mr-2" /> Mover para judicial
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Saldo</span>
        <span className="font-semibold text-amber-600">{brl(titulo.valor_pendente || 0)}</span>
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Próx. vencimento</span>
        <span>{titulo.proxima_parcela ? format(new Date(titulo.proxima_parcela + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR }) : '—'}</span>
      </div>
      <div className="flex items-center gap-2 pt-1">
        {atrasoBadge && (
          <Badge variant="outline" className="bg-red-500/15 text-red-600 border-red-500/30 text-[10px]">
            {titulo.dias_atraso}d em atraso
          </Badge>
        )}
        <Badge variant="outline" className="text-[10px]">
          {titulo.parcelas_pagas}/{titulo.parcelas_total} parcelas
        </Badge>
      </div>
    </div>
  );
}

export function KanbanCobranca() {
  const navigate = useNavigate();
  const { data: titulos, isLoading } = useArTitulos({ status: 'aberto' });
  const updateStage = useUpdateCobrancaStage();

  const byStage = useMemo(() => {
    const buckets: Record<ArCobrancaStage, ArTitulo[]> = { mes: [], atraso: [], judicial: [] };
    (titulos ?? []).forEach(t => {
      const s = (t.stage_effective || 'mes') as ArCobrancaStage;
      buckets[s].push(t);
    });
    return buckets;
  }, [titulos]);

  const onDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    const stage = result.destination.droppableId as ArCobrancaStage;
    const tituloId = result.draggableId;
    const src = result.source.droppableId as ArCobrancaStage;
    if (stage === src) return;
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

  if (isLoading) {
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
          const totalSaldo = list.reduce((s, t) => s + (t.valor_pendente || 0), 0);
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
                          Sem títulos
                        </div>
                      )}
                      {list.map((t, idx) => (
                        <Draggable key={t.id} draggableId={t.id} index={idx}>
                          {(dp) => (
                            <div
                              ref={dp.innerRef}
                              {...dp.draggableProps}
                              {...dp.dragHandleProps}
                            >
                              <Card_
                                titulo={t}
                                onOpen={() => navigate(`/financeiro/a-receber/${t.id}`)}
                                onJudicial={() => moveToJudicial(t.id)}
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