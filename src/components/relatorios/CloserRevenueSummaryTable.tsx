import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import { getDeduplicatedGross } from '@/lib/incorporadorPricing';
import { CloserRevenueDetailDialog } from './CloserRevenueDetailDialog';

interface Closer {
  id: string;
  name: string;
}

interface AttendeeMatch {
  id: string;
  attendee_phone: string | null;
  deal_id: string | null;
  meeting_slots: { closer_id: string | null } | null;
  crm_deals: { crm_contacts: { email: string | null; phone: string | null } | null } | null;
}

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

interface CloserRevenueSummaryTableProps {
  transactions: Transaction[];
  closers: Closer[];
  attendees: AttendeeMatch[];
  globalFirstIds: Set<string>;
  isLoading?: boolean;
  startDate?: Date;
  endDate?: Date;
}

const normalizePhone = (phone: string | null | undefined): string => {
  return (phone || '').replace(/\D/g, '');
};

export function CloserRevenueSummaryTable({
  transactions,
  closers,
  attendees,
  globalFirstIds,
  isLoading,
  startDate,
  endDate,
}: CloserRevenueSummaryTableProps) {
  const [selectedCloser, setSelectedCloser] = useState<{ id: string; name: string } | null>(null);

  // Build closer contact maps and attribute transactions
  const { summaryData, closerTransactionsMap } = useMemo(() => {
    const closerContactMap = new Map<string, { emails: Set<string>; phones: Set<string> }>();
    
    for (const closer of closers) {
      const closerAttendees = attendees.filter(
        (a) => a.meeting_slots?.closer_id === closer.id
      );
      const emails = new Set<string>();
      const phones = new Set<string>();
      
      for (const a of closerAttendees) {
        const email = a.crm_deals?.crm_contacts?.email?.toLowerCase();
        if (email) emails.add(email);
        const phone = normalizePhone(a.crm_deals?.crm_contacts?.phone);
        if (phone.length >= 8) phones.add(phone);
      }
      
      closerContactMap.set(closer.id, { emails, phones });
    }
    
    const closerTotals = new Map<string, { count: number; gross: number; net: number }>();
    const txMap = new Map<string, Transaction[]>();
    let unassigned = { count: 0, gross: 0, net: 0 };
    const unassignedTxs: Transaction[] = [];
    
    for (const tx of transactions) {
      const txEmail = (tx.customer_email || '').toLowerCase();
      const txPhone = normalizePhone(tx.customer_phone);
      const isFirst = globalFirstIds.has(tx.id);
      const gross = getDeduplicatedGross(tx as any, isFirst);
      const net = tx.net_value || 0;
      
      let matched = false;
      for (const closer of closers) {
        const contacts = closerContactMap.get(closer.id);
        if (!contacts) continue;
        
        if (
          (txEmail && contacts.emails.has(txEmail)) ||
          (txPhone.length >= 8 && contacts.phones.has(txPhone))
        ) {
          const existing = closerTotals.get(closer.id) || { count: 0, gross: 0, net: 0 };
          existing.count++;
          existing.gross += gross;
          existing.net += net;
          closerTotals.set(closer.id, existing);
          
          const arr = txMap.get(closer.id) || [];
          arr.push(tx);
          txMap.set(closer.id, arr);
          
          matched = true;
          break;
        }
      }
      
      if (!matched) {
        unassigned.count++;
        unassigned.gross += gross;
        unassigned.net += net;
        unassignedTxs.push(tx);
      }
    }
    
    const rows = closers
      .map((c) => ({
        id: c.id,
        name: c.name,
        ...(closerTotals.get(c.id) || { count: 0, gross: 0, net: 0 }),
      }))
      .filter((r) => r.count > 0)
      .sort((a, b) => b.gross - a.gross);
    
    if (unassigned.count > 0) {
      rows.push({ id: '__unassigned__', name: 'Sem closer', ...unassigned });
      txMap.set('__unassigned__', unassignedTxs);
    }
    
    const totalGross = rows.reduce((s, r) => s + r.gross, 0);
    const totalNet = rows.reduce((s, r) => s + r.net, 0);
    const totalCount = rows.reduce((s, r) => s + r.count, 0);
    
    return {
      summaryData: { rows, totalGross, totalNet, totalCount },
      closerTransactionsMap: txMap,
    };
  }, [transactions, closers, attendees, globalFirstIds]);

  if (isLoading || summaryData.rows.length === 0) return null;

  const selectedTxs = selectedCloser ? (closerTransactionsMap.get(selectedCloser.id) || []) : [];

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-5 w-5" />
            Faturamento por Closer
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Closer</TableHead>
                <TableHead className="text-right">Transações</TableHead>
                <TableHead className="text-right">Faturamento Bruto</TableHead>
                <TableHead className="text-right">Receita Líquida</TableHead>
                <TableHead className="text-right">Ticket Médio</TableHead>
                <TableHead className="text-right">% do Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summaryData.rows.map((row) => (
                <TableRow key={row.name}>
                  <TableCell>
                    {row.id !== '__unassigned__' ? (
                      <button
                        className="font-medium text-left hover:underline cursor-pointer text-primary"
                        onClick={() => setSelectedCloser({ id: row.id, name: row.name })}
                      >
                        {row.name}
                      </button>
                    ) : (
                      <button
                        className="font-medium text-left hover:underline cursor-pointer text-muted-foreground"
                        onClick={() => setSelectedCloser({ id: row.id, name: row.name })}
                      >
                        {row.name}
                      </button>
                    )}
                  </TableCell>
                  <TableCell className="text-right">{row.count}</TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(row.gross)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-success">
                    {formatCurrency(row.net)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(row.count > 0 ? row.net / row.count : 0)}
                  </TableCell>
                  <TableCell className="text-right">
                    {summaryData.totalGross > 0
                      ? ((row.gross / summaryData.totalGross) * 100).toFixed(1)
                      : '0.0'}%
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="font-bold">Total</TableCell>
                <TableCell className="text-right font-bold">{summaryData.totalCount}</TableCell>
                <TableCell className="text-right font-mono font-bold">
                  {formatCurrency(summaryData.totalGross)}
                </TableCell>
                <TableCell className="text-right font-mono font-bold text-success">
                  {formatCurrency(summaryData.totalNet)}
                </TableCell>
                <TableCell className="text-right font-mono font-bold">
                  {formatCurrency(summaryData.totalCount > 0 ? summaryData.totalNet / summaryData.totalCount : 0)}
                </TableCell>
                <TableCell className="text-right font-bold">100%</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>

      {selectedCloser && (
        <CloserRevenueDetailDialog
          open={!!selectedCloser}
          onOpenChange={(open) => !open && setSelectedCloser(null)}
          closerName={selectedCloser.name}
          closerId={selectedCloser.id}
          transactions={selectedTxs}
          globalFirstIds={globalFirstIds}
          attendees={attendees}
          startDate={startDate}
          endDate={endDate}
        />
      )}
    </>
  );
}
