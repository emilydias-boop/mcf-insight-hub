import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useCreateSubscription } from '@/hooks/useBillingSubscriptions';
import { useCreateInstallments } from '@/hooks/useBillingInstallments';
import { useAddBillingHistory } from '@/hooks/useBillingHistory';
import { PAYMENT_METHOD_LABELS, BillingPaymentMethod } from '@/types/billing';
import { toast } from 'sonner';
import { addMonths, format } from 'date-fns';

interface CreateSubscriptionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CreateSubscriptionModal = ({ open, onOpenChange }: CreateSubscriptionModalProps) => {
  const [form, setForm] = useState({
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    product_name: '',
    valor_entrada: 0,
    valor_total_contrato: 0,
    total_parcelas: 1,
    forma_pagamento: 'boleto' as BillingPaymentMethod,
    data_inicio: format(new Date(), 'yyyy-MM-dd'),
    responsavel_financeiro: '',
    observacoes: '',
  });

  const createSub = useCreateSubscription();
  const createInst = useCreateInstallments();
  const addHistory = useAddBillingHistory();

  const handleSubmit = async () => {
    if (!form.customer_name || !form.product_name) {
      toast.error('Preencha nome e produto');
      return;
    }

    try {
      // We need to get the subscription id back — use supabase directly for this
      const { supabase } = await import('@/integrations/supabase/client');
      const { data: sub, error } = await supabase
        .from('billing_subscriptions')
        .insert({
          customer_name: form.customer_name,
          customer_email: form.customer_email || null,
          customer_phone: form.customer_phone || null,
          product_name: form.product_name,
          valor_entrada: form.valor_entrada,
          valor_total_contrato: form.valor_total_contrato,
          total_parcelas: form.total_parcelas,
          forma_pagamento: form.forma_pagamento,
          data_inicio: form.data_inicio,
          responsavel_financeiro: form.responsavel_financeiro || null,
          observacoes: form.observacoes || null,
        } as any)
        .select('id')
        .single();

      if (error) throw error;

      // Generate installments
      const valorParcela = form.total_parcelas > 0
        ? (form.valor_total_contrato - form.valor_entrada) / form.total_parcelas
        : 0;

      const installments = Array.from({ length: form.total_parcelas }, (_, i) => ({
        subscription_id: sub.id,
        numero_parcela: i + 1,
        valor_original: Math.round(valorParcela * 100) / 100,
        data_vencimento: format(addMonths(new Date(form.data_inicio), i + 1), 'yyyy-MM-dd'),
        status: 'pendente' as const,
      }));

      if (installments.length > 0) {
        await createInst.mutateAsync(installments);
      }

      await addHistory.mutateAsync({
        subscription_id: sub.id,
        tipo: 'observacao',
        descricao: `Assinatura criada: ${form.product_name} - ${form.total_parcelas}x`,
      });

      toast.success('Assinatura criada com sucesso');
      onOpenChange(false);
      // Reset form
      setForm({
        customer_name: '', customer_email: '', customer_phone: '', product_name: '',
        valor_entrada: 0, valor_total_contrato: 0, total_parcelas: 1,
        forma_pagamento: 'boleto', data_inicio: format(new Date(), 'yyyy-MM-dd'),
        responsavel_financeiro: '', observacoes: '',
      });
    } catch (err) {
      console.error(err);
      toast.error('Erro ao criar assinatura');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Assinatura / Contrato</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Nome do Cliente *</Label>
              <Input value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} />
            </div>
            <div>
              <Label>Email</Label>
              <Input value={form.customer_email} onChange={(e) => setForm({ ...form, customer_email: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Telefone</Label>
              <Input value={form.customer_phone} onChange={(e) => setForm({ ...form, customer_phone: e.target.value })} />
            </div>
            <div>
              <Label>Produto *</Label>
              <Input value={form.product_name} onChange={(e) => setForm({ ...form, product_name: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Valor Entrada</Label>
              <Input type="number" value={form.valor_entrada} onChange={(e) => setForm({ ...form, valor_entrada: Number(e.target.value) })} />
            </div>
            <div>
              <Label>Valor Total</Label>
              <Input type="number" value={form.valor_total_contrato} onChange={(e) => setForm({ ...form, valor_total_contrato: Number(e.target.value) })} />
            </div>
            <div>
              <Label>Nº Parcelas</Label>
              <Input type="number" min={1} value={form.total_parcelas} onChange={(e) => setForm({ ...form, total_parcelas: Number(e.target.value) })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Forma de Pagamento</Label>
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
              <Label>Data Início</Label>
              <Input type="date" value={form.data_inicio} onChange={(e) => setForm({ ...form, data_inicio: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Responsável Financeiro</Label>
            <Input value={form.responsavel_financeiro} onChange={(e) => setForm({ ...form, responsavel_financeiro: e.target.value })} />
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit}>Criar Assinatura</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
