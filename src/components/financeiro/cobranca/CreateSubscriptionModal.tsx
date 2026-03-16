import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { useCreateInstallments } from '@/hooks/useBillingInstallments';
import { useAddBillingHistory } from '@/hooks/useBillingHistory';
import { useProductConfigurations, TARGET_BU_OPTIONS } from '@/hooks/useProductConfigurations';
import { PAYMENT_METHOD_LABELS, BillingPaymentMethod } from '@/types/billing';
import { toast } from 'sonner';
import { addMonths, addDays, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, Check, ChevronsUpDown, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

interface CreateSubscriptionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type IntervalType = 'mensal' | 'quinzenal' | 'customizado';

export const CreateSubscriptionModal = ({ open, onOpenChange }: CreateSubscriptionModalProps) => {
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
    valor_total_contrato: 0,
    tem_entrada: false,
    valor_entrada: 0,
    forma_pagamento: 'boleto' as BillingPaymentMethod,
    total_parcelas: 1,
    valor_parcela: 0,
    intervalo: 'mensal' as IntervalType,
    data_primeiro_vencimento: new Date(),
    responsavel_financeiro: '',
    observacoes: '',
    data_inicio: format(new Date(), 'yyyy-MM-dd'),
  });

  const [customDates, setCustomDates] = useState<Date[]>([]);

  const createInst = useCreateInstallments();
  const addHistory = useAddBillingHistory();

  // Auto-calc valor_parcela
  const valorParcelaCalc = useMemo(() => {
    const base = form.valor_total_contrato - (form.tem_entrada ? form.valor_entrada : 0);
    return form.total_parcelas > 0 ? Math.round((base / form.total_parcelas) * 100) / 100 : 0;
  }, [form.valor_total_contrato, form.valor_entrada, form.tem_entrada, form.total_parcelas]);

  const handleSelectProduct = (productId: string) => {
    const prod = activeProducts.find(p => p.id === productId);
    if (!prod) return;
    setSelectedProductId(productId);
    const valorTotal = prod.reference_price || 0;
    const parcelas = form.total_parcelas || 1;
    const base = valorTotal - (form.tem_entrada ? form.valor_entrada : 0);
    setForm(prev => ({
      ...prev,
      product_name: prod.product_name,
      product_category: prod.product_category || '',
      target_bu: prod.target_bu || '',
      valor_total_contrato: valorTotal,
      valor_parcela: Math.round((base / parcelas) * 100) / 100,
    }));
    setProductOpen(false);
  };

  const generateInstallmentDates = (): string[] => {
    if (form.intervalo === 'customizado') {
      return customDates.map(d => format(d, 'yyyy-MM-dd'));
    }
    const dates: string[] = [];
    for (let i = 0; i < form.total_parcelas; i++) {
      const date = form.intervalo === 'quinzenal'
        ? addDays(form.data_primeiro_vencimento, i * 15)
        : addMonths(form.data_primeiro_vencimento, i);
      dates.push(format(date, 'yyyy-MM-dd'));
    }
    return dates;
  };

  const handleSubmit = async () => {
    if (!form.customer_name || !form.product_name) {
      toast.error('Preencha nome do cliente e produto');
      return;
    }

    try {
      const { data: sub, error } = await supabase
        .from('billing_subscriptions')
        .insert({
          customer_name: form.customer_name,
          customer_email: form.customer_email || null,
          customer_phone: form.customer_phone || null,
          product_name: form.product_name,
          product_category: form.product_category || null,
          valor_entrada: form.tem_entrada ? form.valor_entrada : 0,
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

      // Generate installments with dates
      const dates = generateInstallmentDates();
      const vp = form.valor_parcela || valorParcelaCalc;
      const installments = dates.map((date, i) => ({
        subscription_id: sub.id,
        numero_parcela: i + 1,
        valor_original: vp,
        data_vencimento: date,
        status: 'pendente' as const,
      }));

      if (installments.length > 0) {
        await createInst.mutateAsync(installments);
      }

      await addHistory.mutateAsync({
        subscription_id: sub.id,
        tipo: 'observacao',
        descricao: `Assinatura criada: ${form.product_name} - ${form.total_parcelas}x de R$${vp.toFixed(2)}`,
      });

      toast.success('Assinatura criada com sucesso');
      onOpenChange(false);
      resetForm();
    } catch (err) {
      console.error(err);
      toast.error('Erro ao criar assinatura');
    }
  };

  const resetForm = () => {
    setSelectedProductId('');
    setCustomDates([]);
    setForm({
      customer_name: '', customer_email: '', customer_phone: '', product_name: '',
      product_category: '', target_bu: '', valor_total_contrato: 0, tem_entrada: false,
      valor_entrada: 0, forma_pagamento: 'boleto', total_parcelas: 1, valor_parcela: 0,
      intervalo: 'mensal', data_primeiro_vencimento: new Date(),
      responsavel_financeiro: '', observacoes: '', data_inicio: format(new Date(), 'yyyy-MM-dd'),
    });
  };

  const addCustomDate = () => {
    setCustomDates(prev => [...prev, addMonths(prev.length > 0 ? prev[prev.length - 1] : new Date(), 1)]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Assinatura / Contrato</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Seção 1 - Dados do Lead */}
          <div>
            <h4 className="text-sm font-semibold text-muted-foreground mb-3">Dados do Lead</h4>
            <div className="grid grid-cols-3 gap-3">
              <div>
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

          {/* Seção 2 - Produto e BU */}
          <div>
            <h4 className="text-sm font-semibold text-muted-foreground mb-3">Produto</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Produto *</Label>
                <Popover open={productOpen} onOpenChange={setProductOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                      {selectedProductId
                        ? activeProducts.find(p => p.id === selectedProductId)?.product_name
                        : 'Selecione o produto...'}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[400px] p-0 pointer-events-auto" align="start">
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
                              <div className="flex flex-col">
                                <span>{p.product_name}</span>
                                <span className="text-xs text-muted-foreground">
                                  R$ {(p.reference_price || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                  {p.target_bu ? ` · ${p.target_bu}` : ''}
                                </span>
                              </div>
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

          {/* Seção 3 - Financeiro */}
          <div>
            <h4 className="text-sm font-semibold text-muted-foreground mb-3">Financeiro</h4>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Valor Total do Contrato (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.valor_total_contrato}
                    onChange={e => setForm(f => ({ ...f, valor_total_contrato: Number(e.target.value) }))}
                  />
                </div>
                <div>
                  <Label>Forma de Pagamento</Label>
                  <Select value={form.forma_pagamento} onValueChange={v => setForm(f => ({ ...f, forma_pagamento: v as BillingPaymentMethod }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(PAYMENT_METHOD_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="tem_entrada"
                  checked={form.tem_entrada}
                  onCheckedChange={(checked) => setForm(f => ({ ...f, tem_entrada: !!checked }))}
                />
                <Label htmlFor="tem_entrada" className="cursor-pointer">Tem entrada?</Label>
              </div>

              {form.tem_entrada && (
                <div className="w-1/2">
                  <Label>Valor da Entrada (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.valor_entrada}
                    onChange={e => setForm(f => ({ ...f, valor_entrada: Number(e.target.value) }))}
                  />
                </div>
              )}

              {/* Parcelas */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Nº de Parcelas</Label>
                  <Input
                    type="number"
                    min={1}
                    value={form.total_parcelas}
                    onChange={e => setForm(f => ({ ...f, total_parcelas: Number(e.target.value) }))}
                  />
                </div>
                <div>
                  <Label>Valor Parcela (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.valor_parcela || valorParcelaCalc}
                    onChange={e => setForm(f => ({ ...f, valor_parcela: Number(e.target.value) }))}
                    placeholder={valorParcelaCalc.toFixed(2)}
                  />
                  <span className="text-xs text-muted-foreground">Calculado: R$ {valorParcelaCalc.toFixed(2)}</span>
                </div>
                <div>
                  <Label>Intervalo</Label>
                  <Select value={form.intervalo} onValueChange={v => setForm(f => ({ ...f, intervalo: v as IntervalType }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mensal">Mensal</SelectItem>
                      <SelectItem value="quinzenal">Quinzenal</SelectItem>
                      <SelectItem value="customizado">Customizado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {form.intervalo !== 'customizado' && (
                <div className="w-1/2">
                  <Label>Data do 1º Vencimento</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !form.data_primeiro_vencimento && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(form.data_primeiro_vencimento, "dd/MM/yyyy")}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={form.data_primeiro_vencimento}
                        onSelect={d => d && setForm(f => ({ ...f, data_primeiro_vencimento: d }))}
                        locale={ptBR}
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              )}

              {form.intervalo === 'customizado' && (
                <div className="space-y-2">
                  <Label>Datas das Parcelas</Label>
                  {customDates.map((date, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground w-16">#{idx + 1}</span>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="sm" className="justify-start font-normal">
                            <CalendarIcon className="mr-2 h-3 w-3" />
                            {format(date, "dd/MM/yyyy")}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={date}
                            onSelect={d => {
                              if (!d) return;
                              setCustomDates(prev => prev.map((dd, i) => i === idx ? d : dd));
                            }}
                            locale={ptBR}
                            className="p-3 pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCustomDates(prev => prev.filter((_, i) => i !== idx))}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={addCustomDate}>+ Adicionar data</Button>
                </div>
              )}
            </div>
          </div>

          {/* Seção 4 - Complementar */}
          <div>
            <h4 className="text-sm font-semibold text-muted-foreground mb-3">Complementar</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Responsável Financeiro</Label>
                <Input value={form.responsavel_financeiro} onChange={e => setForm(f => ({ ...f, responsavel_financeiro: e.target.value }))} />
              </div>
              <div>
                <Label>Data Início</Label>
                <Input type="date" value={form.data_inicio} onChange={e => setForm(f => ({ ...f, data_inicio: e.target.value }))} />
              </div>
            </div>
            <div className="mt-3">
              <Label>Observações</Label>
              <Textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} />
            </div>
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
