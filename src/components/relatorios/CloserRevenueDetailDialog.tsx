import { useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { FileText, RotateCcw, Trophy, TrendingDown, TrendingUp, CalendarCheck, CalendarX, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { getDeduplicatedGross } from '@/lib/incorporadorPricing';
import { useAllHublaTransactions } from '@/hooks/useAllHublaTransactions';
import { subMonths } from 'date-fns';
import { UnassignedTransactionsDetailPanel } from './UnassignedTransactionsDetailPanel';
import { useAtribuicaoCloser, type Atribuicao } from '@/hooks/useAtribuicaoCloser';
import { ALLOWED_INCORPORADOR_CATEGORIES } from './CloserRevenueSummaryTable';

const SP_DATETIME = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
});
const SP_DATE = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit',
});
const fmtDataHora = (iso: string | null | undefined) => (iso ? SP_DATETIME.format(new Date(iso)).replace(',', '') : '—');
const fmtDiaMes = (iso: string | null | undefined) => (iso ? SP_DATE.format(new Date(iso)) : '—');

interface Transaction {
  id: string;
  customer_email: string | null;
  customer_phone: string | null;
  product_name: string | null;
  product_category: string | null;
  product_price: number | null;
  net_value: number | null;
  sale_date: string | null;
  sale_status: string | null;
  installment_number: number | null;
  gross_override?: number | null;
  reference_price?: number | null;
  sale_origin?: string | null;
  customer_name?: string | null;
}

interface AttendeeMatch {
  id: string;
  attendee_phone: string | null;
  deal_id: string | null;
  meeting_slots: { closer_id: string | null; scheduled_at: string | null } | null;
  crm_deals: { crm_contacts: { email: string | null; phone: string | null } | null } | null;
}

interface CloserRevenueDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  closerName: string;
  closerId: string;
  transactions: Transaction[];
  globalFirstIds: Set<string>;
  attendees: AttendeeMatch[];
  closers?: { id: string; name: string }[];
  startDate?: Date;
  endDate?: Date;
  atribuicaoMap?: Map<string, Atribuicao>;
  bu?: string;
}

// ============= Classificador único (cards + breakdown + coluna Tipo) =============
type GrupoVenda = 'contrato' | 'p2' | 'parceria' | 'a010' | 'outros' | 'venda';

/** Olha primeiro o código do produto (product_name, trim, case-insensitive) e depois a categoria. */
export function grupoVenda(tx: Pick<Transaction, 'product_name' | 'product_category'>): GrupoVenda {
  const nome = (tx.product_name || '').trim().toLowerCase();
  const cat = (tx.product_category || '').trim().toLowerCase();
  // "A000 - Contrato" costuma vir gravado com categoria 'incorporador', por isso o nome vem antes.
  if (nome.startsWith('a000') || nome.includes('contrato mcf') || cat === 'contrato' || cat === 'contrato-anticrise') return 'contrato';
  if (nome.startsWith('a005') || cat === 'p2') return 'p2';
  if (cat === 'parceria' || cat === 'renovacao' || nome.includes('renovação') || nome.includes('renovacao') || /^r0/.test(nome)) return 'parceria';
  if (cat === 'a010' || nome.startsWith('a010')) return 'a010';
  if (nome.includes('lucrômetro') || nome.includes('lucrometro') || cat === 'ob_vitalicio') return 'outros';
  if (/^a001/.test(nome) || /^a003/.test(nome) || /^a004/.test(nome) || /^a009/.test(nome) || cat === 'incorporador') return 'venda';
  return 'outros';
}

const GRUPO_LABEL: Record<GrupoVenda, string> = {
  contrato: 'Contratos (caução)',
  venda: 'Vendas MCF',
  p2: 'P2',
  parceria: 'Parcerias / Recorrência',
  a010: 'A010',
  outros: 'Outros',
};

const GRUPO_CURTO: Record<GrupoVenda, string> = {
  contrato: 'Contrato',
  venda: 'Venda MCF',
  p2: 'P2',
  parceria: 'Parceria',
  a010: 'A010',
  outros: 'Outros',
};

const GRUPO_ORDEM: GrupoVenda[] = ['contrato', 'venda', 'p2', 'parceria', 'a010', 'outros'];

export function CloserRevenueDetailDialog({
  open,
  onOpenChange,
  closerName,
  closerId,
  transactions,
  globalFirstIds,
  attendees,
  closers = [],
  startDate,
  endDate,
  atribuicaoMap,
  bu,
}: CloserRevenueDetailDialogProps) {
  const isAutomaticRow = closerId.startsWith('__');
  const isUnassigned = closerId === '__unassigned__';
  const isLaunch = closerId === '__launch__';
  // Previous month data for comparison
  const prevMonthFilters = useMemo(() => {
    if (!startDate || !endDate) return { startDate: undefined, endDate: undefined };
    return {
      startDate: subMonths(startDate, 1),
      endDate: subMonths(endDate, 1),
    };
  }, [startDate, endDate]);

  const { data: prevMonthTransactions = [] } = useAllHublaTransactions({
    startDate: prevMonthFilters.startDate,
    endDate: prevMonthFilters.endDate,
  });

  // Mês anterior: mesma allowlist de categorias da tabela principal + atribuição pela RPC
  const prevScopedTxs = useMemo(() => {
    if (isAutomaticRow) return [];
    return bu === 'incorporador'
      ? prevMonthTransactions.filter((tx) => {
          const cat = tx.product_category || '';
          return ALLOWED_INCORPORADOR_CATEGORIES.has(cat) || cat === '';
        })
      : prevMonthTransactions;
  }, [prevMonthTransactions, bu, isAutomaticRow]);
  const prevIds = useMemo(() => prevScopedTxs.map((t) => t.id), [prevScopedTxs]);
  const { map: prevAtribuicaoMap } = useAtribuicaoCloser(prevIds, bu);

  const prevCloserTxs = useMemo(() => {
    return prevScopedTxs.filter((tx) => {
      const a = prevAtribuicaoMap.get(tx.id);
      return !!a && a.closer_id === closerId && !a.is_outside;
    });
  }, [prevScopedTxs, prevAtribuicaoMap, closerId]);

  // Lista de vendas do período
  const vendas = useMemo(() => {
    const rows = transactions.map((tx) => {
      const a = atribuicaoMap?.get(tx.id);
      return {
        tx,
        a,
        gross: getDeduplicatedGross(tx as any, globalFirstIds.has(tx.id)),
        net: tx.net_value || 0,
        outside: !!a?.is_outside,
      };
    });
    rows.sort((x, y) => (y.tx.sale_date || '').localeCompare(x.tx.sale_date || ''));
    const dentro = rows.filter((r) => !r.outside);
    const fora = rows.filter((r) => r.outside);
    return {
      rows,
      totalGross: dentro.reduce((s, r) => s + r.gross, 0),
      totalNet: dentro.reduce((s, r) => s + r.net, 0),
      outsideCount: fora.length,
      outsideGross: fora.reduce((s, r) => s + r.gross, 0),
      outsideNet: fora.reduce((s, r) => s + r.net, 0),
    };
  }, [transactions, atribuicaoMap, globalFirstIds]);
  const showVendas = !isUnassigned && vendas.rows.length > 0;

  const atribuicaoBadge = (a?: Atribuicao) => {
    if (!a) return null;
    const sufixo = a.outra_bu ? ' · outra BU' : '';
    if (a.is_outside) {
      return (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 whitespace-nowrap border-amber-500/60 text-amber-500">
          Outside · R1 {fmtDiaMes(a.r1_at)}{sufixo}
        </Badge>
      );
    }
    let label = '';
    if (a.regra === 'vinculo') label = 'Vínculo manual';
    else if (a.regra === 'r1_contrato_pago') label = `R1 c/ contrato · ${fmtDiaMes(a.r1_at)}`;
    else label = `R1 · ${fmtDiaMes(a.r1_at)}`;
    return (
      <Badge variant="outline" className="text-[10px] px-1.5 py-0 whitespace-nowrap">
        {label}{sufixo}
      </Badge>
    );
  };

  const metrics = useMemo(() => {
    const calcGross = (txs: Transaction[], forceFirst = false) =>
      txs.reduce((s, t) => s + getDeduplicatedGross(t as any, forceFirst || globalFirstIds.has(t.id)), 0);
    const calcNet = (txs: Transaction[]) =>
      txs.reduce((s, t) => s + (t.net_value || 0), 0);

    const grupoOf = (t: Transaction) => grupoVenda(t);
    const byGrupo = (g: GrupoVenda) => transactions.filter((t) => grupoOf(t) === g);

    const grupoStats = (g: GrupoVenda) => {
      const txs = byGrupo(g);
      return { count: txs.length, gross: calcGross(txs, g === 'parceria'), net: calcNet(txs) };
    };

    const contracts = grupoStats('contrato');
    const vendasMcf = grupoStats('venda');
    const p2 = grupoStats('p2');
    const parcerias = grupoStats('parceria');
    const a010 = grupoStats('a010');
    const outrosGrupo = grupoStats('outros');

    const refunds = transactions.filter(
      (t) => t.sale_status === 'refunded' || (t.net_value !== null && t.net_value < 0)
    );

    const refundsNet = Math.abs(calcNet(refunds));
    const totalGross = calcGross(transactions);
    const totalNet = calcNet(transactions);

    // By day
    const dayMap = new Map<string, number>();
    for (const tx of transactions) {
      if (!tx.sale_date) continue;
      const day = tx.sale_date.substring(0, 10);
      dayMap.set(day, (dayMap.get(day) || 0) + getDeduplicatedGross(tx as any, globalFirstIds.has(tx.id)));
    }
    const days = Array.from(dayMap.entries()).filter(([, v]) => v > 0);
    days.sort((a, b) => b[1] - a[1]);
    const bestDay = days[0] || null;
    const worstDay = days[days.length - 1] || null;

    // Breakdown por grupo (classificador único)
    const categories = GRUPO_ORDEM
      .map((g) => ({ name: g, label: GRUPO_LABEL[g], ...grupoStats(g) }))
      .filter((c) => c.count > 0);

    // Parceria breakdown (by product_name)
    const parceriaMap = new Map<string, { count: number; gross: number; net: number }>();
    for (const tx of byGrupo('parceria')) {
      const name = tx.product_name || 'Parceria';
      const existing = parceriaMap.get(name) || { count: 0, gross: 0, net: 0 };
      existing.count++;
      existing.gross += getDeduplicatedGross(tx as any, true);
      existing.net += tx.net_value || 0;
      parceriaMap.set(name, existing);
    }
    const parceriaBreakdown = Array.from(parceriaMap.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.gross - a.gross);

    // Previous month
    const prevGross = prevCloserTxs.reduce(
      (s, t) => s + getDeduplicatedGross(t as any, true),
      0
    );
    const prevCount = prevCloserTxs.length;
    const grossChange = prevGross > 0 ? ((totalGross - prevGross) / prevGross) * 100 : null;
    const countChange = prevCount > 0 ? ((transactions.length - prevCount) / prevCount) * 100 : null;

    return {
      contracts,
      vendasMcf,
      p2,
      parcerias,
      a010,
      outrosGrupo,
      refunds: { count: refunds.length, value: refundsNet },
      totalGross,
      totalNet,
      bestDay,
      worstDay,
      categories,
      parceriaBreakdown,
      grossChange,
      countChange,
      prevGross,
    };
  }, [transactions, globalFirstIds, prevCloserTxs]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
       <DialogContent className={isUnassigned || showVendas ? "max-w-4xl max-h-[90vh] overflow-y-auto" : "max-w-2xl max-h-[85vh] overflow-y-auto"}>
        <DialogHeader>
          <DialogTitle className="text-lg">{closerName}</DialogTitle>
          <DialogDescription>
            {startDate && endDate
              ? `${formatDate(startDate)} — ${formatDate(endDate)}`
              : 'Período selecionado'}
            {isUnassigned && ' • Diagnóstico de transações não atribuídas'}
            {isLaunch && ' • Vendas provenientes de lançamentos'}
          </DialogDescription>
        </DialogHeader>

        {isUnassigned ? (
          <UnassignedTransactionsDetailPanel
            transactions={transactions}
            globalFirstIds={globalFirstIds}
            attendees={attendees}
            closers={closers}
          />
        ) : (
        <>

        {/* KPI Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Card className="bg-card border-border">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <FileText className="h-4 w-4 text-primary" />
                <span className="text-xs font-medium text-muted-foreground">Contratos (caução)</span>
              </div>
              <p className="text-lg font-bold">{metrics.contracts.count}</p>
              <p className="text-xs text-muted-foreground font-mono">Bruto {formatCurrency(metrics.contracts.gross)}</p>
              <p className="text-xs text-success font-mono">Líq. {formatCurrency(metrics.contracts.net)}</p>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <Trophy className="h-4 w-4 text-primary" />
                <span className="text-xs font-medium text-muted-foreground">Vendas MCF</span>
              </div>
              <p className="text-[10px] text-muted-foreground leading-none mb-0.5">A001 · A003 · A009</p>
              <p className="text-lg font-bold">{metrics.vendasMcf.count}</p>
              <p className="text-xs text-muted-foreground font-mono">Bruto {formatCurrency(metrics.vendasMcf.gross)}</p>
              <p className="text-xs text-success font-mono">Líq. {formatCurrency(metrics.vendasMcf.net)}</p>
            </CardContent>
          </Card>

          {metrics.p2.count > 0 && (
            <Card className="bg-card border-border">
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  <span className="text-xs font-medium text-muted-foreground">P2</span>
                </div>
                <p className="text-lg font-bold">{metrics.p2.count}</p>
                <p className="text-xs text-muted-foreground font-mono">Bruto R$ 0 (regra P2)</p>
                <p className="text-xs text-success font-mono">Líq. {formatCurrency(metrics.p2.net)}</p>
              </CardContent>
            </Card>
          )}

          {metrics.parcerias.count > 0 && (
            <Card className="bg-card border-border">
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  <span className="text-xs font-medium text-muted-foreground">Parcerias / Recorrência</span>
                </div>
                <p className="text-lg font-bold">{metrics.parcerias.count}</p>
                <p className="text-xs text-muted-foreground font-mono">Bruto {formatCurrency(metrics.parcerias.gross)}</p>
                <p className="text-xs text-success font-mono">Líq. {formatCurrency(metrics.parcerias.net)}</p>
              </CardContent>
            </Card>
          )}

          {metrics.refunds.count > 0 && (
            <Card className="bg-card border-border">
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-1">
                  <RotateCcw className="h-4 w-4 text-destructive" />
                  <span className="text-xs font-medium text-muted-foreground">Reembolsos</span>
                </div>
                <p className="text-lg font-bold">{metrics.refunds.count}</p>
                <p className="text-xs text-destructive font-mono">-{formatCurrency(metrics.refunds.value)}</p>
              </CardContent>
            </Card>
          )}

          {(metrics.a010.count > 0 || metrics.outrosGrupo.count > 0) && (
            <Card className="bg-card border-border">
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingDown className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">Outros</span>
                </div>
                <p className="text-lg font-bold">{metrics.a010.count + metrics.outrosGrupo.count}</p>
                <p className="text-xs text-muted-foreground font-mono">Bruto {formatCurrency(metrics.a010.gross + metrics.outrosGrupo.gross)}</p>
                <p className="text-xs text-success font-mono">Líq. {formatCurrency(metrics.a010.net + metrics.outrosGrupo.net)}</p>
              </CardContent>
            </Card>
          )}

          <Card className="bg-card border-border">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <Trophy className="h-4 w-4 text-success" />
                <span className="text-xs font-medium text-muted-foreground">Contribuição Total</span>
              </div>
              <p className="text-lg font-bold font-mono">{formatCurrency(metrics.totalGross)}</p>
              <p className="text-xs text-success font-mono">Líq. {formatCurrency(metrics.totalNet)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Vendas do período */}
        {showVendas && (
          <div>
            <p className="text-sm font-medium mb-2">Vendas do período</p>
            <div className={vendas.rows.length > 15 ? 'max-h-[360px] overflow-y-auto rounded-md border border-border' : 'rounded-md border border-border'}>
              <Table className="text-xs">
                <TableHeader className={vendas.rows.length > 15 ? 'sticky top-0 z-10 bg-background' : undefined}>
                  <TableRow>
                    <TableHead className="text-xs">Data</TableHead>
                    <TableHead className="text-xs">Comprador</TableHead>
                    <TableHead className="text-xs w-20">Tipo</TableHead>
                    <TableHead className="text-xs">Produto</TableHead>
                    <TableHead className="text-xs text-right">Bruto</TableHead>
                    <TableHead className="text-xs text-right">Líquido</TableHead>
                    <TableHead className="text-xs">Atribuição</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vendas.rows.map(({ tx, a, gross, net }) => (
                    <TableRow key={tx.id}>
                      <TableCell className="py-1.5 whitespace-nowrap font-mono">{fmtDataHora(tx.sale_date)}</TableCell>
                      <TableCell className="py-1.5">
                        {a?.deal_id ? (
                          <a href={`/crm/negocios?deal=${a.deal_id}`} className="font-semibold text-primary hover:underline">
                            {tx.customer_name || '—'}
                          </a>
                        ) : (
                          <span className="font-semibold">{tx.customer_name || '—'}</span>
                        )}
                        {tx.customer_email && (
                          <div className="text-muted-foreground">{tx.customer_email}</div>
                        )}
                      </TableCell>
                      <TableCell className="py-1.5">
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 whitespace-nowrap">
                          {GRUPO_CURTO[grupoVenda(tx)]}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-1.5">{tx.product_name || '—'}</TableCell>
                      <TableCell className="py-1.5 text-right font-mono whitespace-nowrap">{formatCurrency(gross)}</TableCell>
                      <TableCell className={`py-1.5 text-right font-mono whitespace-nowrap ${net < 0 ? 'text-destructive' : 'text-success'}`}>
                        {formatCurrency(net)}
                      </TableCell>
                      <TableCell className="py-1.5">{atribuicaoBadge(a)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="mt-2 space-y-0.5 text-xs">
              <div className="flex justify-end gap-4 font-semibold">
                <span>Total</span>
                <span className="font-mono">{formatCurrency(vendas.totalGross)}</span>
                <span className="font-mono text-success">{formatCurrency(vendas.totalNet)}</span>
              </div>
              {vendas.outsideCount > 0 && (
                <div className="flex justify-end gap-4 text-muted-foreground">
                  <span>Outside (fora do total) · {vendas.outsideCount}</span>
                  <span className="font-mono">{formatCurrency(vendas.outsideGross)}</span>
                  <span className="font-mono">{formatCurrency(vendas.outsideNet)}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Comparison with previous month */}
        {!isAutomaticRow && (metrics.grossChange !== null || metrics.countChange !== null) && (
          <Card className="bg-muted/30 border-border">
            <CardContent className="p-3">
              <p className="text-xs font-medium text-muted-foreground mb-2">Comparativo com mês anterior</p>
              <div className="flex gap-4">
                {metrics.grossChange !== null && (
                  <div className="flex items-center gap-1.5">
                    {metrics.grossChange >= 0 ? (
                      <ArrowUpRight className="h-4 w-4 text-success" />
                    ) : (
                      <ArrowDownRight className="h-4 w-4 text-destructive" />
                    )}
                    <span className={`text-sm font-semibold ${metrics.grossChange >= 0 ? 'text-success' : 'text-destructive'}`}>
                      {metrics.grossChange > 0 ? '+' : ''}{metrics.grossChange.toFixed(1)}%
                    </span>
                    <span className="text-xs text-muted-foreground">faturamento</span>
                  </div>
                )}
                {metrics.countChange !== null && (
                  <div className="flex items-center gap-1.5">
                    {metrics.countChange >= 0 ? (
                      <ArrowUpRight className="h-4 w-4 text-success" />
                    ) : (
                      <ArrowDownRight className="h-4 w-4 text-destructive" />
                    )}
                    <span className={`text-sm font-semibold ${metrics.countChange >= 0 ? 'text-success' : 'text-destructive'}`}>
                      {metrics.countChange > 0 ? '+' : ''}{metrics.countChange.toFixed(1)}%
                    </span>
                    <span className="text-xs text-muted-foreground">transações</span>
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Mês anterior: {formatCurrency(metrics.prevGross)} ({prevCloserTxs.length} transações)
              </p>
            </CardContent>
          </Card>
        )}

        {/* Best / Worst Day */}
        <div className="grid grid-cols-2 gap-3">
          {metrics.bestDay && (
            <Card className="bg-card border-border">
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-1">
                  <CalendarCheck className="h-4 w-4 text-success" />
                  <span className="text-xs font-medium text-muted-foreground">Melhor Dia</span>
                </div>
                <p className="text-sm font-bold">{formatDate(metrics.bestDay[0])}</p>
                <p className="text-xs font-mono text-success">{formatCurrency(metrics.bestDay[1])}</p>
              </CardContent>
            </Card>
          )}
          {metrics.worstDay && metrics.bestDay && metrics.worstDay[0] !== metrics.bestDay[0] && (
            <Card className="bg-card border-border">
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-1">
                  <CalendarX className="h-4 w-4 text-destructive" />
                  <span className="text-xs font-medium text-muted-foreground">Pior Dia</span>
                </div>
                <p className="text-sm font-bold">{formatDate(metrics.worstDay[0])}</p>
                <p className="text-xs font-mono text-destructive">{formatCurrency(metrics.worstDay[1])}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Parceria breakdown */}
        {metrics.parceriaBreakdown.length > 0 && (
          <div>
            <p className="text-sm font-semibold mb-2">Detalhamento de Parcerias</p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Produto</TableHead>
                  <TableHead className="text-xs text-right">Qtd</TableHead>
                  <TableHead className="text-xs text-right">Bruto</TableHead>
                  <TableHead className="text-xs text-right">Líquido</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {metrics.parceriaBreakdown.map((p) => (
                  <TableRow key={p.name}>
                    <TableCell className="text-xs">{p.name}</TableCell>
                    <TableCell className="text-xs text-right">{p.count}</TableCell>
                    <TableCell className="text-xs text-right font-mono">{formatCurrency(p.gross)}</TableCell>
                    <TableCell className="text-xs text-right font-mono text-success">{formatCurrency(p.net)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <tfoot className="border-t bg-muted/50 font-medium">
                <TableRow>
                  <TableCell className="text-xs font-bold">Total</TableCell>
                  <TableCell className="text-xs text-right font-bold">{metrics.parcerias.count}</TableCell>
                  <TableCell className="text-xs text-right font-mono font-bold">{formatCurrency(metrics.parcerias.gross)}</TableCell>
                  <TableCell className="text-xs text-right font-mono font-bold text-success">{formatCurrency(metrics.parcerias.net)}</TableCell>
                </TableRow>
              </tfoot>
            </Table>
          </div>
        )}

        {/* Category breakdown (por grupo do classificador) */}
        {metrics.categories.length > 0 && (
          <div>
            <p className="text-sm font-semibold mb-2">Breakdown por Categoria</p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Categoria</TableHead>
                  <TableHead className="text-xs text-right">Transações</TableHead>
                  <TableHead className="text-xs text-right">Bruto</TableHead>
                  <TableHead className="text-xs text-right">Líquido</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {metrics.categories.map((cat) => (
                  <TableRow key={cat.name}>
                    <TableCell className="text-xs">
                      <Badge variant="outline" className="text-xs">{cat.label}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-right">{cat.count}</TableCell>
                    <TableCell className="text-xs text-right font-mono">{formatCurrency(cat.gross)}</TableCell>
                    <TableCell className="text-xs text-right font-mono">{formatCurrency(cat.net)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        </>
        )}
      </DialogContent>
    </Dialog>
  );
}
