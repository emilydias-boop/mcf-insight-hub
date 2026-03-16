import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { BillingSubscription, PAYMENT_METHOD_LABELS, BillingPaymentMethod } from '@/types/billing';
import { useUpdateSubscription } from '@/hooks/useBillingSubscriptions';
import { useProductConfigurations, TARGET_BU_OPTIONS } from '@/hooks/useProductConfigurations';
import { toast } from 'sonner';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EditSubscriptionModalProps {
  subscription: BillingSubscription;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const EditSubscriptionModal = ({ subscription, open, onOpenChange }: EditSubscriptionModalProps) => {
  const { data: products } = useProductConfigurations();
  const activeProducts = useMemo(() => (products || []).filter(p => p.is_active), [products]);

  const [productOpen, setProductOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState('');

  const [form, setForm] = useState({
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    product_name: '',
    product_category: '',
    target_bu: '',
    forma_pagamento: '' as string,
    responsavel_financeiro: '',
    observacoes: '',
  });

  const updateSub = useUpdateSubscription();

  useEffect(() => {
    if (subscription) {
      setForm({
        customer_name: subscription.customer_name || '',
        customer_email: subscription.customer_email || '',
        customer_phone: subscription.customer_phone || '',
        product_name: subscription.product_name || '',
        product_category: subscription.product_category || '',
        target_bu: '',
        forma_pagamento: subscription.forma_pagamento || '',
        responsavel_financeiro: subscription.responsavel_financeiro || '',
        observacoes: subscription.observacoes || '',
      });
      // Try to match product
      const matched = (products || []).find(p => p.product_name === subscription.product_name);
      if (matched) {
        setSelectedProductId(matched.id);
        setForm(f => ({ ...f, target_bu: matched.target_bu || '' }));
      } else {
        setSelectedProductId('');
      }
    }
  }, [subscription, products]);

  const handleSelectProduct = (productId: string) => {
    const prod = activeProducts.find(p => p.id === productId);
    if (!prod) return;
    setSelectedProductId(productId);
    setForm(prev => ({
      ...prev,
      product_name: prod.product_name,
      product_category: prod.product_category || '',
      target_bu: prod.target_bu || '',
    }));
    setProductOpen(false);
  };

  const handleSubmit = async () => {
    if (!form.customer_name || !form.product_name) {
      toast.error('Preencha nome e produto');
      return;
    }
    try {
      await updateSub.mutateAsync({
        id: subscription.id,
        customer_name: form.customer_name,
        customer_email: form.customer_email || null,
        customer_phone: form.customer_phone || null,
        product_name: form.product_name,
        product_category: form.product_category || null,
        responsavel_financeiro: form.responsavel_financeiro || null,
        forma_pagamento: (form.forma_pagamento as BillingPaymentMethod) || null,
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
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Assinatura</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Dados do Lead */}
          <div>
            <h4 className="text-sm font-semibold text-muted-foreground mb-3">Dados do Lead</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Nome do Cliente *</Label>
                <Input value={form.customer_name} onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))} />
              </div>
              <div>
                <Label>Email</Label>
                <Input type="email" value={form.customer_email} onChange={e => setForm(f => ({ ...f, customer_email: e.target.value }))} />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input value={form.customer_phone} onChange={e => setForm(f => ({ ...f, customer_phone: e.target.value }))} />
              </div>
            </div>
          </div>

          {/* Produto */}
          <div>
            <h4 className="text-sm font-semibold text-muted-foreground mb-3">Produto</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Produto *</Label>
                <Popover open={productOpen} onOpenChange={setProductOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                      {form.product_name || 'Selecione o produto...'}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[350px] p-0 pointer-events-auto" align="start">
                    <Command>
                      <CommandInput placeholder="Buscar produto..." />
                      <CommandList>
                        <CommandEmpty>Nenhum produto encontrado.</CommandEmpty>
                        <CommandGroup>
                          {activeProducts.map(p => (
                            <CommandItem
                              key={p.id}
                              value={p.product_name}
                              onSelect={() => handleSelectProduct(p.id)}
                            >
                              <Check className={cn("mr-2 h-4 w-4", selectedProductId === p.id ? "opacity-100" : "opacity-0")} />
                              <span>{p.product_name}</span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label>Categoria (BU)</Label>
                <Select value={form.target_bu} onValueChange={v => setForm(f => ({ ...f, target_bu: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione a BU" /></SelectTrigger>
                  <SelectContent>
                    {TARGET_BU_OPTIONS.map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Pagamento e complementar */}
          <div>
            <h4 className="text-sm font-semibold text-muted-foreground mb-3">Pagamento</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Forma de Pagamento</Label>
                <Select value={form.forma_pagamento} onValueChange={v => setForm(f => ({ ...f, forma_pagamento: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PAYMENT_METHOD_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Responsável Financeiro</Label>
                <Input value={form.responsavel_financeiro} onChange={e => setForm(f => ({ ...f, responsavel_financeiro: e.target.value }))} />
              </div>
            </div>
          </div>

          <div>
            <Label>Observações</Label>
            <Textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={updateSub.isPending}>
            {updateSub.isPending ? 'Salvando...' : 'Salvar Alterações'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
