import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useCreateArTitulo } from '@/hooks/useAReceber';
import type { ArTituloTipo } from '@/types/aReceber';

const PRODUCTS = [
  { code: 'A001', name: 'A001 - Incorporador Completo' },
  { code: 'A002', name: 'A002 - Incorporador Básico' },
  { code: 'A003', name: 'A003 - Anticrise Completo' },
  { code: 'A004', name: 'A004 - Anticrise Básico' },
  { code: 'A009', name: 'A009 - Incorporador + The Club' },
  { code: 'OUTRO', name: 'Outro (informar manualmente)' },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CadastroManualDialog({ open, onOpenChange }: Props) {
  const createTitulo = useCreateArTitulo();
  const [loading, setLoading] = useState(false);
  const [productCode, setProductCode] = useState('A001');
  const [form, setForm] = useState({
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    customer_document: '',
    product_name: '',
    valor_total: 0,
    payment_method: 'pix',
    tipo: 'integral' as ArTituloTipo,
    total_installments_hubla: 1,
    sale_date: format(new Date(), 'yyyy-MM-dd'),
    observacoes: '',
  });

  const reset = () => {
    setProductCode('A001');
    setForm({
      customer_name: '',
      customer_email: '',
      customer_phone: '',
      customer_document: '',
      product_name: '',
      valor_total: 0,
      payment_method: 'pix',
      tipo: 'integral',
      total_installments_hubla: 1,
      sale_date: format(new Date(), 'yyyy-MM-dd'),
      observacoes: '',
    });
  };

  const handleSubmit = async () => {
    if (!form.customer_name.trim()) {
      toast.error('Informe o nome do cliente');
      return;
    }
    if (!form.valor_total || form.valor_total <= 0) {
      toast.error('Informe o valor total');
      return;
    }
    const selected = PRODUCTS.find((p) => p.code === productCode);
    const productName = productCode === 'OUTRO'
      ? form.product_name.trim()
      : (form.product_name.trim() || selected?.name || productCode);
    if (!productName) {
      toast.error('Informe o nome do produto');
      return;
    }
    setLoading(true);
    try {
      await createTitulo.mutateAsync({
        customer_name: form.customer_name.trim(),
        customer_email: form.customer_email.trim() || null,
        customer_phone: form.customer_phone.trim() || null,
        customer_document: form.customer_document.trim() || null,
        product_name: productName,
        product_code: productCode === 'OUTRO' ? null : productCode,
        valor_total: Number(form.valor_total),
        payment_method: form.payment_method,
        tipo: form.tipo,
        total_installments_hubla: form.tipo === 'parcelado' ? Number(form.total_installments_hubla || 1) : 1,
        status: 'aberto',
        sale_date: form.sale_date,
        observacoes: form.observacoes.trim() || null,
      } as any);
      toast.success('Título cadastrado com sucesso');
      reset();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao cadastrar título');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cadastro Manual de Título</DialogTitle>
          <DialogDescription>
            Registre manualmente um título a receber que não veio via integração Hubla.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <Label>Nome do Cliente *</Label>
              <Input value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} placeholder="Nome completo" />
            </div>
            <div>
              <Label>E-mail</Label>
              <Input type="email" value={form.customer_email} onChange={(e) => setForm({ ...form, customer_email: e.target.value })} />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input value={form.customer_phone} onChange={(e) => setForm({ ...form, customer_phone: e.target.value })} />
            </div>
            <div>
              <Label>CPF / CNPJ</Label>
              <Input value={form.customer_document} onChange={(e) => setForm({ ...form, customer_document: e.target.value })} />
            </div>
            <div>
              <Label>Data da Venda *</Label>
              <Input type="date" value={form.sale_date} onChange={(e) => setForm({ ...form, sale_date: e.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Produto *</Label>
              <Select value={productCode} onValueChange={setProductCode}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRODUCTS.map((p) => (
                    <SelectItem key={p.code} value={p.code}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{productCode === 'OUTRO' ? 'Nome do Produto *' : 'Nome exibido (opcional)'}</Label>
              <Input
                value={form.product_name}
                onChange={(e) => setForm({ ...form, product_name: e.target.value })}
                placeholder={productCode === 'OUTRO' ? 'Descreva o produto' : 'Deixe vazio para usar o padrão'}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label>Valor Total (R$) *</Label>
              <Input type="number" step="0.01" min={0} value={form.valor_total} onChange={(e) => setForm({ ...form, valor_total: Number(e.target.value) })} />
            </div>
            <div>
              <Label>Forma de Pagamento</Label>
              <Select value={form.payment_method} onValueChange={(v) => setForm({ ...form, payment_method: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="boleto">Boleto</SelectItem>
                  <SelectItem value="credit_card">Cartão de Crédito</SelectItem>
                  <SelectItem value="transferencia">Transferência</SelectItem>
                  <SelectItem value="dinheiro">Dinheiro</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v as ArTituloTipo })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="integral">Integral</SelectItem>
                  <SelectItem value="parcelado">Parcelado</SelectItem>
                  <SelectItem value="pendente_lancamento">Pendente de lançamento</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {form.tipo === 'parcelado' && (
            <div className="max-w-[200px]">
              <Label>Nº de Parcelas</Label>
              <Input
                type="number"
                min={1}
                value={form.total_installments_hubla}
                onChange={(e) => setForm({ ...form, total_installments_hubla: Number(e.target.value) })}
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Você poderá lançar as parcelas em seguida na tela de detalhe do título.
              </p>
            </div>
          )}

          <div>
            <Label>Observações</Label>
            <Textarea value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} rows={3} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'Cadastrando...' : 'Cadastrar Título'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}