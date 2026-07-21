import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Undo2, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useArTitulos } from '@/hooks/useAReceber';
import {
  useArReembolsos,
  useCriarReembolso,
  useMarcarReembolsoPago,
  useCancelarReembolso,
} from '@/hooks/useArReembolsos';
import { AR_REEMBOLSO_STATUS_LABEL, type ArReembolsoStatus } from '@/types/aReceber';
import { ticketNumber } from '@/lib/arTicketNumber';

const brl = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

function StatusBadge({ status }: { status: ArReembolsoStatus }) {
  const cfg: Record<ArReembolsoStatus, { className: string; Icon: any }> = {
    pendente: { className: 'bg-amber-500/15 text-amber-600 border-amber-500/30', Icon: Clock },
    pago: { className: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30', Icon: CheckCircle2 },
    cancelado: { className: 'bg-muted text-muted-foreground', Icon: XCircle },
  };
  const c = cfg[status];
  const I = c.Icon;
  return (
    <Badge variant="outline" className={c.className}>
      <I className="w-3 h-3 mr-1" />
      {AR_REEMBOLSO_STATUS_LABEL[status]}
    </Badge>
  );
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function ReembolsosPanel({ open, onOpenChange }: Props) {
  const [tab, setTab] = useState<'novo' | 'lista'>('novo');

  // ============ NOVO REEMBOLSO ============
  const [search, setSearch] = useState('');
  const { data: titulos, isLoading: loadingTit } = useArTitulos({
    search: search.trim() || undefined,
  });
  const [selectedTituloId, setSelectedTituloId] = useState<string | null>(null);
  const selectedTitulo = useMemo(
    () => (titulos || []).find((t) => t.id === selectedTituloId) || null,
    [titulos, selectedTituloId],
  );

  const [valor, setValor] = useState<string>('');
  const [motivo, setMotivo] = useState<string>('');
  const [dataPedido, setDataPedido] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [dataPrevista, setDataPrevista] = useState<string>('');

  const criar = useCriarReembolso();

  const handleSelect = (id: string) => {
    setSelectedTituloId(id);
    const t = (titulos || []).find((x) => x.id === id);
    if (t) setValor(String(Number(t.valor_total || 0).toFixed(2)));
  };

  const handleCriar = async () => {
    if (!selectedTitulo) return;
    const v = Number(valor);
    if (!Number.isFinite(v) || v <= 0) {
      toast.error('Informe um valor de reembolso válido.');
      return;
    }
    if (!dataPedido) {
      toast.error('Informe a data do pedido.');
      return;
    }
    try {
      await criar.mutateAsync({
        titulo_id: selectedTitulo.id,
        valor: v,
        motivo: motivo.trim() || undefined,
        data_pedido: dataPedido,
        data_prevista_pagamento: dataPrevista || null,
      });
      toast.success('Reembolso criado. Pagamentos do título foram estornados.');
      setSelectedTituloId(null);
      setValor('');
      setMotivo('');
      setDataPrevista('');
      setSearch('');
      setTab('lista');
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao criar reembolso.');
    }
  };

  // ============ LISTA ============
  const { data: reembolsos, isLoading: loadingList } = useArReembolsos();
  const marcarPago = useMarcarReembolsoPago();
  const cancelar = useCancelarReembolso();

  const [pagoDialog, setPagoDialog] = useState<{ id: string; valor: number } | null>(null);
  const [dataEfetiva, setDataEfetiva] = useState(format(new Date(), 'yyyy-MM-dd'));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Undo2 className="w-5 h-5 text-rose-600" />
            Reembolsos — baixa sem numerário
          </DialogTitle>
          <DialogDescription>
            Selecione um título para criar o reembolso. Ao confirmar, os pagamentos já lançados desse
            título são estornados e o título passa a constar como <b>Reembolsado</b>. Depois, marque
            o reembolso como pago quando o valor for efetivamente devolvido.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList>
            <TabsTrigger value="novo">Novo reembolso</TabsTrigger>
            <TabsTrigger value="lista">Reembolsos ({reembolsos?.length ?? 0})</TabsTrigger>
          </TabsList>

          {/* NOVO */}
          <TabsContent value="novo" className="space-y-4 mt-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por cliente, e-mail ou CPF…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>

            <Card>
              <CardContent className="pt-4 max-h-64 overflow-y-auto">
                {loadingTit ? (
                  <div className="text-center text-sm text-muted-foreground py-6">Carregando…</div>
                ) : (titulos || []).length === 0 ? (
                  <div className="text-center text-sm text-muted-foreground py-6">
                    Nenhum título encontrado.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]"></TableHead>
                        <TableHead>Nº</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Produto</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(titulos || []).slice(0, 80).map((t) => (
                        <TableRow
                          key={t.id}
                          className={`cursor-pointer hover:bg-muted/40 ${
                            selectedTituloId === t.id ? 'bg-rose-500/10' : ''
                          }`}
                          onClick={() => handleSelect(t.id)}
                        >
                          <TableCell>
                            <input
                              type="radio"
                              checked={selectedTituloId === t.id}
                              onChange={() => handleSelect(t.id)}
                            />
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {ticketNumber(t.id)}
                          </TableCell>
                          <TableCell>
                            <div className="font-medium text-sm">{t.customer_name}</div>
                            <div className="text-xs text-muted-foreground">
                              {t.customer_email || t.customer_document || '—'}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs">{t.product_code}</TableCell>
                          <TableCell className="text-right text-sm">
                            {brl(Number(t.valor_total || 0))}
                          </TableCell>
                          <TableCell className="text-xs">{t.status}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {selectedTitulo && (
              <Card className="border-rose-500/40">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">
                    Reembolsar título {ticketNumber(selectedTitulo.id)} —{' '}
                    {selectedTitulo.customer_name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label>Valor do reembolso</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={valor}
                      onChange={(e) => setValor(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Data do pedido</Label>
                    <Input
                      type="date"
                      value={dataPedido}
                      onChange={(e) => setDataPedido(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Data prevista para pagamento</Label>
                    <Input
                      type="date"
                      value={dataPrevista}
                      onChange={(e) => setDataPrevista(e.target.value)}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label>Motivo</Label>
                    <Textarea
                      rows={2}
                      value={motivo}
                      onChange={(e) => setMotivo(e.target.value)}
                      placeholder="Descreva o motivo do reembolso"
                    />
                  </div>
                </CardContent>
                <DialogFooter className="px-6 pb-4">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setSelectedTituloId(null);
                      setValor('');
                      setMotivo('');
                    }}
                  >
                    Limpar
                  </Button>
                  <Button
                    className="bg-rose-600 hover:bg-rose-700 text-white"
                    disabled={criar.isPending}
                    onClick={handleCriar}
                  >
                    {criar.isPending ? 'Criando…' : 'Criar reembolso (baixa sem numerário)'}
                  </Button>
                </DialogFooter>
              </Card>
            )}
          </TabsContent>

          {/* LISTA */}
          <TabsContent value="lista" className="mt-3">
            <Card>
              <CardContent className="pt-4 overflow-x-auto">
                {loadingList ? (
                  <div className="text-center text-sm text-muted-foreground py-6">Carregando…</div>
                ) : (reembolsos || []).length === 0 ? (
                  <div className="text-center text-sm text-muted-foreground py-6">
                    Nenhum reembolso registrado.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Produto</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead>Pedido</TableHead>
                        <TableHead>Prev. pagamento</TableHead>
                        <TableHead>Pago em</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(reembolsos || []).map((r) => (
                        <TableRow key={r.id}>
                          <TableCell>
                            <div className="font-medium text-sm">
                              {r.titulo?.customer_name || '—'}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {r.titulo?.customer_email || r.titulo?.customer_document || '—'}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs">{r.titulo?.product_code || '—'}</TableCell>
                          <TableCell className="text-right text-sm font-medium text-rose-600">
                            {brl(Number(r.valor || 0))}
                          </TableCell>
                          <TableCell className="text-xs">
                            {r.data_pedido
                              ? format(new Date(r.data_pedido + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR })
                              : '—'}
                          </TableCell>
                          <TableCell className="text-xs">
                            {r.data_prevista_pagamento
                              ? format(new Date(r.data_prevista_pagamento + 'T00:00:00'), 'dd/MM/yyyy', {
                                  locale: ptBR,
                                })
                              : '—'}
                          </TableCell>
                          <TableCell className="text-xs">
                            {r.data_pagamento
                              ? format(new Date(r.data_pagamento + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR })
                              : '—'}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={r.status} />
                          </TableCell>
                          <TableCell className="text-right">
                            {r.status === 'pendente' && (
                              <div className="flex justify-end gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setPagoDialog({ id: r.id, valor: Number(r.valor || 0) });
                                    setDataEfetiva(
                                      r.data_prevista_pagamento || format(new Date(), 'yyyy-MM-dd'),
                                    );
                                  }}
                                >
                                  Marcar pago
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={async () => {
                                    if (!confirm('Cancelar este reembolso?')) return;
                                    try {
                                      await cancelar.mutateAsync({ id: r.id });
                                      toast.success('Reembolso cancelado.');
                                    } catch (e: any) {
                                      toast.error(e?.message || 'Erro ao cancelar reembolso.');
                                    }
                                  }}
                                >
                                  Cancelar
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* MARCAR COMO PAGO */}
        <Dialog open={!!pagoDialog} onOpenChange={(v) => !v && setPagoDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Marcar reembolso como pago</DialogTitle>
              <DialogDescription>
                Valor: <b className="text-rose-600">{brl(pagoDialog?.valor || 0)}</b>. Informe a data
                em que o reembolso foi efetivamente pago ao cliente.
              </DialogDescription>
            </DialogHeader>
            <div>
              <Label>Data de pagamento</Label>
              <Input
                type="date"
                value={dataEfetiva}
                onChange={(e) => setDataEfetiva(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setPagoDialog(null)}>
                Cancelar
              </Button>
              <Button
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                disabled={marcarPago.isPending || !dataEfetiva}
                onClick={async () => {
                  if (!pagoDialog) return;
                  try {
                    await marcarPago.mutateAsync({
                      id: pagoDialog.id,
                      data_pagamento: dataEfetiva,
                    });
                    toast.success('Reembolso marcado como pago.');
                    setPagoDialog(null);
                  } catch (e: any) {
                    toast.error(e?.message || 'Erro ao marcar como pago.');
                  }
                }}
              >
                {marcarPago.isPending ? 'Salvando…' : 'Confirmar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}