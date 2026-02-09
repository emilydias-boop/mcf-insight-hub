import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import { getDeduplicatedGross } from '@/lib/incorporadorPricing';

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
  product_price: number | null;
  net_value: number | null;
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
}: CloserRevenueSummaryTableProps) {
  const summaryData = useMemo(() => {
    // Build closer email/phone sets per closer
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
    
    // Attribute each transaction to a closer
    const closerTotals = new Map<string, { count: number; gross: number; net: number }>();
    let unassigned = { count: 0, gross: 0, net: 0 };
    
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
          matched = true;
          break;
        }
      }
      
      if (!matched) {
        unassigned.count++;
        unassigned.gross += gross;
        unassigned.net += net;
      }
    }
    
    // Build rows sorted by gross desc
    const rows = closers
      .map((c) => ({
        name: c.name,
        ...(closerTotals.get(c.id) || { count: 0, gross: 0, net: 0 }),
      }))
      .filter((r) => r.count > 0)
      .sort((a, b) => b.gross - a.gross);
    
    if (unassigned.count > 0) {
      rows.push({ name: 'Sem closer', ...unassigned });
    }
    
    const totalGross = rows.reduce((s, r) => s + r.gross, 0);
    const totalNet = rows.reduce((s, r) => s + r.net, 0);
    const totalCount = rows.reduce((s, r) => s + r.count, 0);
    
    return { rows, totalGross, totalNet, totalCount };
  }, [transactions, closers, attendees, globalFirstIds]);

  if (isLoading || summaryData.rows.length === 0) return null;

  return (
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
                <TableCell className="font-medium">{row.name}</TableCell>
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
  );
}
