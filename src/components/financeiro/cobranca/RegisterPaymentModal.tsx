import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BillingInstallment, PAYMENT_METHOD_LABELS } from '@/types/billing';
import { useMarkInstallmentPaid } from '@/hooks/useBillingInstallments';
import { useAddBillingHistory } from '@/hooks/useBillingHistory';
import { formatCurrency } from '@/lib/formatters';
import { toast } from 'sonner';

interface RegisterPaymentModalProps {
  installment: BillingInstallment | null;
  subscriptionId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const RegisterPaymentModal = ({ installment, subscriptionId, open, onOpenChange }: RegisterPaymentModalProps) => {
  const [valorPago, setValorPago] = useState('');
  const [dataPagamento, setDataPagamento] = useState(new Date().toISOString().split('T')[0]);
  const [formaPagamento, setFormaPagamento] = useState('');
  const [observacoes, setObservacoes] = useState('');

  const markPaid = useMarkInstallmentPaid();
  const addHistory = useAddBillingHistory();

  const handleOpen = (isOpen: boolean) => {
    if (isOpen && installment) {
      setValorPago(String(installment.valor_original));
      setDataPagamento(new Date().toISOString().split('T')[0]);
      setFormaPagamento('');
      setObservacoes('');
    }
    onOpenChange(isOpen);
  };

  const handleSubmit = async () => {
    if (!installment) return;
    const valor = parseFloat(valorPago);
    if (isNaN(valor) || valor <= 0) {
      toast.error('Informe um valor válido');
      return;
    }
    try {
      await markPaid.mutateAsync({
        id: installment.id,
        valor_pago: valor,
        data_pagamento: dataPagamento,
        forma_pagamento: formaPagamento || undefined,
      });
      await addHistory.mutateAsync({
        subscription_id: subscriptionId,
        tipo: 'parcela_paga',
        valor,
        forma_pagamento: formaPagamento as any || null,
        descricao: `Parcela ${installment.numero_parcela} — ${observacoes || 'Pagamento registrado'}`,
      });
      toast.success('Pagamento registrado');
      onOpenChange(false);
    } catch {
      toast.error('Erro ao registrar pagamento');
    }
  };

  if (!installment) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar Pagamento — Parcela {installment.numero_parcela}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">Valor original: {formatCurrency(installment.valor_original)}</p>
        <div className="space-y-4">
          <div>
            <Label>Valor Pago (R$)</Label>
            <Input type="number" step="0.01" value={valorPago} onChange={(e) => setValorPago(e.target.value)} />
          </div>
          <div>
            <Label>Data do Pagamento</Label>
            <Input type="date" value={dataPagamento} onChange={(e) => setDataPagamento(e.target.value)} />
          </div>
          <div>
            <Label>Forma de Pagamento</Label>
            <Select value={formaPagamento} onValueChange={setFormaPagamento}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {Object.entries(PAYMENT_METHOD_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Detalhes do pagamento..." />
          </div>
          <Button onClick={handleSubmit} disabled={markPaid.isPending} className="w-full">
            {markPaid.isPending ? 'Registrando...' : 'Registrar Pagamento'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
