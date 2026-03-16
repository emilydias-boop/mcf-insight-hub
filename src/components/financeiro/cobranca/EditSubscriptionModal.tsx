import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BillingSubscription, PAYMENT_METHOD_LABELS } from '@/types/billing';
import { useUpdateSubscription } from '@/hooks/useBillingSubscriptions';
import { toast } from 'sonner';

interface EditSubscriptionModalProps {
  subscription: BillingSubscription;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const EditSubscriptionModal = ({ subscription, open, onOpenChange }: EditSubscriptionModalProps) => {
  const [form, setForm] = useState({
    product_name: '',
    product_category: '',
    responsavel_financeiro: '',
    forma_pagamento: '',
    customer_phone: '',
    observacoes: '',
  });

  const updateSub = useUpdateSubscription();

  useEffect(() => {
    if (subscription) {
      setForm({
        product_name: subscription.product_name || '',
        product_category: subscription.product_category || '',
        responsavel_financeiro: subscription.responsavel_financeiro || '',
        forma_pagamento: subscription.forma_pagamento || '',
        customer_phone: subscription.customer_phone || '',
        observacoes: subscription.observacoes || '',
      });
    }
  }, [subscription]);

  const handleSubmit = async () => {
    try {
      await updateSub.mutateAsync({
        id: subscription.id,
        product_name: form.product_name,
        product_category: form.product_category || null,
        responsavel_financeiro: form.responsavel_financeiro || null,
        forma_pagamento: form.forma_pagamento as any || null,
        customer_phone: form.customer_phone || null,
        observacoes: form.observacoes || null,
      });
      toast.success('Assinatura atualizada');
      onOpenChange(false);
    } catch {
      toast.error('Erro ao atualizar assinatura');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Assinatura</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Produto</Label>
            <Input value={form.product_name} onChange={(e) => setForm({ ...form, product_name: e.target.value })} />
          </div>
          <div>
            <Label>Categoria</Label>
            <Input value={form.product_category} onChange={(e) => setForm({ ...form, product_category: e.target.value })} />
          </div>
          <div>
            <Label>Responsável Financeiro</Label>
            <Input value={form.responsavel_financeiro} onChange={(e) => setForm({ ...form, responsavel_financeiro: e.target.value })} />
          </div>
          <div>
            <Label>Telefone</Label>
            <Input value={form.customer_phone} onChange={(e) => setForm({ ...form, customer_phone: e.target.value })} />
          </div>
          <div>
            <Label>Forma de Pagamento</Label>
            <Select value={form.forma_pagamento} onValueChange={(val) => setForm({ ...form, forma_pagamento: val })}>
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
            <Textarea value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
          </div>
          <Button onClick={handleSubmit} disabled={updateSub.isPending} className="w-full">
            {updateSub.isPending ? 'Salvando...' : 'Salvar Alterações'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
