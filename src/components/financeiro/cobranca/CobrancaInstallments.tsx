import React, { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BillingInstallment, BillingPaymentReceivable, INSTALLMENT_STATUS_LABELS, PAYMENT_METHOD_LABELS, BillingPaymentMethod } from '@/types/billing';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { Check, DollarSign, ChevronDown, ChevronRight, Pencil, Save, X, Layers } from 'lucide-react';
import { useUpdateInstallmentValue } from '@/hooks/useBillingInstallments';
import { useMarkReceivableReceived } from '@/hooks/useBillingReceivables';
import { toast } from 'sonner';

interface CobrancaInstallmentsProps {
  installments: BillingInstallment[];
  isLoading: boolean;
  onMarkPaid?: (installment: BillingInstallment) => void;
  onRegisterPayment?: (installment: BillingInstallment) => void;
  receivablesMap?: Record<string, BillingPaymentReceivable[]>;
}

const statusColors: Record<string, string> = {
  pendente: 'bg-amber-100 text-amber-800',
  pago: 'bg-green-100 text-green-800',
  atrasado: 'bg-red-100 text-red-800',
  cancelado: 'bg-gray-100 text-gray-800',
};

export const CobrancaInstallments = ({ installments, isLoading, onMarkPaid, onRegisterPayment, receivablesMap = {} }: CobrancaInstallmentsProps) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const updateValue = useUpdateInstallmentValue();
  const markReceived = useMarkReceivableReceived();

  if (isLoading) return <div className="text-center py-4 text-muted-foreground">Carregando parcelas...</div>;
  if (installments.length === 0) return <div className="text-center py-4 text-muted-foreground">Nenhuma parcela cadastrada</div>;

  const handleStartEdit = (inst: BillingInstallment) => {
    setEditingId(inst.id);
    setEditValue(String(inst.valor_original));
  };

  const handleSaveEdit = async (inst: BillingInstallment) => {
    const newVal = parseFloat(editValue);
    if (isNaN(newVal) || newVal <= 0) {
      toast.error('Valor inválido');
      return;
    }
    try {
      await updateValue.mutateAsync({ id: inst.id, valor_original: newVal });
      toast.success(`Parcela ${inst.numero_parcela} atualizada para ${formatCurrency(newVal)}`);
      setEditingId(null);
    } catch {
      toast.error('Erro ao atualizar valor');
    }
  };

  const handleMarkReceivableReceived = async (recId: string) => {
    try {
      await markReceived.mutateAsync({ id: recId, data_recebimento: new Date().toISOString().split('T')[0] });
      toast.success('Recebível marcado como recebido');
    } catch {
      toast.error('Erro ao marcar recebível');
    }
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-8"></TableHead>
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
        {installments.map((inst) => {
          const receivables = receivablesMap[inst.id] || [];
          const hasReceivables = receivables.length > 0;
          const isExpanded = expandedId === inst.id;
          const isEditing = editingId === inst.id;

          return (
            <React.Fragment key={inst.id}>
              <TableRow className={inst.status === 'atrasado' ? 'bg-red-50/50' : ''}>
                <TableCell className="w-8 px-1">
                  {hasReceivables && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => setExpandedId(isExpanded ? null : inst.id)}
                    >
                      {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                    </Button>
                  )}
                </TableCell>
                <TableCell className="font-medium">
                  {inst.numero_parcela}
                  {hasReceivables && <Layers className="inline h-3 w-3 ml-1 text-muted-foreground" />}
                </TableCell>
                <TableCell>{formatDate(inst.data_vencimento)}</TableCell>
                <TableCell className="text-right">
                  {isEditing ? (
                    <div className="flex items-center gap-1 justify-end">
                      <Input
                        type="number"
                        step="0.01"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="w-24 h-7 text-sm"
                      />
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleSaveEdit(inst)}>
                        <Save className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setEditingId(null)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <span className="inline-flex items-center gap-1">
                      {formatCurrency(inst.valor_original)}
                      {(inst.status === 'pendente' || inst.status === 'atrasado') && (
                        <Button variant="ghost" size="sm" className="h-5 w-5 p-0 opacity-50 hover:opacity-100" onClick={() => handleStartEdit(inst)}>
                          <Pencil className="h-2.5 w-2.5" />
                        </Button>
                      )}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right">{inst.valor_pago ? formatCurrency(inst.valor_pago) : '-'}</TableCell>
                <TableCell>
                  <Badge className={`text-xs ${statusColors[inst.status] || ''}`} variant="outline">
                    {INSTALLMENT_STATUS_LABELS[inst.status]}
                  </Badge>
                </TableCell>
                <TableCell>{inst.data_pagamento ? formatDate(inst.data_pagamento) : '-'}</TableCell>
                <TableCell>
                  {inst.status !== 'pago' && inst.status !== 'cancelado' && (
                    <div className="flex gap-1">
                      {onMarkPaid && (
                        <Button size="sm" variant="ghost" onClick={() => onMarkPaid(inst)} title="Marcar como paga (valor cheio)">
                          <Check className="h-3.5 w-3.5 mr-1" /> Pagar
                        </Button>
                      )}
                      {onRegisterPayment && (
                        <Button size="sm" variant="ghost" onClick={() => onRegisterPayment(inst)} title="Registrar pagamento com detalhes">
                          <DollarSign className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  )}
                </TableCell>
              </TableRow>
              {isExpanded && receivables.map((rec) => (
                <TableRow key={rec.id} className="bg-muted/30">
                  <TableCell></TableCell>
                  <TableCell className="text-xs text-muted-foreground pl-6">↳ {rec.numero}ª</TableCell>
                  <TableCell className="text-xs">{formatDate(rec.data_prevista)}</TableCell>
                  <TableCell className="text-right text-xs">{formatCurrency(rec.valor)}</TableCell>
                  <TableCell className="text-right text-xs">{rec.data_recebimento ? formatDate(rec.data_recebimento) : '-'}</TableCell>
                  <TableCell>
                    <Badge className={`text-xs ${rec.status === 'recebido' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`} variant="outline">
                      {rec.status === 'recebido' ? 'Recebido' : 'Pendente'}
                    </Badge>
                  </TableCell>
                  <TableCell></TableCell>
                  <TableCell>
                    {rec.status === 'pendente' && (
                      <Button size="sm" variant="ghost" className="text-xs" onClick={() => handleMarkReceivableReceived(rec.id)}>
                        <Check className="h-3 w-3 mr-1" /> Recebido
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </React.Fragment>
          );
        })}
      </TableBody>
    </Table>
  );
};
