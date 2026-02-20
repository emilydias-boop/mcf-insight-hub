import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Settings, Trash2, Plus, Package } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import {
  useProdutoAdquiridoOptions,
  useDealProdutosAdquiridos,
  useAddDealProdutoAdquirido,
  useRemoveDealProdutoAdquirido,
} from '@/hooks/useDealProdutosAdquiridos';
import { ProdutoAdquiridoConfigModal } from './ProdutoAdquiridoConfigModal';

interface Props {
  dealId: string;
}

export const DealProdutosAdquiridosTab = ({ dealId }: Props) => {
  const { data: options = [] } = useProdutoAdquiridoOptions();
  const { data: produtos = [], isLoading } = useDealProdutosAdquiridos(dealId);
  const addProduto = useAddDealProdutoAdquirido();
  const removeProduto = useRemoveDealProdutoAdquirido();

  const [selectedOption, setSelectedOption] = useState('');
  const [valor, setValor] = useState('');
  const [showConfig, setShowConfig] = useState(false);

  const usedOptionIds = new Set(produtos.map((p) => p.produto_option_id));
  const availableOptions = options.filter((o) => !usedOptionIds.has(o.id));

  const total = produtos.reduce((sum, p) => sum + Number(p.valor || 0), 0);

  const handleAdd = () => {
    if (!selectedOption || !valor) return;
    addProduto.mutate(
      { deal_id: dealId, produto_option_id: selectedOption, valor: Number(valor) },
      { onSuccess: () => { setSelectedOption(''); setValor(''); } }
    );
  };

  const handleRemove = (id: string) => {
    removeProduto.mutate({ id, deal_id: dealId });
  };

  return (
    <div className="p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium flex items-center gap-1.5">
          <Package className="h-4 w-4" />
          Produtos Adquiridos
        </h4>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setShowConfig(true)}>
          <Settings className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Lista de produtos */}
      {isLoading ? (
        <p className="text-xs text-muted-foreground">Carregando...</p>
      ) : produtos.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">Nenhum produto adquirido registrado</p>
      ) : (
        <div className="space-y-1.5">
          {produtos.map((p) => (
            <div key={p.id} className="flex items-center justify-between bg-secondary/50 rounded-md px-3 py-2">
              <span className="text-sm">{(p.consorcio_produto_adquirido_options as any)?.label || 'Produto'}</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{formatCurrency(Number(p.valor))}</span>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive" onClick={() => handleRemove(p.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Total */}
      {produtos.length > 0 && (
        <div className="flex items-center justify-between border-t pt-2">
          <span className="text-sm font-medium">Total</span>
          <span className="text-sm font-bold">{formatCurrency(total)}</span>
        </div>
      )}

      {/* Adicionar produto */}
      <div className="border-t pt-3 space-y-2">
        <p className="text-xs text-muted-foreground">Adicionar produto</p>
        <div className="flex gap-2">
          <Select value={selectedOption} onValueChange={setSelectedOption}>
            <SelectTrigger className="flex-1 h-8 text-xs">
              <SelectValue placeholder="Selecionar produto..." />
            </SelectTrigger>
            <SelectContent>
              {availableOptions.map((o) => (
                <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>
              ))}
              {availableOptions.length === 0 && (
                <div className="text-xs text-muted-foreground px-2 py-1.5">Sem opções disponíveis</div>
              )}
            </SelectContent>
          </Select>
          <Input
            type="number"
            placeholder="Valor"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            className="w-28 h-8 text-xs"
          />
          <Button size="sm" className="h-8" onClick={handleAdd} disabled={!selectedOption || !valor || addProduto.isPending}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <ProdutoAdquiridoConfigModal open={showConfig} onOpenChange={setShowConfig} />
    </div>
  );
};
