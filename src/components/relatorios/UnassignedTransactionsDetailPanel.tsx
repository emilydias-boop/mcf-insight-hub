import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Search, Mail, Phone, HelpCircle, Link2, XCircle, UserCheck } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { getDeduplicatedGross } from '@/lib/incorporadorPricing';
import { useUnassignedTransactionsDiagnosis, type DiagnosisReason, type TransactionDiagnosis } from '@/hooks/useUnassignedTransactionsDiagnosis';
import { useLinkTransactionToAttendee } from '@/hooks/useLinkTransactionToAttendee';

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
  meeting_slots: { closer_id: string | null } | null;
  crm_deals: { crm_contacts: { email: string | null; phone: string | null } | null } | null;
}

interface UnassignedTransactionsDetailPanelProps {
  transactions: Transaction[];
  globalFirstIds: Set<string>;
  attendees: AttendeeMatch[];
  closers: { id: string; name: string }[];
}

const REASON_LABELS: Record<DiagnosisReason, { label: string; color: string; icon: React.ReactNode }> = {
  both_missing: { label: 'Sem dados', color: 'bg-destructive/15 text-destructive border-destructive/30', icon: <XCircle className="h-3 w-3" /> },
  missing_email: { label: 'Sem email', color: 'bg-orange-500/15 text-orange-600 border-orange-500/30', icon: <Mail className="h-3 w-3" /> },
  missing_phone: { label: 'Sem telefone', color: 'bg-orange-500/15 text-orange-600 border-orange-500/30', icon: <Phone className="h-3 w-3" /> },
  no_match: { label: 'Sem match', color: 'bg-blue-500/15 text-blue-600 border-blue-500/30', icon: <HelpCircle className="h-3 w-3" /> },
};

export function UnassignedTransactionsDetailPanel({
  transactions,
  globalFirstIds,
  attendees,
  closers,
}: UnassignedTransactionsDetailPanelProps) {
  const [search, setSearch] = useState('');
  const [filterReason, setFilterReason] = useState<DiagnosisReason | 'all'>('all');
  const [selectedTx, setSelectedTx] = useState<TransactionDiagnosis | null>(null);

  const { diagnosed, summary } = useUnassignedTransactionsDiagnosis(transactions, attendees, closers);
  const linkMutation = useLinkTransactionToAttendee();

  const totalGross = useMemo(
    () => transactions.reduce((s, t) => s + getDeduplicatedGross(t as any, globalFirstIds.has(t.id)), 0),
    [transactions, globalFirstIds]
  );

  const filtered = useMemo(() => {
    let items = diagnosed;
    if (filterReason !== 'all') {
      items = items.filter(d => d.reason === filterReason);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(d =>
        (d.transaction.customer_email || '').toLowerCase().includes(q) ||
        (d.transaction.customer_phone || '').includes(q) ||
        (d.transaction.product_name || '').toLowerCase().includes(q)
      );
    }
    return items;
  }, [diagnosed, filterReason, search]);

  const pctMissing = summary.total > 0
    ? (((summary.bothMissing + summary.missingEmail + summary.missingPhone) / summary.total) * 100).toFixed(1)
    : '0';
  const pctNoMatch = summary.total > 0
    ? ((summary.noMatch / summary.total) * 100).toFixed(1)
    : '0';

  const handleManualLink = (txId: string, attendeeId: string) => {
    linkMutation.mutate({ transactionId: txId, attendeeId });
    setSelectedTx(null);
  };

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="bg-card border-border">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-lg font-bold">{summary.total}</p>
            <p className="text-xs font-mono text-muted-foreground">{formatCurrency(totalGross)}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-3">
            <div className="flex items-center gap-1">
              <XCircle className="h-3 w-3 text-destructive" />
              <p className="text-xs text-muted-foreground">Dados faltando</p>
            </div>
            <p className="text-lg font-bold">{summary.bothMissing + summary.missingEmail + summary.missingPhone}</p>
            <p className="text-xs text-destructive">{pctMissing}% do total</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-3">
            <div className="flex items-center gap-1">
              <HelpCircle className="h-3 w-3 text-blue-500" />
              <p className="text-xs text-muted-foreground">Com dados, sem match</p>
            </div>
            <p className="text-lg font-bold">{summary.noMatch}</p>
            <p className="text-xs text-blue-500">{pctNoMatch}% do total</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-3">
            <div className="flex items-center gap-1">
              <UserCheck className="h-3 w-3 text-success" />
              <p className="text-xs text-muted-foreground">Existe no CRM</p>
            </div>
            <p className="text-lg font-bold">{summary.contactExistsCount}</p>
            <p className="text-xs text-success">Possível match manual</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por email, telefone ou produto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <Badge
            variant={filterReason === 'all' ? 'default' : 'outline'}
            className="cursor-pointer text-xs"
            onClick={() => setFilterReason('all')}
          >
            Todos ({summary.total})
          </Badge>
          <Badge
            variant={filterReason === 'both_missing' ? 'default' : 'outline'}
            className="cursor-pointer text-xs"
            onClick={() => setFilterReason('both_missing')}
          >
            Sem dados ({summary.bothMissing})
          </Badge>
          <Badge
            variant={filterReason === 'missing_email' ? 'default' : 'outline'}
            className="cursor-pointer text-xs"
            onClick={() => setFilterReason('missing_email')}
          >
            Sem email ({summary.missingEmail})
          </Badge>
          <Badge
            variant={filterReason === 'missing_phone' ? 'default' : 'outline'}
            className="cursor-pointer text-xs"
            onClick={() => setFilterReason('missing_phone')}
          >
            Sem tel ({summary.missingPhone})
          </Badge>
          <Badge
            variant={filterReason === 'no_match' ? 'default' : 'outline'}
            className="cursor-pointer text-xs"
            onClick={() => setFilterReason('no_match')}
          >
            Sem match ({summary.noMatch})
          </Badge>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="max-h-[40vh] overflow-y-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Motivo</TableHead>
              <TableHead className="text-xs">Email</TableHead>
              <TableHead className="text-xs">Telefone</TableHead>
              <TableHead className="text-xs">Produto</TableHead>
              <TableHead className="text-xs text-right">Bruto</TableHead>
              <TableHead className="text-xs text-right">Data</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.slice(0, 100).map((d) => {
              const gross = getDeduplicatedGross(d.transaction as any, globalFirstIds.has(d.transaction.id));
              const reasonInfo = REASON_LABELS[d.reason];
              return (
                <TableRow
                  key={d.transaction.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => setSelectedTx(d)}
                >
                  <TableCell>
                    <Badge variant="outline" className={`text-[10px] gap-1 ${reasonInfo.color}`}>
                      {reasonInfo.icon}
                      {reasonInfo.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs max-w-[140px] truncate">
                    {d.transaction.customer_email || (
                      <span className="text-destructive italic">vazio</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">
                    {d.transaction.customer_phone || (
                      <span className="text-destructive italic">vazio</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs max-w-[120px] truncate">
                    {d.transaction.product_name}
                  </TableCell>
                  <TableCell className="text-xs text-right font-mono">
                    {formatCurrency(gross)}
                  </TableCell>
                  <TableCell className="text-xs text-right">
                    {d.transaction.sale_date ? formatDate(d.transaction.sale_date) : '-'}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {filtered.length > 100 && (
          <p className="text-xs text-muted-foreground text-center py-2">
            Mostrando 100 de {filtered.length} transações
          </p>
        )}
      </div>

      {/* Transaction Detail Drawer */}
      <Drawer open={!!selectedTx} onOpenChange={(open) => !open && setSelectedTx(null)}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle className="text-base">Detalhe da Transação</DrawerTitle>
            <DrawerDescription>Dados brutos e diagnóstico</DrawerDescription>
          </DrawerHeader>
          {selectedTx && (
            <div className="px-4 pb-4 space-y-4">
              {/* Raw Data */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="font-mono text-xs break-all">
                    {selectedTx.transaction.customer_email || <span className="text-destructive">vazio</span>}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Telefone</p>
                  <p className="font-mono text-xs">
                    {selectedTx.transaction.customer_phone || <span className="text-destructive">vazio</span>}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Produto</p>
                  <p className="text-xs">{selectedTx.transaction.product_name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Categoria</p>
                  <Badge variant="outline" className="text-xs">{selectedTx.transaction.product_category || '-'}</Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Valor Bruto</p>
                  <p className="font-mono text-xs font-bold">
                    {formatCurrency(getDeduplicatedGross(selectedTx.transaction as any, globalFirstIds.has(selectedTx.transaction.id)))}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Valor Líquido</p>
                  <p className="font-mono text-xs text-success">{formatCurrency(selectedTx.transaction.net_value || 0)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Badge variant="outline" className="text-xs">{selectedTx.transaction.sale_status || '-'}</Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Data</p>
                  <p className="text-xs">{selectedTx.transaction.sale_date ? formatDate(selectedTx.transaction.sale_date) : '-'}</p>
                </div>
              </div>

              {/* Diagnosis */}
              <Card className="bg-muted/30 border-border">
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-warning" />
                    <p className="text-sm font-medium">Diagnóstico</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={`text-xs gap-1 ${REASON_LABELS[selectedTx.reason].color}`}>
                      {REASON_LABELS[selectedTx.reason].icon}
                      {REASON_LABELS[selectedTx.reason].label}
                    </Badge>
                    {selectedTx.contactExistsInCRM && (
                      <Badge variant="outline" className="text-xs gap-1 bg-success/15 text-success border-success/30">
                        <UserCheck className="h-3 w-3" />
                        Existe no CRM
                      </Badge>
                    )}
                  </div>
                  {selectedTx.suggestedCloserName && (
                    <p className="text-xs text-muted-foreground">
                      💡 Sugestão: <span className="font-medium text-foreground">{selectedTx.suggestedCloserName}</span> (encontrado no CRM)
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Manual link - find matching attendee */}
              {selectedTx.suggestedCloserName && (
                <div className="space-y-2">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <Link2 className="h-4 w-4" />
                    Vincular Manualmente
                  </p>
                  {(() => {
                    const txEmail = (selectedTx.transaction.customer_email || '').toLowerCase();
                    const txPhone = (selectedTx.transaction.customer_phone || '').replace(/\D/g, '');
                    const matchingAttendee = attendees.find(a => {
                      const aEmail = a.crm_deals?.crm_contacts?.email?.toLowerCase();
                      const aPhone = (a.crm_deals?.crm_contacts?.phone || '').replace(/\D/g, '');
                      return (txEmail && aEmail === txEmail) || (txPhone.length >= 8 && aPhone.includes(txPhone.slice(-9)));
                    });
                    if (!matchingAttendee) return null;
                    return (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        disabled={linkMutation.isPending}
                        onClick={() => handleManualLink(selectedTx.transaction.id, matchingAttendee.id)}
                      >
                        Vincular a {selectedTx.suggestedCloserName}
                      </Button>
                    );
                  })()}
                </div>
              )}
            </div>
          )}
          <DrawerFooter>
            <DrawerClose asChild>
              <Button variant="outline" size="sm">Fechar</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
