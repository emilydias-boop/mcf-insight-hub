import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Users,
  Link2,
  Wallet,
  Plus,
  Search,
  Trash2,
  Pencil,
  CheckCircle2,
  Clock,
  AlertCircle,
} from 'lucide-react';
import {
  useIndicadores,
  useIndicacoes,
  useCreateIndicador,
  useDeleteIndicador,
  useUpdateIndicador,
  useCreateIndicacao,
  useDeleteIndicacao,
  useUpdateIndicacao,
  useUpdateIndicacaoParcela,
  useCotasParaIndicacao,
  type Indicador,
  type IndicacaoRich,
} from '@/hooks/useConsorcioIndicacoes';
import { formatCurrency } from '@/lib/formatters';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function cardLabel(c: IndicacaoRich['card']) {
  if (!c) return '—';
  return c.nome_completo || c.razao_social || `Grupo ${c.grupo} / Cota ${c.cota}`;
}

/* ============ INDICADORES SUB-TAB ============ */
function IndicadoresSubTab() {
  const { data: indicadores = [], isLoading } = useIndicadores();
  const { data: indicacoes = [] } = useIndicacoes();
  const createMut = useCreateIndicador();
  const updateMut = useUpdateIndicador();
  const deleteMut = useDeleteIndicador();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Indicador | null>(null);
  const [form, setForm] = useState<Partial<Indicador>>({ tipo: 'externo' });
  const [search, setSearch] = useState('');

  const aggregates = useMemo(() => {
    const map = new Map<string, { count: number; credito: number; comissao: number; pago: number; aPagar: number }>();
    for (const i of indicacoes) {
      const cur = map.get(i.indicador_id) || { count: 0, credito: 0, comissao: 0, pago: 0, aPagar: 0 };
      cur.count += 1;
      cur.credito += Number(i.card?.valor_credito || 0);
      cur.comissao += i.valorComissaoTotal;
      cur.pago += i.valorPago;
      cur.aPagar += i.valorPendente;
      map.set(i.indicador_id, cur);
    }
    return map;
  }, [indicacoes]);

  const filtered = indicadores.filter((i) =>
    !search.trim() || i.nome.toLowerCase().includes(search.toLowerCase()),
  );

  function openCreate() {
    setEditing(null);
    setForm({ tipo: 'externo' });
    setOpen(true);
  }
  function openEdit(ind: Indicador) {
    setEditing(ind);
    setForm(ind);
    setOpen(true);
  }
  async function handleSave() {
    if (!form.nome) return;
    if (editing) {
      await updateMut.mutateAsync({ id: editing.id, patch: form });
    } else {
      await createMut.mutateAsync(form);
    }
    setOpen(false);
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" /> Indicadores
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Pessoas (consorciados ou externos) que indicaram alguém que virou cota.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              className="pl-8 w-56"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4 mr-1" /> Indicador
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editing ? 'Editar indicador' : 'Novo indicador'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Nome *</Label>
                  <Input value={form.nome || ''} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Tipo</Label>
                    <Select
                      value={form.tipo || 'externo'}
                      onValueChange={(v) => setForm({ ...form, tipo: v as any })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="consorciado">Consorciado</SelectItem>
                        <SelectItem value="externo">Externo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>CPF</Label>
                    <Input value={form.cpf || ''} onChange={(e) => setForm({ ...form, cpf: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Telefone</Label>
                    <Input value={form.telefone || ''} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
                  </div>
                  <div>
                    <Label>Email</Label>
                    <Input value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                  </div>
                </div>
                <div>
                  <Label>PIX para pagamento</Label>
                  <Input value={form.pix || ''} onChange={(e) => setForm({ ...form, pix: e.target.value })} />
                </div>
                <div>
                  <Label>Observações</Label>
                  <Textarea value={form.observacoes || ''} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={handleSave} disabled={!form.nome}>Salvar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Nenhum indicador cadastrado.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead className="text-right">Indicações</TableHead>
                <TableHead className="text-right">Crédito gerado</TableHead>
                <TableHead className="text-right">Comissão total</TableHead>
                <TableHead className="text-right">Pago</TableHead>
                <TableHead className="text-right">A pagar</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((ind) => {
                const a = aggregates.get(ind.id) || { count: 0, credito: 0, comissao: 0, pago: 0, aPagar: 0 };
                return (
                  <TableRow key={ind.id}>
                    <TableCell className="font-medium">{ind.nome}</TableCell>
                    <TableCell>
                      <Badge variant={ind.tipo === 'consorciado' ? 'default' : 'secondary'}>
                        {ind.tipo === 'consorciado' ? 'Consorciado' : 'Externo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {ind.telefone || ind.email || '—'}
                    </TableCell>
                    <TableCell className="text-right">{a.count}</TableCell>
                    <TableCell className="text-right">{formatCurrency(a.credito)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(a.comissao)}</TableCell>
                    <TableCell className="text-right text-green-600">{formatCurrency(a.pago)}</TableCell>
                    <TableCell className="text-right text-orange-600">{formatCurrency(a.aPagar)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(ind)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            if (a.count > 0) {
                              alert('Remova as indicações vinculadas antes.');
                              return;
                            }
                            if (confirm(`Excluir ${ind.nome}?`)) deleteMut.mutate(ind.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

/* ============ INDICAÇÕES SUB-TAB ============ */
function IndicacoesSubTab() {
  const { data: indicacoes = [], isLoading } = useIndicacoes();
  const { data: indicadores = [] } = useIndicadores();
  const createMut = useCreateIndicacao();
  const updateMut = useUpdateIndicacao();
  const deleteMut = useDeleteIndicacao();
  const [open, setOpen] = useState(false);
  const [indicadorId, setIndicadorId] = useState<string>('');
  const [cardId, setCardId] = useState<string>('');
  const [percentual, setPercentual] = useState<number>(1);
  const [numParcelas, setNumParcelas] = useState<number>(5);
  const [search, setSearch] = useState('');
  const [cotaSearch, setCotaSearch] = useState('');
  const { data: cotasDisponiveis = [] } = useCotasParaIndicacao(cotaSearch);

  const filtered = indicacoes.filter((i) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      i.indicador.nome.toLowerCase().includes(q) ||
      cardLabel(i.card).toLowerCase().includes(q)
    );
  });

  async function handleCreate() {
    if (!indicadorId || !cardId) return;
    await createMut.mutateAsync({
      indicador_id: indicadorId,
      card_id: cardId,
      percentual,
      num_parcelas: numParcelas,
    });
    setOpen(false);
    setIndicadorId(''); setCardId(''); setPercentual(1); setNumParcelas(5); setCotaSearch('');
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" /> Indicações (cota → indicador)
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Cada cota indicada gera comissão para o indicador, parcelada conforme regra.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              className="pl-8 w-56"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-1" /> Nova indicação</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Vincular cota a um indicador</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Indicador *</Label>
                  <Select value={indicadorId} onValueChange={setIndicadorId}>
                    <SelectTrigger><SelectValue placeholder="Selecione o indicador" /></SelectTrigger>
                    <SelectContent>
                      {indicadores.map((i) => (
                        <SelectItem key={i.id} value={i.id}>
                          {i.nome} <span className="text-muted-foreground ml-1">({i.tipo})</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Buscar cota indicada *</Label>
                  <Input
                    placeholder="Nome, grupo ou cota"
                    value={cotaSearch}
                    onChange={(e) => setCotaSearch(e.target.value)}
                  />
                  <div className="max-h-48 overflow-auto border rounded mt-2">
                    {cotasDisponiveis.length === 0 ? (
                      <p className="text-xs text-muted-foreground p-3">Nenhuma cota disponível.</p>
                    ) : (
                      cotasDisponiveis.map((c: any) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setCardId(c.id)}
                          className={`block w-full text-left p-2 text-sm border-b hover:bg-accent ${
                            cardId === c.id ? 'bg-accent' : ''
                          }`}
                        >
                          <div className="font-medium">{c.nome_completo || c.razao_social || '—'}</div>
                          <div className="text-xs text-muted-foreground">
                            Grupo {c.grupo}/{c.cota} · {formatCurrency(Number(c.valor_credito || 0))}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>% sobre crédito</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={percentual}
                      onChange={(e) => setPercentual(Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <Label>Parcelas</Label>
                    <Input
                      type="number"
                      value={numParcelas}
                      onChange={(e) => setNumParcelas(Number(e.target.value))}
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={handleCreate} disabled={!indicadorId || !cardId}>Criar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma indicação registrada.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Indicador</TableHead>
                <TableHead>Cota indicada</TableHead>
                <TableHead className="text-right">Crédito</TableHead>
                <TableHead className="text-right">%</TableHead>
                <TableHead className="text-right">Comissão</TableHead>
                <TableHead>Progresso</TableHead>
                <TableHead className="text-right">Pago</TableHead>
                <TableHead className="text-right">Pendente</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((i) => {
                const totalParc = i.parcelas.length;
                const pagasParc = i.parcelas.filter((p) => p.status === 'pago').length;
                return (
                  <TableRow key={i.id}>
                    <TableCell className="font-medium">{i.indicador.nome}</TableCell>
                    <TableCell>
                      <div>{cardLabel(i.card)}</div>
                      <div className="text-xs text-muted-foreground">
                        Grupo {i.card?.grupo}/{i.card?.cota}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(Number(i.card?.valor_credito || 0))}</TableCell>
                    <TableCell className="text-right">{Number(i.percentual).toFixed(2)}%</TableCell>
                    <TableCell className="text-right">{formatCurrency(i.valorComissaoTotal)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{pagasParc}/{totalParc} parcelas</Badge>
                    </TableCell>
                    <TableCell className="text-right text-green-600">{formatCurrency(i.valorPago)}</TableCell>
                    <TableCell className="text-right text-orange-600">{formatCurrency(i.valorPendente)}</TableCell>
                    <TableCell>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          if (confirm('Excluir esta indicação? As parcelas também serão removidas.')) {
                            deleteMut.mutate(i.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

/* ============ PAGAMENTOS SUB-TAB ============ */
function PagamentosSubTab() {
  const { data: indicacoes = [], isLoading } = useIndicacoes();
  const updateParcelaMut = useUpdateIndicacaoParcela();
  const [statusFilter, setStatusFilter] = useState<'todas' | 'liberadas' | 'pendentes' | 'pagas'>('liberadas');

  type Row = {
    parcelaId: string;
    indicador: string;
    cota: string;
    parcelaNum: number;
    valor: number;
    vencimento: string;
    status: 'pendente' | 'pago' | 'cancelado';
    liberada: boolean; // parcela correspondente da cota foi paga
    dataPagamento: string | null;
  };

  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];
    for (const i of indicacoes) {
      for (const p of i.parcelas) {
        out.push({
          parcelaId: p.id,
          indicador: i.indicador.nome,
          cota: `${cardLabel(i.card)} · G${i.card?.grupo}/${i.card?.cota}`,
          parcelaNum: p.numero_parcela,
          valor: Number(p.valor),
          vencimento: p.data_vencimento,
          status: p.status,
          liberada: i.cardParcelasPagas.has(p.numero_parcela),
          dataPagamento: p.data_pagamento,
        });
      }
    }
    return out.sort((a, b) => a.vencimento.localeCompare(b.vencimento));
  }, [indicacoes]);

  const filtered = rows.filter((r) => {
    if (statusFilter === 'pagas') return r.status === 'pago';
    if (statusFilter === 'pendentes') return r.status === 'pendente';
    if (statusFilter === 'liberadas') return r.status === 'pendente' && r.liberada;
    return true;
  });

  const totalAPagar = filtered.filter((r) => r.status === 'pendente').reduce((s, r) => s + r.valor, 0);
  const totalPago = filtered.filter((r) => r.status === 'pago').reduce((s, r) => s + r.valor, 0);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" /> Pagamentos a indicadores
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Parcela só é <strong>liberada</strong> quando a parcela correspondente da cota foi paga.
          </p>
        </div>
        <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="liberadas">Liberadas para pagar</SelectItem>
            <SelectItem value="pendentes">Todas pendentes</SelectItem>
            <SelectItem value="pagas">Pagas</SelectItem>
            <SelectItem value="todas">Todas</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <Card><CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Total pendente (filtro)</p>
            <p className="text-xl font-bold text-orange-600">{formatCurrency(totalAPagar)}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Total pago (filtro)</p>
            <p className="text-xl font-bold text-green-600">{formatCurrency(totalPago)}</p>
          </CardContent></Card>
        </div>
        {isLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma parcela neste filtro.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vencimento</TableHead>
                <TableHead>Indicador</TableHead>
                <TableHead>Cota</TableHead>
                <TableHead className="text-center">Parc.</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-32"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.parcelaId}>
                  <TableCell>
                    {format(parseISO(r.vencimento), 'dd/MM/yyyy', { locale: ptBR })}
                  </TableCell>
                  <TableCell className="font-medium">{r.indicador}</TableCell>
                  <TableCell className="text-xs">{r.cota}</TableCell>
                  <TableCell className="text-center">{r.parcelaNum}</TableCell>
                  <TableCell className="text-right">{formatCurrency(r.valor)}</TableCell>
                  <TableCell>
                    {r.status === 'pago' ? (
                      <Badge className="bg-green-600"><CheckCircle2 className="h-3 w-3 mr-1" /> Pago</Badge>
                    ) : r.liberada ? (
                      <Badge variant="outline" className="border-blue-500 text-blue-600">
                        <AlertCircle className="h-3 w-3 mr-1" /> Liberada
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        <Clock className="h-3 w-3 mr-1" /> Aguardando cota
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {r.status === 'pendente' ? (
                      <Button
                        size="sm"
                        variant={r.liberada ? 'default' : 'outline'}
                        onClick={() =>
                          updateParcelaMut.mutate({
                            id: r.parcelaId,
                            patch: { status: 'pago', data_pagamento: new Date().toISOString().slice(0, 10) },
                          })
                        }
                      >
                        Marcar pago
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          updateParcelaMut.mutate({
                            id: r.parcelaId,
                            patch: { status: 'pendente', data_pagamento: null },
                          })
                        }
                      >
                        Reverter
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

export function IndicacoesTab() {
  return (
    <Tabs defaultValue="indicadores" className="space-y-4">
      <TabsList>
        <TabsTrigger value="indicadores">Indicadores</TabsTrigger>
        <TabsTrigger value="indicacoes">Indicações</TabsTrigger>
        <TabsTrigger value="pagamentos">Pagamentos</TabsTrigger>
      </TabsList>
      <TabsContent value="indicadores"><IndicadoresSubTab /></TabsContent>
      <TabsContent value="indicacoes"><IndicacoesSubTab /></TabsContent>
      <TabsContent value="pagamentos"><PagamentosSubTab /></TabsContent>
    </Tabs>
  );
}