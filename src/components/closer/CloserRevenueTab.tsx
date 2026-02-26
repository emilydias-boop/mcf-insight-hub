import { useMemo, useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Search, X } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DollarSign, ShoppingCart, TrendingUp, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useTransactionsByBU } from '@/hooks/useTransactionsByBU';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/formatters';
import { getDeduplicatedGross } from '@/lib/incorporadorPricing';

interface CloserRevenueTabProps {
  closerId: string;
  startDate: Date;
  endDate: Date;
}

const normalizePhone = (phone: string | null | undefined): string => {
  return (phone || '').replace(/\D/g, '');
};

export function CloserRevenueTab({ closerId, startDate, endDate }: CloserRevenueTabProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [searchTx, setSearchTx] = useState('');

  const filters = useMemo(() => ({
    startDate,
    endDate,
  }), [startDate, endDate]);

  const { data: transactions = [], isLoading: txLoading } = useTransactionsByBU('incorporador', filters);

  // Global first IDs for deduplication
  const { data: globalFirstIds = new Set<string>() } = useQuery({
    queryKey: ['global-first-transaction-ids'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_first_transaction_ids');
      if (error) throw error;
      return new Set((data || []).map((r: { id: string }) => r.id));
    },
    staleTime: 1000 * 60 * 5,
  });

  // Attendees for this closer
  const { data: attendees = [], isLoading: attLoading } = useQuery({
    queryKey: ['closer-revenue-attendees', closerId, startDate.toISOString(), endDate.toISOString()],
    queryFn: async () => {
      const endDateMax = new Date(endDate);
      endDateMax.setHours(23, 59, 59, 999);

      const { data, error } = await supabase
        .from('meeting_slot_attendees')
        .select(`
          id, attendee_phone, deal_id,
          meeting_slots!inner(closer_id),
          crm_deals!deal_id(crm_contacts!contact_id(email, phone))
        `)
        .eq('status', 'contract_paid')
        .eq('meeting_slots.closer_id', closerId)
        .gte('contract_paid_at', startDate.toISOString())
        .lte('contract_paid_at', endDateMax.toISOString());

      if (error) throw error;
      return data || [];
    },
    enabled: !!closerId,
  });

  // Match transactions to this closer
  const closerTransactions = useMemo(() => {
    if (!attendees.length || !transactions.length) return [];

    const emails = new Set<string>();
    const phones = new Set<string>();

    for (const a of attendees as any[]) {
      const email = a.crm_deals?.crm_contacts?.email?.toLowerCase();
      if (email) emails.add(email);
      const phone = normalizePhone(a.crm_deals?.crm_contacts?.phone);
      if (phone.length >= 8) phones.add(phone);
    }

    return transactions.filter((tx) => {
      const txEmail = (tx.customer_email || '').toLowerCase();
      const txPhone = normalizePhone(tx.customer_phone);
      return (
        (txEmail && emails.has(txEmail)) ||
        (txPhone.length >= 8 && phones.has(txPhone))
      );
    });
  }, [transactions, attendees]);

  // Apply text search filter
  const filteredTransactions = useMemo(() => {
    if (!searchTx.trim()) return closerTransactions;
    const q = searchTx.toLowerCase().trim();
    return closerTransactions.filter((tx: any) =>
      (tx.customer_name || '').toLowerCase().includes(q) ||
      (tx.customer_email || '').toLowerCase().includes(q) ||
      (tx.customer_phone || '').includes(q) ||
      (tx.product_name || '').toLowerCase().includes(q)
    );
  }, [closerTransactions, searchTx]);

  const stats = useMemo(() => {
    const totalGross = filteredTransactions.reduce((sum, t) => {
      const isFirst = globalFirstIds.has(t.id);
      return sum + getDeduplicatedGross(t, isFirst);
    }, 0);
    const totalNet = filteredTransactions.reduce((sum, t) => sum + (t.net_value || 0), 0);
    const count = filteredTransactions.length;
    const avgTicket = count > 0 ? totalNet / count : 0;
    return { totalGross, totalNet, count, avgTicket };
  }, [filteredTransactions, globalFirstIds]);

  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
  const paginatedTx = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredTransactions.slice(start, start + itemsPerPage);
  }, [filteredTransactions, currentPage, itemsPerPage]);

  const isLoading = txLoading || attLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-primary/10">
                <ShoppingCart className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Transações</p>
                <p className="text-3xl font-bold">{stats.count}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-success/10">
                <DollarSign className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Faturamento Bruto</p>
                <p className="text-2xl font-bold">{formatCurrency(stats.totalGross)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-warning/10">
                <DollarSign className="h-6 w-6 text-warning" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Receita Líquida</p>
                <p className="text-2xl font-bold">{formatCurrency(stats.totalNet)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-muted">
                <TrendingUp className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Ticket Médio</p>
                <p className="text-2xl font-bold">{formatCurrency(stats.avgTicket)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search + Transaction Table */}
      <Card>
        <CardContent className="p-4">
          {/* Search bar */}
          <div className="mb-4">
            <div className="relative max-w-[320px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar nome, email, produto..."
                value={searchTx}
                onChange={(e) => { setSearchTx(e.target.value); setCurrentPage(1); }}
                className="pl-9 h-9"
              />
            </div>
          </div>

          {filteredTransactions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {searchTx ? 'Nenhuma transação encontrada para a busca.' : 'Nenhuma transação atribuída a este closer no período.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="text-right">Bruto</TableHead>
                    <TableHead className="text-right">Líquido</TableHead>
                    <TableHead>Parcela</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedTx.map((row: any, idx: number) => (
                    <TableRow key={row.id || idx}>
                      <TableCell>
                        {row.sale_date
                          ? format(parseISO(row.sale_date), 'dd/MM/yyyy', { locale: ptBR })
                          : '-'}
                      </TableCell>
                      <TableCell className="font-medium max-w-[200px] truncate">
                        {row.product_name || '-'}
                      </TableCell>
                      <TableCell>{row.customer_name || '-'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {row.customer_email || '-'}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(getDeduplicatedGross(row, globalFirstIds.has(row.id)))}
                      </TableCell>
                      <TableCell className="text-right font-mono text-success">
                        {formatCurrency(row.net_value || 0)}
                      </TableCell>
                      <TableCell>
                        {row.installment_number
                          ? `${row.installment_number}/${row.total_installments}`
                          : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={row.sale_status === 'paid' ? 'default' : 'secondary'}>
                          {row.sale_status || '-'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {totalPages > 1 && (
                <div className="flex items-center justify-between py-4 border-t">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Mostrar</span>
                    <Select value={String(itemsPerPage)} onValueChange={(v) => { setItemsPerPage(Number(v)); setCurrentPage(1); }}>
                      <SelectTrigger className="w-[80px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[25, 50, 100].map((s) => (
                          <SelectItem key={s} value={String(s)}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span className="text-sm text-muted-foreground">
                      {Math.min((currentPage - 1) * itemsPerPage + 1, filteredTransactions.length)}–
                      {Math.min(currentPage * itemsPerPage, filteredTransactions.length)} de {filteredTransactions.length}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="icon" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="px-3 text-sm">Página {currentPage} de {totalPages}</span>
                    <Button variant="outline" size="icon" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
