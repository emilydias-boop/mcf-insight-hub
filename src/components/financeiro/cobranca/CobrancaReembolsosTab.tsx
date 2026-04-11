import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { MonthInstallmentRow } from '@/hooks/useBillingMonthInstallments';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { Undo2 } from 'lucide-react';

interface Props {
  rows: MonthInstallmentRow[];
  isLoading: boolean;
}

export const CobrancaReembolsosTab = ({ rows, isLoading }: Props) => {
  const reembolsos = rows.filter(r => r.status === 'reembolso');

  if (isLoading) {
    return <div className="space-y-2 p-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>;
  }

  if (reembolsos.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Undo2 className="h-8 w-8 mx-auto mb-2 opacity-40" />
        <p>Nenhum reembolso previsto para este mês</p>
      </div>
    );
  }

  const totalReembolso = reembolsos.reduce((s, r) => s + r.valor_original, 0);

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{reembolsos.length} reembolso(s) previsto(s)</p>
        <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-sm px-3 py-1">
          Total: {formatCurrency(totalReembolso)}
        </Badge>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Cliente</TableHead>
            <TableHead>Produto</TableHead>
            <TableHead className="text-center">Parcela</TableHead>
            <TableHead className="text-right">Valor</TableHead>
            <TableHead className="text-center">Vencimento</TableHead>
            <TableHead>Motivo</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {reembolsos.map(row => (
            <TableRow key={row.installment_id}>
              <TableCell className="font-medium text-sm">{row.customer_name}</TableCell>
              <TableCell className="text-sm">{row.product_name}</TableCell>
              <TableCell className="text-center text-sm">{row.numero_parcela}/{row.total_parcelas}</TableCell>
              <TableCell className="text-right text-sm font-medium text-purple-700">{formatCurrency(row.valor_original)}</TableCell>
              <TableCell className="text-center text-sm">{formatDate(row.data_vencimento)}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{row.exclusao_motivo || '—'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
