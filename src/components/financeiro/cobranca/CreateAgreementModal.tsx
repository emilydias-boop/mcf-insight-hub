import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useCreateAgreement } from '@/hooks/useBillingAgreements';
import { useAddBillingHistory } from '@/hooks/useBillingHistory';
import { PAYMENT_METHOD_LABELS, BillingPaymentMethod } from '@/types/billing';
import { toast } from 'sonner';
import { addMonths, format } from 'date-fns';

interface CreateAgreementModalProps {
  subscriptionId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CreateAgreementModal = ({ subscriptionId, open, onOpenChange }: CreateAgreementModalProps) => {
  const [form, setForm] = useState({
    responsavel: '',
    motivo_negociacao: '',
    valor_original_divida: 0,
    novo_valor_negociado: 0,
    quantidade_parcelas: 1,
    forma_pagamento: 'boleto' as BillingPaymentMethod,
    data_primeiro_vencimento: format(new Date(), 'yyyy-MM-dd'),
    observacoes: '',
  });

  const createAgreement = useCreateAgreement();
  const addHistory = useAddBillingHistory();

  const handleSubmit = async () => {
    if (!form.responsavel) {
      toast.error('Informe o responsável pelo acordo');
      return;
    }

    try {
      const valorParcela = form.quantidade_parcelas > 0
        ? form.novo_valor_negociado / form.quantidade_parcelas
        : 0;

      const installments = Array.from({ length: form.quantidade_parcelas }, (_, i) => ({
        numero_parcela: i + 1,
        valor: Math.round(valorParcela * 100) / 100,
        data_vencimento: format(addMonths(new Date(form.data_primeiro_vencimento), i), 'yyyy-MM-dd'),
        status: 'pendente' as const,
      }));

      await createAgreement.mutateAsync({
        agreement: {
          subscription_id: subscriptionId,
          responsavel: form.responsavel,
          data_negociacao: format(new Date(), 'yyyy-MM-dd'),
          motivo_negociacao: form.motivo_negociacao || null,
          valor_original_divida: form.valor_original_divida,
          novo_valor_negociado: form.novo_valor_negociado,
          quantidade_parcelas: form.quantidade_parcelas,
          forma_pagamento: form.forma_pagamento,
          data_primeiro_vencimento: form.data_primeiro_vencimento,
          status: 'em_andamento',
          observacoes: form.observacoes || null,
        },
        installments,
      });

      await addHistory.mutateAsync({
        subscription_id: subscriptionId,
        tipo: 'acordo_realizado',
        valor: form.novo_valor_negociado,
        responsavel: form.responsavel,
        descricao: `Acordo realizado: ${form.quantidade_parcelas}x de R$ ${(valorParcela).toFixed(2)}`,
      });

      toast.success('Acordo criado com sucesso');
      onOpenChange(false);
    } catch {
      toast.error('Erro ao criar acordo');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo Acordo / Negociação</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Responsável pelo Acordo *</Label>
            <Input value={form.responsavel} onChange={(e) => setForm({ ...form, responsavel: e.target.value })} placeholder="Ex: Bruna, Leticia" />
          </div>
          <div>
            <Label>Motivo da Negociação</Label>
            <Textarea value={form.motivo_negociacao} onChange={(e) => setForm({ ...form, motivo_negociacao: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Valor Original da Dívida</Label>
              <Input type="number" value={form.valor_original_divida} onChange={(e) => setForm({ ...form, valor_original_divida: Number(e.target.value) })} />
            </div>
            <div>
              <Label>Novo Valor Negociado</Label>
              <Input type="number" value={form.novo_valor_negociado} onChange={(e) => setForm({ ...form, novo_valor_negociado: Number(e.target.value) })} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Nº Parcelas</Label>
              <Input type="number" min={1} value={form.quantidade_parcelas} onChange={(e) => setForm({ ...form, quantidade_parcelas: Number(e.target.value) })} />
            </div>
            <div>
              <Label>Forma Pgto</Label>
              <Select value={form.forma_pagamento} onValueChange={(v) => setForm({ ...form, forma_pagamento: v as BillingPaymentMethod })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PAYMENT_METHOD_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>1º Vencimento</Label>
              <Input type="date" value={form.data_primeiro_vencimento} onChange={(e) => setForm({ ...form, data_primeiro_vencimento: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit}>Criar Acordo</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
