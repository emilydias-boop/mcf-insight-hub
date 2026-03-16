import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { BillingSubscription, SUBSCRIPTION_STATUS_LABELS, QUITACAO_STATUS_LABELS, PAYMENT_METHOD_LABELS } from '@/types/billing';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { Skeleton } from '@/components/ui/skeleton';

interface CobrancaTableProps {
  subscriptions: BillingSubscription[];
  isLoading: boolean;
  onSelect: (sub: BillingSubscription) => void;
}

const statusColors: Record<string, string> = {
  em_dia: 'bg-green-100 text-green-800 border-green-200',
  atrasada: 'bg-red-100 text-red-800 border-red-200',
  cancelada: 'bg-gray-100 text-gray-800 border-gray-200',
  finalizada: 'bg-blue-100 text-blue-800 border-blue-200',
  quitada: 'bg-emerald-100 text-emerald-800 border-emerald-200',
};

const quitacaoColors: Record<string, string> = {
  em_aberto: 'bg-amber-100 text-amber-800 border-amber-200',
  parcialmente_pago: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  quitado: 'bg-emerald-100 text-emerald-800 border-emerald-200',
};

export const CobrancaTable = ({ subscriptions, isLoading, onSelect }: CobrancaTableProps) => {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (subscriptions.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Nenhuma assinatura encontrada
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Cliente</TableHead>
          <TableHead>Produto</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Quitação</TableHead>
          <TableHead className="text-right">Valor Total</TableHead>
          <TableHead>Parcelas</TableHead>
          <TableHead>Pagamento</TableHead>
          <TableHead>Responsável</TableHead>
          <TableHead>Início</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {subscriptions.map((sub) => (
          <TableRow
            key={sub.id}
            className="cursor-pointer hover:bg-muted/50"
            onClick={() => onSelect(sub)}
          >
            <TableCell>
              <div>
                <div className="font-medium text-foreground">{sub.customer_name}</div>
                <div className="text-xs text-muted-foreground">{sub.customer_email}</div>
              </div>
            </TableCell>
            <TableCell className="text-sm">{sub.product_name}</TableCell>
            <TableCell>
              <Badge className={`text-xs ${statusColors[sub.status] || ''}`} variant="outline">
                {SUBSCRIPTION_STATUS_LABELS[sub.status]}
              </Badge>
            </TableCell>
            <TableCell>
              <Badge className={`text-xs ${quitacaoColors[sub.status_quitacao] || ''}`} variant="outline">
                {QUITACAO_STATUS_LABELS[sub.status_quitacao]}
              </Badge>
            </TableCell>
            <TableCell className="text-right font-medium">{formatCurrency(sub.valor_total_contrato)}</TableCell>
            <TableCell className="text-sm">{sub.total_parcelas}x</TableCell>
            <TableCell className="text-sm">{PAYMENT_METHOD_LABELS[sub.forma_pagamento]}</TableCell>
            <TableCell className="text-sm">{sub.responsavel_financeiro || '-'}</TableCell>
            <TableCell className="text-sm">{sub.data_inicio ? formatDate(sub.data_inicio) : '-'}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};
