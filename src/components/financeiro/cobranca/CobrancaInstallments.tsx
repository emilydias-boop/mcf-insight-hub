import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BillingInstallment, INSTALLMENT_STATUS_LABELS } from '@/types/billing';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { Check } from 'lucide-react';

interface CobrancaInstallmentsProps {
  installments: BillingInstallment[];
  isLoading: boolean;
  onMarkPaid?: (installment: BillingInstallment) => void;
}

const statusColors: Record<string, string> = {
  pendente: 'bg-amber-100 text-amber-800',
  pago: 'bg-green-100 text-green-800',
  atrasado: 'bg-red-100 text-red-800',
  cancelado: 'bg-gray-100 text-gray-800',
};

export const CobrancaInstallments = ({ installments, isLoading, onMarkPaid }: CobrancaInstallmentsProps) => {
  if (isLoading) return <div className="text-center py-4 text-muted-foreground">Carregando parcelas...</div>;
  if (installments.length === 0) return <div className="text-center py-4 text-muted-foreground">Nenhuma parcela cadastrada</div>;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>#</TableHead>
          <TableHead>Vencimento</TableHead>
          <TableHead className="text-right">Valor</TableHead>
          <TableHead className="text-right">Pago</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Data Pgto</TableHead>
          <TableHead></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {installments.map((inst) => (
          <TableRow key={inst.id} className={inst.status === 'atrasado' ? 'bg-red-50/50' : ''}>
            <TableCell className="font-medium">{inst.numero_parcela}</TableCell>
            <TableCell>{formatDate(inst.data_vencimento)}</TableCell>
            <TableCell className="text-right">{formatCurrency(inst.valor_original)}</TableCell>
            <TableCell className="text-right">{inst.valor_pago ? formatCurrency(inst.valor_pago) : '-'}</TableCell>
            <TableCell>
              <Badge className={`text-xs ${statusColors[inst.status] || ''}`} variant="outline">
                {INSTALLMENT_STATUS_LABELS[inst.status]}
              </Badge>
            </TableCell>
            <TableCell>{inst.data_pagamento ? formatDate(inst.data_pagamento) : '-'}</TableCell>
            <TableCell>
              {inst.status !== 'pago' && inst.status !== 'cancelado' && onMarkPaid && (
                <Button size="sm" variant="ghost" onClick={() => onMarkPaid(inst)}>
                  <Check className="h-3.5 w-3.5 mr-1" /> Pagar
                </Button>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};
