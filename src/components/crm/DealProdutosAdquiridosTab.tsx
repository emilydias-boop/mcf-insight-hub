import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Settings, Trash2, Plus, Package, ShoppingCart } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import {
  useProdutoAdquiridoOptions,
  useDealProdutosAdquiridos,
  useAddDealProdutoAdquirido,
  useRemoveDealProdutoAdquirido,
} from '@/hooks/useDealProdutosAdquiridos';
import { useComprasDoCliente } from '@/hooks/useComprasDoCliente';
import { useTotalCliente } from '@/hooks/useTotaisPorCliente';
import { ProdutoAdquiridoConfigModal } from './ProdutoAdquiridoConfigModal';

interface Props {
  dealId: string;
  email?: string | null;
}

const formatarData = (iso?: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
};

export const DealProdutosAdquiridosTab = ({ dealId, email }: Props) => {
  const { data: options = [] } = useProdutoAdquiridoOptions();
  const { data: produtos = [] } = useDealProdutosAdquiridos(dealId);
  const { data: compras = [], isLoading: loadingCompras } = useComprasDoCliente(email);
  const { data: totais } = useTotalCliente(email);
  const addProduto = useAddDealProdutoAdquirido();
  const removeProduto = useRemoveDealProdutoAdquirido();

  const [selectedOption, setSelectedOption] = useState('');
  const [valor, setValor] = useState('');
  const [showConfig, setShowConfig] = useState(false);

  const usedOptionIds = new Set(produtos.map((p) => p.produto_option_id));
  const availableOptions = options.filter((o) => !usedOptionIds.has(o.id));

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
    <div className="p-3 space-y-4">
      {/* ===== Compras reais (gateways) ===== */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium flex items-center gap-1.5">
            <ShoppingCart className="h-4 w-4" />
            Produtos Adquiridos
          </h4>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setShowConfig(true)}>
            <Settings className="h-3.5 w-3.5" />
          </Button>
        </div>

        {totais && totais.qtd_pagamentos > 0 && (
          <p className="text-xs text-muted-foreground">
            {totais.qtd_produtos} produto{totais.qtd_produtos > 1 ? 's' : ''} •{' '}
            <span className="font-semibold text-foreground">{formatCurrency(totais.total_liquido_pago)}</span>
          </p>
        )}

        {loadingCompras ? (
          <p className="text-xs text-muted-foreground">Carregando...</p>
        ) : compras.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">Nenhuma compra registrada</p>
        ) : (
          <div className="space-y-1.5">
            {compras.map((c, idx) => (
              <div
                key={`${c.produto}-${c.sale_date}-${idx}`}
                className={`flex items-start justify-between gap-2 bg-secondary/50 rounded-md px-3 py-2 ${
                  c.reembolsado ? 'opacity-60' : ''
                }`}
              >
                <div className="min-w-0 space-y-1">
                  <p className={`text-sm truncate ${c.reembolsado ? 'line-through' : ''}`}>{c.produto}</p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">{formatarData(c.sale_date)}</span>
                    {c.gateway && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                        {c.gateway}
                      </Badge>
                    )}
                    {c.total_parcelas && c.total_parcelas > 1 && (
                      <span className="text-xs text-muted-foreground">
                        parcela {c.parcela ?? '?'}/{c.total_parcelas}
                      </span>
                    )}
                    {c.reembolsado && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-destructive text-destructive">
                        Reembolso
                      </Badge>
                    )}
                  </div>
                </div>
                <span className="text-sm font-medium whitespace-nowrap">{formatCurrency(c.liquido)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ===== Produtos manuais (anotação) ===== */}
      <div className="border-t pt-3 space-y-2">
        <h4 className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
          <Package className="h-3.5 w-3.5" />
          Produtos adicionados manualmente
        </h4>

        {produtos.length > 0 && (
          <div className="space-y-1.5">
            {produtos.map((p) => (
              <div key={p.id} className="flex items-center justify-between bg-secondary/30 rounded-md px-3 py-1.5">
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
