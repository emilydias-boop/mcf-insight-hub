import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { BillingInstallment, PAYMENT_METHOD_LABELS, PARCELED_METHODS, BillingPaymentMethod } from '@/types/billing';
import { useMarkInstallmentPaid, useUpdateInstallmentValue } from '@/hooks/useBillingInstallments';
import { useCreateReceivables } from '@/hooks/useBillingReceivables';
import { useAddBillingHistory } from '@/hooks/useBillingHistory';
import { formatCurrency } from '@/lib/formatters';
import { toast } from 'sonner';
import { addMonths, format } from 'date-fns';

interface RegisterPaymentModalProps {
  installment: BillingInstallment | null;
  subscriptionId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pendingInstallments?: BillingInstallment[];
}

export const RegisterPaymentModal = ({ installment, subscriptionId, open, onOpenChange, pendingInstallments = [] }: RegisterPaymentModalProps) => {
  const [valorPago, setValorPago] = useState('');
  const [dataPagamento, setDataPagamento] = useState(new Date().toISOString().split('T')[0]);
  const [formaPagamento, setFormaPagamento] = useState('');
  const [numParcelas, setNumParcelas] = useState('2');
  const [observacoes, setObservacoes] = useState('');

  const markPaid = useMarkInstallmentPaid();
  const createReceivables = useCreateReceivables();
  const addHistory = useAddBillingHistory();
  const updateValue = useUpdateInstallmentValue();

  const isParceled = PARCELED_METHODS.includes(formaPagamento as BillingPaymentMethod);

  const receivablePreview = useMemo(() => {
    if (!isParceled || !valorPago) return [];
    const total = parseFloat(valorPago);
    const n = parseInt(numParcelas) || 2;
    if (isNaN(total) || total <= 0) return [];
    const parcelaValor = Math.round((total / n) * 100) / 100;
    const items = [];
    for (let i = 1; i <= n; i++) {
      const date = addMonths(new Date(dataPagamento), i);
      items.push({
        numero: i,
        valor: i === n ? Math.round((total - parcelaValor * (n - 1)) * 100) / 100 : parcelaValor,
        data_prevista: format(date, 'yyyy-MM-dd'),
      });
    }
    return items;
  }, [isParceled, valorPago, numParcelas, dataPagamento]);

  // Saldo: difference between original and paid
  const saldoDiferenca = useMemo(() => {
    if (!installment) return 0;
    const valor = parseFloat(valorPago) || 0;
    return installment.valor_original - valor;
  }, [installment, valorPago]);

  const futureInstallments = useMemo(() => {
    if (!installment) return [];
    return pendingInstallments.filter(
      i => i.id !== installment.id && (i.status === 'pendente' || i.status === 'atrasado')
    );
  }, [installment, pendingInstallments]);

  const handleOpen = (isOpen: boolean) => {
    if (isOpen && installment) {
      setValorPago(String(installment.valor_original));
      setDataPagamento(new Date().toISOString().split('T')[0]);
      setFormaPagamento('');
      setNumParcelas('2');
      setObservacoes('');
    }
    onOpenChange(isOpen);
  };

  const handleRedistribute = async () => {
    if (!installment || saldoDiferenca <= 0 || futureInstallments.length === 0) return;
    const adicionalPorParcela = Math.round((saldoDiferenca / futureInstallments.length) * 100) / 100;
    try {
      for (let i = 0; i < futureInstallments.length; i++) {
        const fi = futureInstallments[i];
        const extra = i === futureInstallments.length - 1
          ? Math.round((saldoDiferenca - adicionalPorParcela * (futureInstallments.length - 1)) * 100) / 100
          : adicionalPorParcela;
        await updateValue.mutateAsync({
          id: fi.id,
          valor_original: fi.valor_original + extra,
        });
      }
      toast.success(`Saldo de ${formatCurrency(saldoDiferenca)} redistribuído em ${futureInstallments.length} parcelas`);
    } catch {
      toast.error('Erro ao redistribuir saldo');
    }
  };

  const handleSubmit = async () => {
    if (!installment) return;
    const valor = parseFloat(valorPago);
    if (isNaN(valor) || valor <= 0) {
      toast.error('Informe um valor válido');
      return;
    }
    try {
      // 1. Mark installment as paid
      await markPaid.mutateAsync({
        id: installment.id,
        valor_pago: valor,
        data_pagamento: dataPagamento,
        forma_pagamento: formaPagamento || undefined,
      });

      // 2. Create receivables if parceled
      if (isParceled && receivablePreview.length > 0) {
        await createReceivables.mutateAsync(
          receivablePreview.map(r => ({
            installment_id: installment.id,
            numero: r.numero,
            valor: r.valor,
            data_prevista: r.data_prevista,
            forma_pagamento: formaPagamento as BillingPaymentMethod,
            status: 'pendente',
          }))
        );
      }

      // 3. Add history
      const parceladoLabel = isParceled ? ` (${numParcelas}x ${PAYMENT_METHOD_LABELS[formaPagamento as BillingPaymentMethod] || formaPagamento})` : '';
      await addHistory.mutateAsync({
        subscription_id: subscriptionId,
        tipo: 'parcela_paga',
        valor,
        forma_pagamento: formaPagamento as any || null,
        descricao: `Parcela ${installment.numero_parcela}${parceladoLabel} — ${observacoes || 'Pagamento registrado'}`,
      });

      // 4. Redistribute if partial payment
      if (saldoDiferenca > 0 && futureInstallments.length > 0) {
        await handleRedistribute();
      }

      toast.success('Pagamento registrado');
      onOpenChange(false);
    } catch {
      toast.error('Erro ao registrar pagamento');
    }
  };

  if (!installment) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
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

          {isParceled && (
            <>
              <Separator />
              <div>
                <Label>Em quantas vezes?</Label>
                <Input
                  type="number"
                  min="2"
                  max="48"
                  value={numParcelas}
                  onChange={(e) => setNumParcelas(e.target.value)}
                />
              </div>
              {receivablePreview.length > 0 && (
                <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Sub-parcelas de recebimento:</p>
                  {receivablePreview.map(r => (
                    <div key={r.numero} className="flex justify-between text-sm">
                      <span>{r.numero}ª — {format(new Date(r.data_prevista + 'T12:00:00'), 'dd/MM/yyyy')}</span>
                      <span className="font-medium">{formatCurrency(r.valor)}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {saldoDiferenca > 0 && (
            <>
              <Separator />
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
                <p className="text-sm font-medium text-amber-800">
                  Saldo restante: {formatCurrency(saldoDiferenca)}
                </p>
                {futureInstallments.length > 0 ? (
                  <p className="text-xs text-amber-700">
                    Ao confirmar, o saldo será redistribuído em {futureInstallments.length} parcela(s) futura(s) automaticamente.
                  </p>
                ) : (
                  <p className="text-xs text-amber-700">
                    Não há parcelas futuras para redistribuir. O saldo ficará em aberto.
                  </p>
                )}
              </div>
            </>
          )}

          {saldoDiferenca < 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-sm text-green-800">
                Pagamento excedente: {formatCurrency(Math.abs(saldoDiferenca))}
              </p>
            </div>
          )}

          <div>
            <Label>Observações</Label>
            <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Detalhes do pagamento..." />
          </div>

          <Button onClick={handleSubmit} disabled={markPaid.isPending || createReceivables.isPending} className="w-full">
            {markPaid.isPending ? 'Registrando...' : 'Registrar Pagamento'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
