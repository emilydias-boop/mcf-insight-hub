import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowLeft, Plus, Check, Trash2, History, RefreshCw, Wallet } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  useArTitulo, useArParcelas, useArHistorico,
  useCreateArParcelas, useMarkArParcelaPaga, useDeleteArParcela, useUpdateArTitulo,
} from '@/hooks/useAReceber';
import {
  AR_TITULO_STATUS_LABEL, AR_TITULO_TIPO_LABEL, AR_PARCELA_STATUS_LABEL, AR_PARCELA_TIPO_LABEL,
  type ArParcela,
} from '@/types/aReceber';
import { useCanManageAr } from '@/hooks/useArGestores';
import { parcelaDocNumber } from '@/lib/arTicketNumber';

const brl = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

const PAYMENT_METHODS = [
  { value: 'pix', label: 'PIX' },
  { value: 'boleto', label: 'Boleto' },
  { value: 'credit_card', label: 'Cartão de crédito' },
  { value: 'transferencia', label: 'Transferência' },
  { value: 'outro', label: 'Outro' },
];

function StatusPill({ status }: { status: ArParcela['status'] }) {
  const map: Record<ArParcela['status'], string> = {
    pendente: 'bg-amber-500/15 text-amber-600 border-amber-500/30',
    pago: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30',
    atrasado: 'bg-red-500/15 text-red-600 border-red-500/30',
    cancelado: 'bg-muted text-muted-foreground',
  };
  return <Badge variant="outline" className={map[status]}>{AR_PARCELA_STATUS_LABEL[status]}</Badge>;
}

export default function AReceberDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: titulo } = useArTitulo(id ?? null);
  const { data: parcelas } = useArParcelas(id ?? null);
  const { data: historico } = useArHistorico(id ?? null);

  const createParcelas = useCreateArParcelas();
  const markPaga = useMarkArParcelaPaga();
  const delParcela = useDeleteArParcela();
  const updateTitulo = useUpdateArTitulo();
  const { canManage } = useCanManageAr();

  const totals = useMemo(() => {
    const list = parcelas ?? [];
    const pago = list.filter(p => p.status === 'pago').reduce((s, p) => s + Number(p.valor_pago ?? p.valor ?? 0), 0);
    const pendente = list.filter(p => p.status !== 'pago' && p.status !== 'cancelado').reduce((s, p) => s + Number(p.valor ?? 0), 0);
    return { pago, pendente, total: pago + pendente };
  }, [parcelas]);

  const naoLancado = titulo?.tipo === 'parcelado' && (parcelas ?? []).length === 0;

  // ==== Marcar como paga
  const [payingId, setPayingId] = useState<string | null>(null);
  const [payValor, setPayValor] = useState('');
  const [payData, setPayData] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [payForma, setPayForma] = useState('pix');

  const openPay = (p: ArParcela) => {
    setPayingId(p.id);
    setPayValor(String(p.valor));
    setPayData(format(new Date(), 'yyyy-MM-dd'));
    setPayForma(p.forma_pagamento || 'pix');
  };

  const confirmPay = async () => {
    if (!payingId || !id) return;
    try {
      await markPaga.mutateAsync({
        id: payingId, tituloId: id,
        valor_pago: Number(payValor), data_pagamento: payData, forma_pagamento: payForma,
      });
      toast.success('Parcela baixada');
      setPayingId(null);
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao baixar parcela');
    }
  };

  // ==== Lançar parcelas (entrada + N)
  const [openLancar, setOpenLancar] = useState(false);
  const [entradaValor, setEntradaValor] = useState('');
  const [entradaVenc, setEntradaVenc] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [qtdParcelas, setQtdParcelas] = useState('3');
  const [valorParcela, setValorParcela] = useState('');
  const [primeiraVenc, setPrimeiraVenc] = useState('');

  // ==== Renegociar / gerar parcelas restantes até integralizar o valor
  const [openRenegociar, setOpenRenegociar] = useState(false);
  const [renegQtd, setRenegQtd] = useState('3');
  const [renegPrimeiraVenc, setRenegPrimeiraVenc] = useState('');

  // ==== Baixar título original como entrada (quando já existem parcelas)
  const [openEntrada, setOpenEntrada] = useState(false);
  const [entradaPagValor, setEntradaPagValor] = useState('');
  const [entradaPagData, setEntradaPagData] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [entradaPagForma, setEntradaPagForma] = useState('pix');

  const saldoRestante = useMemo(() => {
    const total = Number(titulo?.valor_total || 0);
    return Math.max(0, +(total - totals.pago).toFixed(2));
  }, [titulo?.valor_total, totals.pago]);

  const temEntradaRegistrada = useMemo(
    () => (parcelas ?? []).some(p => p.tipo_parcela === 'entrada'),
    [parcelas],
  );

  const abrirBaixarEntrada = () => {
    setEntradaPagValor(saldoRestante > 0 ? String(saldoRestante.toFixed(2)) : '');
    setEntradaPagData(format(new Date(), 'yyyy-MM-dd'));
    setEntradaPagForma(titulo?.payment_method || 'pix');
    setOpenEntrada(true);
  };

  const confirmarBaixarEntrada = async () => {
    if (!id) return;
    const valor = Number(entradaPagValor || 0);
    if (valor <= 0) {
      toast.error('Informe o valor da entrada paga');
      return;
    }
    if (!entradaPagData) {
      toast.error('Informe a data do pagamento');
      return;
    }
    // Numero 0 para entrada do título original (não colide com parcelas existentes)
    const existentes = parcelas ?? [];
    const jaExisteZero = existentes.some(p => Number(p.numero) === 0);
    const numero = jaExisteZero
      ? Math.min(0, ...existentes.map(p => Number(p.numero) || 0)) - 1
      : 0;
    try {
      await createParcelas.mutateAsync({
        tituloId: id,
        parcelas: [{
          numero,
          tipo_parcela: 'entrada',
          valor,
          valor_pago: valor,
          data_vencimento: entradaPagData,
          data_pagamento: entradaPagData,
          forma_pagamento: entradaPagForma,
          status: 'pago',
        }],
      });
      toast.success('Entrada do título registrada como paga');
      setOpenEntrada(false);
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao baixar entrada');
    }
  };

  const abrirRenegociar = () => {
    setRenegQtd('3');
    setRenegPrimeiraVenc(format(new Date(new Date().setMonth(new Date().getMonth() + 1)), 'yyyy-MM-dd'));
    setOpenRenegociar(true);
  };

  const confirmarRenegociar = async () => {
    if (!id || !titulo) return;
    const qtd = Number(renegQtd || 0);
    if (qtd < 1) {
      toast.error('Informe a quantidade de parcelas');
      return;
    }
    if (saldoRestante <= 0) {
      toast.error('Não há saldo restante a parcelar');
      return;
    }
    if (!renegPrimeiraVenc) {
      toast.error('Informe a data do 1º vencimento');
      return;
    }
    // Divide o saldo em qtd parcelas, ajustando a última com o resíduo
    const valorBase = Math.floor((saldoRestante / qtd) * 100) / 100;
    const valores: number[] = Array.from({ length: qtd }, (_, i) =>
      i === qtd - 1 ? +(saldoRestante - valorBase * (qtd - 1)).toFixed(2) : valorBase,
    );

    // Remove parcelas pendentes/atrasadas atuais; mantém pagas/canceladas
    const pendentes = (parcelas ?? []).filter(p => p.status === 'pendente' || p.status === 'atrasado');
    const proxNumero = (parcelas ?? [])
      .filter(p => p.status === 'pago')
      .reduce((m, p) => Math.max(m, Number(p.numero) || 0), 0) + 1;

    const base = new Date(renegPrimeiraVenc + 'T00:00:00');
    const rows: Partial<ArParcela>[] = valores.map((v, i) => {
      const d = new Date(base);
      d.setMonth(d.getMonth() + i);
      return {
        numero: proxNumero + i,
        tipo_parcela: 'parcela',
        valor: v,
        data_vencimento: format(d, 'yyyy-MM-dd'),
        status: 'pendente',
      };
    });

    try {
      // Apaga pendentes uma a uma via hook (para manter histórico consistente)
      for (const p of pendentes) {
        await delParcela.mutateAsync({ id: p.id, tituloId: id });
      }
      await createParcelas.mutateAsync({ tituloId: id, parcelas: rows });
      if (titulo.tipo !== 'parcelado') {
        await updateTitulo.mutateAsync({ id, tipo: 'parcelado' });
      }
      toast.success(`${rows.length} parcela(s) geradas totalizando ${brl(saldoRestante)}`);
      setOpenRenegociar(false);
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao renegociar parcelas');
    }
  };

  const abrirLancar = () => {
    if (!titulo) return;
    const total = Number(titulo.valor_total);
    const totalHubla = Number(titulo.total_installments_hubla || 0);
    const qtdSugerida = totalHubla > 1 ? totalHubla - 1 : 1;
    setQtdParcelas(String(qtdSugerida));
    const qtd = qtdSugerida;
    setEntradaValor('');
    setValorParcela(String((total / qtd).toFixed(2)));
    setPrimeiraVenc(format(new Date(new Date().setMonth(new Date().getMonth() + 1)), 'yyyy-MM-dd'));
    setOpenLancar(true);
  };

  const confirmarLancar = async () => {
    if (!id) return;
    const entrada = Number(entradaValor || 0);
    const qtd = Number(qtdParcelas || 0);
    const vParc = Number(valorParcela || 0);
    if (qtd < 1 || vParc <= 0) {
      toast.error('Informe quantidade de parcelas e valor');
      return;
    }
    const rows: Partial<ArParcela>[] = [];
    let numero = 1;
    if (entrada > 0) {
      rows.push({
        numero, tipo_parcela: 'entrada', valor: entrada,
        data_vencimento: entradaVenc, status: 'pendente',
      });
      numero++;
    }
    const base = new Date(primeiraVenc + 'T00:00:00');
    for (let i = 0; i < qtd; i++) {
      const d = new Date(base);
      d.setMonth(d.getMonth() + i);
      rows.push({
        numero, tipo_parcela: 'parcela', valor: vParc,
        data_vencimento: format(d, 'yyyy-MM-dd'), status: 'pendente',
      });
      numero++;
    }
    try {
      await createParcelas.mutateAsync({ tituloId: id, parcelas: rows });
      toast.success(`${rows.length} parcela(s) lançada(s)`);
      setOpenLancar(false);
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao lançar parcelas');
    }
  };

  const handleDelete = async (p: ArParcela) => {
    if (!id) return;
    if (!confirm(`Excluir parcela #${p.numero}?`)) return;
    try {
      await delParcela.mutateAsync({ id: p.id, tituloId: id });
      toast.success('Parcela excluída');
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao excluir');
    }
  };

  const handleQuitar = async () => {
    if (!id) return;
    if (!confirm('Marcar título como quitado?')) return;
    try {
      await updateTitulo.mutateAsync({ id, status: 'quitado' });
      toast.success('Título quitado');
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao quitar');
    }
  };

  if (!titulo) return <div className="p-6 text-muted-foreground">Carregando…</div>;

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={() => navigate('/financeiro/a-receber')}>
        <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
      </Button>

      {/* Cabeçalho */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <CardTitle className="text-lg">{titulo.customer_name}</CardTitle>
              <div className="text-sm text-muted-foreground">
                {titulo.customer_email || '—'} · {titulo.customer_document || 'sem CPF'} · {titulo.customer_phone || 'sem tel'}
              </div>
            </div>
            <div className="flex gap-2">
              <Badge variant="outline">{titulo.product_code}</Badge>
              {canManage ? (
                <Select
                  value={titulo.tipo}
                  onValueChange={async (v) => {
                    try {
                      await updateTitulo.mutateAsync({ id: titulo.id, tipo: v as any });
                      toast.success('Tipo do título atualizado');
                    } catch (e: any) {
                      toast.error(e?.message || 'Erro ao atualizar tipo');
                    }
                  }}
                >
                  <SelectTrigger className="h-7 w-[190px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="integral">{AR_TITULO_TIPO_LABEL.integral}</SelectItem>
                    <SelectItem value="parcelado">{AR_TITULO_TIPO_LABEL.parcelado}</SelectItem>
                    <SelectItem value="pendente_lancamento">{AR_TITULO_TIPO_LABEL.pendente_lancamento}</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Badge variant="outline">{AR_TITULO_TIPO_LABEL[titulo.tipo]}</Badge>
              )}
              <Badge variant="outline">{AR_TITULO_STATUS_LABEL[titulo.status]}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
          <div><div className="text-muted-foreground text-xs">Produto</div>{titulo.product_name}</div>
          <div><div className="text-muted-foreground text-xs">Valor total</div><span className="font-semibold">{brl(Number(titulo.valor_total))}</span></div>
          <div><div className="text-muted-foreground text-xs">Recebido</div><span className="text-emerald-600 font-semibold">{brl(totals.pago)}</span></div>
          <div><div className="text-muted-foreground text-xs">Saldo</div><span className="text-amber-600 font-semibold">{brl(totals.pendente)}</span></div>
          <div><div className="text-muted-foreground text-xs">Forma Hubla</div>{titulo.payment_method || '—'} ({titulo.total_installments_hubla}x)</div>
        </CardContent>
      </Card>

      {/* Parcelas */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Parcelas</CardTitle>
          <div className="flex gap-2">
            {titulo.status === 'aberto' && totals.pendente === 0 && totals.pago > 0 && (
              <Button size="sm" variant="outline" onClick={handleQuitar}>
                <Check className="w-4 h-4 mr-1" /> Marcar quitado
              </Button>
            )}
            {canManage && (
              <Button size="sm" variant="outline" onClick={abrirRenegociar}>
                <RefreshCw className="w-4 h-4 mr-1" /> Renegociar restantes
              </Button>
            )}
            {canManage && (parcelas ?? []).length > 0 && saldoRestante > 0 && (
              <Button size="sm" variant="outline" onClick={abrirBaixarEntrada}>
                <Wallet className="w-4 h-4 mr-1" /> Baixar entrada
              </Button>
            )}
            <Dialog open={openLancar} onOpenChange={setOpenLancar}>
              <DialogTrigger asChild>
                <Button size="sm" onClick={abrirLancar}>
                  <Plus className="w-4 h-4 mr-1" /> Lançar parcelas
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Lançar entrada + parcelas</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Entrada (opcional)</Label>
                      <Input type="number" step="0.01" value={entradaValor} onChange={e => setEntradaValor(e.target.value)} placeholder="0,00" />
                    </div>
                    <div>
                      <Label>Venc. entrada</Label>
                      <Input type="date" value={entradaVenc} onChange={e => setEntradaVenc(e.target.value)} />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label>Nº parcelas</Label>
                      <Input type="number" min="1" value={qtdParcelas} onChange={e => setQtdParcelas(e.target.value)} />
                    </div>
                    <div>
                      <Label>Valor parcela</Label>
                      <Input type="number" step="0.01" value={valorParcela} onChange={e => setValorParcela(e.target.value)} />
                    </div>
                    <div>
                      <Label>1º vencimento</Label>
                      <Input type="date" value={primeiraVenc} onChange={e => setPrimeiraVenc(e.target.value)} />
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Total gerado: {brl(Number(entradaValor || 0) + Number(qtdParcelas || 0) * Number(valorParcela || 0))} · Valor do título: {brl(Number(titulo.valor_total))}
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpenLancar(false)}>Cancelar</Button>
                  <Button onClick={confirmarLancar} disabled={createParcelas.isPending}>Lançar</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {naoLancado ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Venda parcelada aguardando lançamento. Clique em <strong>Lançar parcelas</strong> para configurar entrada + parcelas.
            </div>
          ) : (parcelas ?? []).length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">Nenhuma parcela.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Documento</TableHead>
                  <TableHead>#</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Pagamento</TableHead>
                  <TableHead>Forma</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(parcelas ?? []).map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs">{parcelaDocNumber(titulo.id, p.numero)}</TableCell>
                    <TableCell>{p.numero}</TableCell>
                    <TableCell className="text-xs">{AR_PARCELA_TIPO_LABEL[p.tipo_parcela]}</TableCell>
                    <TableCell className="text-xs">{format(new Date(p.data_vencimento + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR })}</TableCell>
                    <TableCell className="text-right">{brl(Number(p.valor))}</TableCell>
                    <TableCell className="text-xs">
                      {p.data_pagamento ? format(new Date(p.data_pagamento + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR }) : '—'}
                    </TableCell>
                    <TableCell className="text-xs">{p.forma_pagamento || '—'}</TableCell>
                    <TableCell><StatusPill status={p.status} /></TableCell>
                    <TableCell className="text-right">
                      {p.status !== 'pago' && (
                        <Button size="sm" variant="outline" onClick={() => openPay(p)}>
                          <Check className="w-3 h-3 mr-1" /> Baixar
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(p)}>
                        <Trash2 className="w-3 h-3 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Modal renegociar / gerar parcelas restantes */}
      <Dialog open={openRenegociar} onOpenChange={setOpenRenegociar}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renegociar parcelas restantes</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded border p-2">
                <div className="text-xs text-muted-foreground">Valor do título</div>
                <div className="font-semibold">{brl(Number(titulo.valor_total))}</div>
              </div>
              <div className="rounded border p-2">
                <div className="text-xs text-muted-foreground">Já recebido</div>
                <div className="font-semibold text-emerald-600">{brl(totals.pago)}</div>
              </div>
            </div>
            <div className="rounded border p-2 text-sm">
              <div className="text-xs text-muted-foreground">Saldo a parcelar</div>
              <div className="font-semibold text-amber-600">{brl(saldoRestante)}</div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nº de parcelas negociadas</Label>
                <Input type="number" min="1" value={renegQtd} onChange={e => setRenegQtd(e.target.value)} />
              </div>
              <div>
                <Label>1º vencimento</Label>
                <Input type="date" value={renegPrimeiraVenc} onChange={e => setRenegPrimeiraVenc(e.target.value)} />
              </div>
            </div>
            {Number(renegQtd) > 0 && saldoRestante > 0 && (
              <div className="text-xs text-muted-foreground">
                Serão geradas {renegQtd} parcelas mensais de aproximadamente{' '}
                <strong>{brl(saldoRestante / Number(renegQtd))}</strong> (última parcela ajustada). Parcelas
                pendentes/atrasadas atuais serão substituídas; pagas serão mantidas.
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenRenegociar(false)}>Cancelar</Button>
            <Button
              onClick={confirmarRenegociar}
              disabled={createParcelas.isPending || delParcela.isPending || updateTitulo.isPending}
            >
              Gerar parcelas
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal baixar parcela (conteúdo) */}
      <Dialog open={!!payingId} onOpenChange={(o) => !o && setPayingId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Baixar parcela</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Valor pago</Label>
              <Input type="number" step="0.01" value={payValor} onChange={e => setPayValor(e.target.value)} />
            </div>
            <div>
              <Label>Data do pagamento</Label>
              <Input type="date" value={payData} onChange={e => setPayData(e.target.value)} />
            </div>
            <div>
              <Label>Forma de pagamento</Label>
              <Select value={payForma} onValueChange={setPayForma}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayingId(null)}>Cancelar</Button>
            <Button onClick={confirmPay} disabled={markPaga.isPending}>Confirmar baixa</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal baixar entrada do título original */}
      <Dialog open={openEntrada} onOpenChange={setOpenEntrada}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Baixar entrada do título</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-xs text-muted-foreground">
              Registra o pagamento do título original como uma parcela de entrada quitada.
              As demais parcelas continuam em aberto.
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded border p-2">
                <div className="text-xs text-muted-foreground">Saldo restante</div>
                <div className="font-semibold text-amber-600">{brl(saldoRestante)}</div>
              </div>
              <div className="rounded border p-2">
                <div className="text-xs text-muted-foreground">Já recebido</div>
                <div className="font-semibold text-emerald-600">{brl(totals.pago)}</div>
              </div>
            </div>
            {temEntradaRegistrada && (
              <div className="text-xs text-amber-600">
                Já existe uma entrada registrada para este título. Uma nova entrada será somada às demais.
              </div>
            )}
            <div>
              <Label>Valor pago</Label>
              <Input type="number" step="0.01" value={entradaPagValor} onChange={e => setEntradaPagValor(e.target.value)} />
            </div>
            <div>
              <Label>Data do pagamento</Label>
              <Input type="date" value={entradaPagData} onChange={e => setEntradaPagData(e.target.value)} />
            </div>
            <div>
              <Label>Forma de pagamento</Label>
              <Select value={entradaPagForma} onValueChange={setEntradaPagForma}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenEntrada(false)}>Cancelar</Button>
            <Button onClick={confirmarBaixarEntrada} disabled={createParcelas.isPending}>Confirmar baixa</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Observações */}
      <Card>
        <CardHeader><CardTitle className="text-base">Observações</CardTitle></CardHeader>
        <CardContent>
          <Textarea
            defaultValue={titulo.observacoes || ''}
            placeholder="Notas do gestor de cobrança…"
            onBlur={async (e) => {
              const val = e.target.value;
              if (val === (titulo.observacoes || '')) return;
              try { await updateTitulo.mutateAsync({ id: titulo.id, observacoes: val }); }
              catch (err: any) { toast.error(err?.message || 'Erro ao salvar'); }
            }}
          />
        </CardContent>
      </Card>

      {/* Histórico */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><History className="w-4 h-4" /> Histórico</CardTitle></CardHeader>
        <CardContent>
          {(historico ?? []).length === 0 ? (
            <div className="text-sm text-muted-foreground">Sem eventos.</div>
          ) : (
            <ul className="space-y-2">
              {(historico ?? []).map(h => (
                <li key={h.id} className="text-sm border-l-2 border-muted pl-3">
                  <div className="text-xs text-muted-foreground">
                    {format(new Date(h.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })} · {h.tipo}
                  </div>
                  <div>{h.descricao} {h.valor ? `· ${brl(Number(h.valor))}` : ''}</div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}