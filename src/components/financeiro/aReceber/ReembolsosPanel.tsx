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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Undo2, CheckCircle2, Clock, XCircle, ShieldAlert, ShieldCheck, HelpCircle, Download, Filter } from 'lucide-react';
import { loadXLSX } from '@/lib/lazyExport';
import { toast } from 'sonner';
import { useArTitulos } from '@/hooks/useAReceber';
import {
  useArReembolsos,
  useCriarReembolso,
  useMarcarReembolsoPago,
  useCancelarReembolso,
} from '@/hooks/useArReembolsos';
import type { ArReembolsoWithTitulo } from '@/hooks/useArReembolsos';
import { EditarReembolsoDialog } from './EditarReembolsoDialog';
import { ExcluirReembolsoDialog } from './ExcluirReembolsoDialog';
import { AR_REEMBOLSO_STATUS_LABEL, type ArReembolsoStatus } from '@/types/aReceber';
import { ticketNumber } from '@/lib/arTicketNumber';
import { getRefundWindow } from '@/lib/refundWindow';

const brl = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

const fmtDay = (d: Date) => format(d, 'dd/MM/yyyy', { locale: ptBR });

/** Chip compacto com o prazo limite de reembolso (180d cartão / 90d PIX) */
function PrazoReembolsoBadge({
  saleDate,
  paymentMethod,
  referenceDate,
}: {
  saleDate?: string | null;
  paymentMethod?: string | null;
  referenceDate?: string | null;
}) {
  const w = getRefundWindow(saleDate, paymentMethod, referenceDate);
  if (w.allowed === null) {
    return (
      <Badge variant="outline" className="bg-muted text-muted-foreground">
        <HelpCircle className="w-3 h-3 mr-1" />
        Sem data de venda
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className={
        w.allowed
          ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30'
          : 'bg-rose-500/15 text-rose-600 border-rose-500/30'
      }
    >
      {w.allowed ? <ShieldCheck className="w-3 h-3 mr-1" /> : <ShieldAlert className="w-3 h-3 mr-1" />}
      {w.allowed ? `${w.daysLeft}d restantes` : `Expirado há ${Math.abs(w.daysLeft!)}d`}
    </Badge>
  );
}

/** Bloco detalhado exibido no formulário de novo reembolso */
function PrazoReembolsoInfo({
  saleDate,
  paymentMethod,
  referenceDate,
}: {
  saleDate?: string | null;
  paymentMethod?: string | null;
  referenceDate?: string | null;
}) {
  const w = getRefundWindow(saleDate, paymentMethod, referenceDate);
  const tone =
    w.allowed === null
      ? 'border-border bg-muted/40'
      : w.allowed
        ? 'border-emerald-500/40 bg-emerald-500/10'
        : 'border-rose-500/40 bg-rose-500/10';
  return (
    <div className={`rounded-md border p-3 text-xs space-y-1 ${tone}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-sm">Tempo limite de reembolso</span>
        <PrazoReembolsoBadge
          saleDate={saleDate}
          paymentMethod={paymentMethod}
          referenceDate={referenceDate}
        />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div>
          <div className="text-muted-foreground">Meio de pagamento</div>
          <div className="font-medium">{w.methodLabel}</div>
        </div>
        <div>
          <div className="text-muted-foreground">Prazo</div>
          <div className="font-medium">{w.limitDays} dias</div>
        </div>
        <div>
          <div className="text-muted-foreground">Data da venda</div>
          <div className="font-medium">
            {saleDate ? fmtDay(new Date(String(saleDate).slice(0, 10) + 'T00:00:00')) : '—'}
          </div>
        </div>
        <div>
          <div className="text-muted-foreground">Limite para reembolsar</div>
          <div className="font-medium">{w.deadline ? fmtDay(w.deadline) : '—'}</div>
        </div>
      </div>
      <p className="text-muted-foreground pt-1">
        Regra: 180 dias para cartão de crédito e 90 dias para PIX, contados da data da venda.
        {w.allowed === false && ' Prazo expirado — o estorno pelo gateway pode ser recusado.'}
        {w.allowed === null && ' Sem data de venda no título não é possível calcular o prazo.'}
      </p>
    </div>
  );
}

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
  // filtro de situação do prazo na aba "Novo reembolso"
  const [filtroPrazoTit, setFiltroPrazoTit] = useState<'todos' | 'dentro' | 'expirado' | 'sem_data'>('todos');
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
  const [editando, setEditando] = useState<ArReembolsoWithTitulo | null>(null);
  const [excluindo, setExcluindo] = useState<ArReembolsoWithTitulo | null>(null);
  const [listSearch, setListSearch] = useState('');
  const [prazoDe, setPrazoDe] = useState('');
  const [prazoAte, setPrazoAte] = useState('');
  const [pedidoDe, setPedidoDe] = useState('');
  const [pedidoAte, setPedidoAte] = useState('');
  const [previstaDe, setPrevistaDe] = useState('');
  const [previstaAte, setPrevistaAte] = useState('');

  const limparFiltrosData = () => {
    setPrazoDe(''); setPrazoAte('');
    setPedidoDe(''); setPedidoAte('');
    setPrevistaDe(''); setPrevistaAte('');
  };

  const temFiltroData = !!(prazoDe || prazoAte || pedidoDe || pedidoAte || previstaDe || previstaAte);

  const reembolsosFiltrados = useMemo(() => {
    const q = listSearch.trim().toLowerCase();
    const inRange = (iso: string | null | undefined, de: string, ate: string) => {
      if (!de && !ate) return true;
      if (!iso) return false;
      const d = String(iso).slice(0, 10);
      if (de && d < de) return false;
      if (ate && d > ate) return false;
      return true;
    };
    return (reembolsos || []).filter((r) => {
      if (q) {
        const t = r.titulo;
        const match = [t?.customer_name, t?.customer_email, t?.customer_document, t?.product_code]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q));
        if (!match) return false;
      }
      if (!inRange(r.data_pedido, pedidoDe, pedidoAte)) return false;
      if (!inRange(r.data_prevista_pagamento, previstaDe, previstaAte)) return false;
      if (prazoDe || prazoAte) {
        const w = getRefundWindow(r.titulo?.sale_date, r.titulo?.payment_method);
        const deadlineIso = w.deadline ? format(w.deadline, 'yyyy-MM-dd') : null;
        if (!inRange(deadlineIso, prazoDe, prazoAte)) return false;
      }
      return true;
    });
  }, [reembolsos, listSearch, prazoDe, prazoAte, pedidoDe, pedidoAte, previstaDe, previstaAte]);

  // Totais dos cards (sobre a lista filtrada)
  const totais = useMemo(() => {
    const acc = {
      pendenteValor: 0,
      pendenteQtd: 0,
      pagoValor: 0,
      pagoQtd: 0,
      canceladoValor: 0,
      canceladoQtd: 0,
    };
    reembolsosFiltrados.forEach((r) => {
      const v = Number(r.valor || 0);
      if (r.status === 'pendente') {
        acc.pendenteValor += v;
        acc.pendenteQtd += 1;
      } else if (r.status === 'pago') {
        acc.pagoValor += v;
        acc.pagoQtd += 1;
      } else {
        acc.canceladoValor += v;
        acc.canceladoQtd += 1;
      }
    });
    return acc;
  }, [reembolsosFiltrados]);

  const [exportando, setExportando] = useState(false);

  const handleExportar = async () => {
    if (reembolsosFiltrados.length === 0) {
      toast.error('Nada para exportar com o filtro atual.');
      return;
    }
    setExportando(true);
    try {
      const XLSX = await loadXLSX();
      const fmt = (d?: string | null) =>
        d ? format(new Date(String(d).slice(0, 10) + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR }) : '';
      const rows = reembolsosFiltrados.map((r) => {
        // dias restantes calculados a partir de hoje (mesma regra do formulário)
        const w = getRefundWindow(r.titulo?.sale_date, r.titulo?.payment_method);

        return {
          'Nº Título': r.titulo?.id ? ticketNumber(r.titulo.id) : '',
          Cliente: r.titulo?.customer_name || '',
          'E-mail': r.titulo?.customer_email || '',
          Documento: r.titulo?.customer_document || '',
          Produto: r.titulo?.product_code || '',
          'Valor do reembolso': Number(r.valor || 0),
          Status: AR_REEMBOLSO_STATUS_LABEL[r.status],
          'Data do pedido': fmt(r.data_pedido),
          'Prev. pagamento': fmt(r.data_prevista_pagamento),
          'Pago em': fmt(r.data_pagamento),
          'Data da venda': fmt(r.titulo?.sale_date),
          'Meio de pagamento': w.methodLabel,
          'Prazo (dias)': w.limitDays ?? '',
          'Limite para reembolsar': w.deadline ? fmtDay(w.deadline) : '',
          'Prazo situação':
            w.allowed === null
              ? 'Sem data de venda'
              : w.allowed
                ? `${w.daysLeft}d restantes`
                : `Expirado há ${Math.abs(w.daysLeft!)}d`,
          Motivo: r.motivo || '',
        };
      });
      rows.push({} as any);
      rows.push({
        Cliente: 'TOTAIS',
        Status: `A reembolsar: ${totais.pendenteQtd} | Reembolsados: ${totais.pagoQtd} | Cancelados: ${totais.canceladoQtd}`,
        'Valor do reembolso': totais.pendenteValor + totais.pagoValor,
      } as any);

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Reembolsos');
      XLSX.writeFile(wb, `reembolsos-${format(new Date(), 'yyyy-MM-dd-HHmm')}.xlsx`);
      toast.success('Exportação gerada.');
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao exportar.');
    } finally {
      setExportando(false);
    }
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[98vw] w-[98vw] h-[95vh] flex flex-col overflow-hidden p-4 sm:p-6">
        <DialogHeader className="shrink-0">
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

        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as any)}
          className="flex-1 min-h-0 flex flex-col"
        >
          <TabsList>
            <TabsTrigger value="novo">Novo reembolso</TabsTrigger>
            <TabsTrigger value="lista">Reembolsos ({reembolsos?.length ?? 0})</TabsTrigger>
          </TabsList>

          {/* NOVO */}
          <TabsContent value="novo" className="space-y-4 mt-3 flex-1 min-h-0 overflow-y-auto">
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
              <CardContent className="pt-4 max-h-[45vh] overflow-y-auto">
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

          </TabsContent>

          {/* LISTA */}
          <TabsContent value="lista" className="mt-3 flex-1 min-h-0 flex flex-col gap-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 shrink-0">
              <Card className="border-amber-500/40 bg-amber-500/5">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-amber-600">
                    <Clock className="w-4 h-4" /> A reembolsar
                  </div>
                  <div className="text-2xl font-bold mt-1">{brl(totais.pendenteValor)}</div>
                  <div className="text-xs text-muted-foreground">{totais.pendenteQtd} pendente(s)</div>
                </CardContent>
              </Card>
              <Card className="border-emerald-500/40 bg-emerald-500/5">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-emerald-600">
                    <CheckCircle2 className="w-4 h-4" /> Reembolsados
                  </div>
                  <div className="text-2xl font-bold mt-1">{brl(totais.pagoValor)}</div>
                  <div className="text-xs text-muted-foreground">{totais.pagoQtd} pago(s)</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <XCircle className="w-4 h-4" /> Cancelados
                  </div>
                  <div className="text-2xl font-bold mt-1">{brl(totais.canceladoValor)}</div>
                  <div className="text-xs text-muted-foreground">{totais.canceladoQtd} cancelado(s)</div>
                </CardContent>
              </Card>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div className="relative max-w-md flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Filtrar por nome do contato, e-mail, CPF ou produto…"
                  value={listSearch}
                  onChange={(e) => setListSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
              <Button variant="outline" onClick={handleExportar} disabled={exportando}>
                <Download className="w-4 h-4 mr-2" />
                {exportando ? 'Exportando…' : 'Exportar Excel'}
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 shrink-0">
              <div className="rounded-md border p-2 space-y-1">
                <Label className="text-xs text-muted-foreground">Prazo limite</Label>
                <div className="flex items-center gap-2">
                  <Input type="date" value={prazoDe} onChange={(e) => setPrazoDe(e.target.value)} className="h-8 text-xs" />
                  <span className="text-xs text-muted-foreground">até</span>
                  <Input type="date" value={prazoAte} onChange={(e) => setPrazoAte(e.target.value)} className="h-8 text-xs" />
                </div>
              </div>
              <div className="rounded-md border p-2 space-y-1">
                <Label className="text-xs text-muted-foreground">Data de solicitação</Label>
                <div className="flex items-center gap-2">
                  <Input type="date" value={pedidoDe} onChange={(e) => setPedidoDe(e.target.value)} className="h-8 text-xs" />
                  <span className="text-xs text-muted-foreground">até</span>
                  <Input type="date" value={pedidoAte} onChange={(e) => setPedidoAte(e.target.value)} className="h-8 text-xs" />
                </div>
              </div>
              <div className="rounded-md border p-2 space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Data prevista</Label>
                  {temFiltroData && (
                    <button
                      type="button"
                      onClick={limparFiltrosData}
                      className="text-[11px] text-muted-foreground hover:text-foreground underline"
                    >
                      limpar datas
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Input type="date" value={previstaDe} onChange={(e) => setPrevistaDe(e.target.value)} className="h-8 text-xs" />
                  <span className="text-xs text-muted-foreground">até</span>
                  <Input type="date" value={previstaAte} onChange={(e) => setPrevistaAte(e.target.value)} className="h-8 text-xs" />
                </div>
              </div>
            </div>
            <Card className="flex-1 min-h-0 flex flex-col">
              <CardContent className="pt-4 flex-1 min-h-0 overflow-auto">
                {loadingList ? (
                  <div className="text-center text-sm text-muted-foreground py-6">Carregando…</div>
                ) : reembolsosFiltrados.length === 0 ? (
                  <div className="text-center text-sm text-muted-foreground py-6">
                    {listSearch ? 'Nenhum reembolso encontrado para esse filtro.' : 'Nenhum reembolso registrado.'}
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Produto</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead>Prazo limite</TableHead>
                        <TableHead>Pedido</TableHead>
                        <TableHead>Prev. pagamento</TableHead>
                        <TableHead>Pago em</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reembolsosFiltrados.map((r) => (
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
                            <PrazoReembolsoBadge
                              saleDate={r.titulo?.sale_date}
                              paymentMethod={r.titulo?.payment_method}
                              /* prazo restante é sempre em relação a hoje, não à data do pedido */
                            />
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
                            <div className="flex justify-end gap-2">
                              {r.status !== 'cancelado' && (
                                <Button size="sm" variant="outline" onClick={() => setEditando(r)}>
                                  Editar
                                </Button>
                              )}
                              {r.status === 'cancelado' && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => setExcluindo(r)}
                                >
                                  Excluir
                                </Button>
                              )}
                              {r.status === 'pendente' && (
                                <>
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
                                </>
                              )}
                            </div>
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

        {/* FORMULÁRIO NOVO REEMBOLSO — abre como caixinha sobre a tabela */}
        <Dialog
          open={!!selectedTitulo}
          onOpenChange={(v) => {
            if (!v) {
              setSelectedTituloId(null);
              setValor('');
              setMotivo('');
            }
          }}
        >
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Undo2 className="w-4 h-4 text-rose-600" />
                Novo reembolso
              </DialogTitle>
              <DialogDescription>
                Título {selectedTitulo ? ticketNumber(selectedTitulo.id) : ''} —{' '}
                <b>{selectedTitulo?.customer_name}</b>
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              {selectedTitulo && (
                <PrazoReembolsoInfo
                  saleDate={selectedTitulo.sale_date}
                  paymentMethod={selectedTitulo.payment_method}
                  referenceDate={dataPedido}
                />
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                <div className="sm:col-span-2">
                  <Label>Data prevista para pagamento</Label>
                  <Input
                    type="date"
                    value={dataPrevista}
                    onChange={(e) => setDataPrevista(e.target.value)}
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label>Motivo</Label>
                  <Textarea
                    rows={2}
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    placeholder="Descreva o motivo do reembolso"
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => {
                  setSelectedTituloId(null);
                  setValor('');
                  setMotivo('');
                }}
              >
                Cancelar
              </Button>
              <Button
                className="bg-rose-600 hover:bg-rose-700 text-white"
                disabled={criar.isPending}
                onClick={handleCriar}
              >
                {criar.isPending ? 'Criando…' : 'Criar reembolso'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <EditarReembolsoDialog
          reembolso={editando}
          onOpenChange={(v) => !v && setEditando(null)}
        />

        <ExcluirReembolsoDialog
          reembolso={excluindo}
          onOpenChange={(v) => !v && setExcluindo(null)}
        />

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