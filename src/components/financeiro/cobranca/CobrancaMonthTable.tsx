import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { MonthInstallmentRow } from '@/hooks/useBillingMonthInstallments';
import { useUpdateInstallmentStatus } from '@/hooks/useUpdateInstallmentStatus';
import { INSTALLMENT_STATUS_LABELS, PAYMENT_METHOD_LABELS, BillingPaymentMethod, BillingInstallmentStatus } from '@/types/billing';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { Phone, MoreVertical, Undo2, Send, Link2, Check } from 'lucide-react';
import { toast } from 'sonner';

const statusColors: Record<string, string> = {
  pendente: 'bg-yellow-100 text-yellow-800',
  pago: 'bg-green-100 text-green-800',
  atrasado: 'bg-red-100 text-red-800',
  cancelado: 'bg-muted text-muted-foreground',
  reembolso: 'bg-purple-100 text-purple-800',
  nao_sera_pago: 'bg-gray-200 text-gray-600',
};

interface Props {
  rows: MonthInstallmentRow[];
  isLoading: boolean;
  onSelectSubscription?: (subscriptionId: string) => void;
}

export const CobrancaMonthTable = ({ rows, isLoading, onSelectSubscription }: Props) => {
  const updateStatus = useUpdateInstallmentStatus();
  const [motivoDialog, setMotivoDialog] = useState<{ id: string; status: string } | null>(null);
  const [motivo, setMotivo] = useState('');

  const handleStatusChange = async (id: string, status: string, needsMotivo = false) => {
    if (needsMotivo) {
      setMotivoDialog({ id, status });
      return;
    }
    try {
      await updateStatus.mutateAsync({ id, status });
      toast.success(`Status atualizado para ${INSTALLMENT_STATUS_LABELS[status as BillingInstallmentStatus] || status}`);
    } catch {
      toast.error('Erro ao atualizar status');
    }
  };

  const confirmMotivo = async () => {
    if (!motivoDialog) return;
    try {
      await updateStatus.mutateAsync({ id: motivoDialog.id, status: motivoDialog.status, exclusao_motivo: motivo });
      toast.success('Status atualizado');
      setMotivoDialog(null);
      setMotivo('');
    } catch {
      toast.error('Erro ao atualizar');
    }
  };

  if (isLoading) {
    return <div className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>;
  }

  if (rows.length === 0) {
    return <div className="text-center py-8 text-muted-foreground">Nenhuma parcela encontrada para este período</div>;
  }

  return (
    <>
      <div className="overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Produto</TableHead>
              <TableHead className="text-center">Parcela</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="text-right">Saldo Mês</TableHead>
              <TableHead className="text-center">Vencimento</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead>Entrada</TableHead>
              <TableHead>Pagamento</TableHead>
              <TableHead className="text-center">Link</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const formaPgtoSub = row.forma_pagamento_sub ? (PAYMENT_METHOD_LABELS[row.forma_pagamento_sub as BillingPaymentMethod] || row.forma_pagamento_sub) : '—';
              const formaPgtoInst = row.forma_pagamento_inst ? (PAYMENT_METHOD_LABELS[row.forma_pagamento_inst as BillingPaymentMethod] || row.forma_pagamento_inst) : '—';
              const isAssinatura = row.forma_pagamento_sub === 'pix' || row.forma_pagamento_sub === 'credit_card';

              return (
                <TableRow
                  key={row.installment_id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => onSelectSubscription?.(row.subscription_id)}
                >
                  <TableCell>
                    <div className="font-medium text-sm">{row.customer_name}</div>
                    {row.customer_phone && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        {row.customer_phone}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{row.product_name}</TableCell>
                  <TableCell className="text-center text-sm">{row.numero_parcela}/{row.total_parcelas}</TableCell>
                  <TableCell className="text-right text-sm font-medium">{formatCurrency(row.valor_original)}</TableCell>
                  <TableCell className="text-right text-sm">
                    <span className={row.saldo_devedor_mes > 0 ? 'text-red-600 font-medium' : 'text-green-600'}>
                      {formatCurrency(row.saldo_devedor_mes)}
                    </span>
                  </TableCell>
                  <TableCell className="text-center text-sm">{formatDate(row.data_vencimento)}</TableCell>
                  <TableCell className="text-center">
                    <Badge className={`text-xs ${statusColors[row.status] || ''}`} variant="outline">
                      {INSTALLMENT_STATUS_LABELS[row.status as BillingInstallmentStatus] || row.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {row.valor_entrada > 0 ? (
                      <div>
                        <span className="font-medium">{formatCurrency(row.valor_entrada)}</span>
                        <div className="text-xs text-muted-foreground">{formaPgtoSub}</div>
                      </div>
                    ) : '—'}
                  </TableCell>
                  <TableCell className="text-sm">
                    {row.total_parcelas > 1 ? (
                      <div>
                        <span>{row.total_parcelas}x</span>
                        <div className="text-xs text-muted-foreground">{formaPgtoSub}</div>
                      </div>
                    ) : formaPgtoInst}
                  </TableCell>
                  <TableCell className="text-center" onClick={e => e.stopPropagation()}>
                    {isAssinatura && (
                      row.link_assinatura_enviado ? (
                        <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                          <Check className="h-3 w-3 mr-0.5" /> Enviado
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                          Pendente
                        </Badge>
                      )
                    )}
                  </TableCell>
                  <TableCell onClick={e => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {row.status !== 'reembolso' && (
                          <DropdownMenuItem onClick={() => handleStatusChange(row.installment_id, 'reembolso', true)}>
                            <Undo2 className="h-3.5 w-3.5 mr-2" /> Marcar como Reembolso
                          </DropdownMenuItem>
                        )}
                        {row.status !== 'nao_sera_pago' && (
                          <DropdownMenuItem onClick={() => handleStatusChange(row.installment_id, 'nao_sera_pago', true)}>
                            Marcar como Não será pago
                          </DropdownMenuItem>
                        )}
                        {(row.status === 'reembolso' || row.status === 'nao_sera_pago') && (
                          <DropdownMenuItem onClick={() => handleStatusChange(row.installment_id, 'pendente')}>
                            Reverter para Pendente
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!motivoDialog} onOpenChange={() => { setMotivoDialog(null); setMotivo(''); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Motivo da exclusão</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Informe o motivo..."
            value={motivo}
            onChange={e => setMotivo(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && confirmMotivo()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setMotivoDialog(null); setMotivo(''); }}>Cancelar</Button>
            <Button onClick={confirmMotivo} disabled={updateStatus.isPending}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
