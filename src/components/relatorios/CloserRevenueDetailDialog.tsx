import { useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { FileText, Handshake, RotateCcw, Trophy, TrendingDown, TrendingUp, CalendarCheck, CalendarX, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { getDeduplicatedGross } from '@/lib/incorporadorPricing';
import { useAllHublaTransactions } from '@/hooks/useAllHublaTransactions';
import { subMonths } from 'date-fns';

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
  startDate?: Date;
  endDate?: Date;
}

const normalizePhone = (phone: string | null | undefined): string => {
  return (phone || '').replace(/\D/g, '');
};

const CONTRACT_CATEGORIES = ['incorporador', 'contrato', 'contrato-anticrise'];

export function CloserRevenueDetailDialog({
  open,
  onOpenChange,
  closerName,
  closerId,
  transactions,
  globalFirstIds,
  attendees,
  startDate,
  endDate,
}: CloserRevenueDetailDialogProps) {
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

  // Build closer contact set for prev month matching
  const closerContacts = useMemo(() => {
    const emails = new Set<string>();
    const phones = new Set<string>();
    for (const a of attendees) {
      if (a.meeting_slots?.closer_id !== closerId) continue;
      const email = a.crm_deals?.crm_contacts?.email?.toLowerCase();
      if (email) emails.add(email);
      const phone = normalizePhone(a.crm_deals?.crm_contacts?.phone);
      if (phone.length >= 8) phones.add(phone);
    }
    return { emails, phones };
  }, [attendees, closerId]);

  // Filter prev month transactions for this closer
  const prevCloserTxs = useMemo(() => {
    return prevMonthTransactions.filter((tx) => {
      const txEmail = (tx.customer_email || '').toLowerCase();
      const txPhone = normalizePhone(tx.customer_phone);
      return (
        (txEmail && closerContacts.emails.has(txEmail)) ||
        (txPhone.length >= 8 && closerContacts.phones.has(txPhone))
      );
    });
  }, [prevMonthTransactions, closerContacts]);

  // Build contact->attendee map for Outside detection
  const contactToAttendee = useMemo(() => {
    const map = new Map<string, AttendeeMatch>();
    for (const a of attendees) {
      if (a.meeting_slots?.closer_id !== closerId) continue;
      const email = a.crm_deals?.crm_contacts?.email?.toLowerCase();
      if (email) map.set(`e:${email}`, a);
      const phone = normalizePhone(a.crm_deals?.crm_contacts?.phone);
      if (phone.length >= 8) map.set(`p:${phone}`, a);
    }
    return map;
  }, [attendees, closerId]);

  const metrics = useMemo(() => {
    // Current period
    const contracts = transactions.filter((t) =>
      CONTRACT_CATEGORIES.includes(t.product_category || '')
    );
    const parcerias = transactions.filter(
      (t) => t.product_category === 'parceria' || t.product_category === 'renovacao'
    );
    const refunds = transactions.filter(
      (t) => t.sale_status === 'refunded' || (t.net_value !== null && t.net_value < 0)
    );

    // Outside detection
    let outsideCount = 0;
    let outsideGross = 0;
    for (const tx of transactions) {
      const txEmail = (tx.customer_email || '').toLowerCase();
      const txPhone = normalizePhone(tx.customer_phone);
      const att = (txEmail && contactToAttendee.get(`e:${txEmail}`)) ||
        (txPhone.length >= 8 && contactToAttendee.get(`p:${txPhone}`)) || null;
      if (att?.meeting_slots?.scheduled_at && tx.sale_date) {
        if (new Date(tx.sale_date) < new Date(att.meeting_slots.scheduled_at)) {
          outsideCount++;
          outsideGross += getDeduplicatedGross(tx as any, globalFirstIds.has(tx.id));
        }
      }
    }

    const calcGross = (txs: Transaction[]) =>
      txs.reduce((s, t) => s + getDeduplicatedGross(t as any, globalFirstIds.has(t.id)), 0);
    const calcNet = (txs: Transaction[]) =>
      txs.reduce((s, t) => s + (t.net_value || 0), 0);

    const contractsGross = calcGross(contracts);
    const parceriasGross = parcerias.reduce(
      (s, t) => s + getDeduplicatedGross(t as any, true), 0
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

    // By category breakdown
    const catMap = new Map<string, { count: number; gross: number; net: number }>();
    for (const tx of transactions) {
      let cat = tx.product_category || 'outros';
      if (cat === 'a010' || cat === 'renovacao') cat = 'parceria';
      const existing = catMap.get(cat) || { count: 0, gross: 0, net: 0 };
      existing.count++;
      existing.gross += getDeduplicatedGross(tx as any, globalFirstIds.has(tx.id));
      existing.net += tx.net_value || 0;
      catMap.set(cat, existing);
    }
    const categories = Array.from(catMap.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.gross - a.gross);

    // Parceria breakdown (by product_name)
    const parceriaMap = new Map<string, { count: number; gross: number; net: number }>();
    for (const tx of parcerias) {
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

    const contractsNet = calcNet(contracts);
    const parceriasNet = calcNet(parcerias);

    return {
      contracts: { count: contracts.length, gross: contractsGross, net: contractsNet },
      parcerias: { count: parcerias.length, gross: parceriasGross, net: parceriasNet },
      refunds: { count: refunds.length, value: refundsNet },
      outside: { count: outsideCount, gross: outsideGross },
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
  }, [transactions, globalFirstIds, prevCloserTxs, contactToAttendee]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg">{closerName}</DialogTitle>
          <DialogDescription>
            {startDate && endDate
              ? `${formatDate(startDate)} — ${formatDate(endDate)}`
              : 'Período selecionado'}
          </DialogDescription>
        </DialogHeader>

        {/* KPI Grid */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="bg-card border-border">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <FileText className="h-4 w-4 text-primary" />
                <span className="text-xs font-medium text-muted-foreground">Contratos</span>
              </div>
              <p className="text-lg font-bold">{metrics.contracts.count}</p>
              <p className="text-xs text-muted-foreground font-mono">Bruto {formatCurrency(metrics.contracts.gross)}</p>
              <p className="text-xs text-success font-mono">Líq. {formatCurrency(metrics.contracts.net)}</p>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <Handshake className="h-4 w-4 text-accent-foreground" />
                <span className="text-xs font-medium text-muted-foreground">Parcerias</span>
              </div>
              <p className="text-lg font-bold">{metrics.parcerias.count}</p>
              <p className="text-xs text-muted-foreground font-mono">Bruto {formatCurrency(metrics.parcerias.gross)}</p>
              <p className="text-xs text-success font-mono">Líq. {formatCurrency(metrics.parcerias.net)}</p>
            </CardContent>
          </Card>

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

          <Card className="bg-card border-border">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="h-4 w-4 text-warning" />
                <span className="text-xs font-medium text-muted-foreground">Outside</span>
              </div>
              <p className="text-lg font-bold">{metrics.outside.count}</p>
              <p className="text-xs text-warning font-mono">Bruto {formatCurrency(metrics.outside.gross)}</p>
            </CardContent>
          </Card>

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

        {/* Comparison with previous month */}
        {(metrics.grossChange !== null || metrics.countChange !== null) && (
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

        {/* Category breakdown */}
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
                    <Badge variant="outline" className="text-xs">{cat.name}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-right">{cat.count}</TableCell>
                  <TableCell className="text-xs text-right font-mono">{formatCurrency(cat.gross)}</TableCell>
                  <TableCell className="text-xs text-right font-mono">{formatCurrency(cat.net)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
