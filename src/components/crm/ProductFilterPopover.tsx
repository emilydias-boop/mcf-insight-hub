import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Package, Search, X, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ProductFilterRule, ProductOperator } from '@/hooks/useProductFilterData';

interface ProductFilterPopoverProps {
  availableProducts: string[];
  productFilters: ProductFilterRule[];
  productOperator: ProductOperator;
  onChangeFilters: (filters: ProductFilterRule[], operator: ProductOperator) => void;
  isLoading?: boolean;
}

export const ProductFilterPopover = ({
  availableProducts,
  productFilters,
  productOperator,
  onChangeFilters,
  isLoading = false,
}: ProductFilterPopoverProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [addMode, setAddMode] = useState<'has' | 'not_has'>('has');

  const activeCount = productFilters.length;

  const filteredProducts = useMemo(() => {
    const usedProducts = new Set(productFilters.map(r => r.product));
    let products = availableProducts.filter(p => !usedProducts.has(p));
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      products = products.filter(p => p.toLowerCase().includes(query));
    }
    return products;
  }, [availableProducts, searchQuery, productFilters]);

  const handleAddRule = (product: string) => {
    onChangeFilters([...productFilters, { product, mode: addMode }], productOperator);
    setSearchQuery('');
  };

  const handleRemoveRule = (index: number) => {
    onChangeFilters(productFilters.filter((_, i) => i !== index), productOperator);
  };

  const handleClearAll = () => {
    onChangeFilters([], 'and');
    setSearchQuery('');
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={activeCount > 0 ? 'default' : 'outline'}
          className="justify-start text-left font-normal"
        >
          <Package className="mr-2 h-4 w-4" />
          Produtos
          {activeCount > 0 && (
            <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
              {activeCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        {/* Operator toggle */}
        <div className="p-3 border-b flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-medium">Operador:</span>
          <div className="flex rounded-md border overflow-hidden">
            <button
              className={cn(
                "px-3 py-1 text-xs font-medium transition-colors",
                productOperator === 'and'
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-muted-foreground hover:bg-muted"
              )}
              onClick={() => onChangeFilters(productFilters, 'and')}
            >
              E
            </button>
            <button
              className={cn(
                "px-3 py-1 text-xs font-medium transition-colors border-l",
                productOperator === 'or'
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-muted-foreground hover:bg-muted"
              )}
              onClick={() => onChangeFilters(productFilters, 'or')}
            >
              OU
            </button>
          </div>
          <span className="text-[10px] text-muted-foreground ml-auto">
            {productOperator === 'and' ? 'Todas as condições' : 'Qualquer condição'}
          </span>
        </div>

        {/* Active rules */}
        {productFilters.length > 0 && (
          <div className="p-2 border-b space-y-1">
            {productFilters.map((rule, idx) => (
              <div
                key={`${rule.product}-${idx}`}
                className={cn(
                  "flex items-center gap-2 px-2 py-1.5 rounded-md text-xs",
                  rule.mode === 'has'
                    ? "bg-green-500/10 text-green-700 dark:text-green-400"
                    : "bg-red-500/10 text-red-700 dark:text-red-400"
                )}
              >
                <span className="font-medium shrink-0">
                  {rule.mode === 'has' ? 'Possui' : 'Não possui'}
                </span>
                <span className="truncate flex-1 font-mono">{rule.product}</span>
                <button onClick={() => handleRemoveRule(idx)} className="shrink-0 hover:opacity-70">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Mode selector + search */}
        <div className="p-3 border-b space-y-2">
          <Select value={addMode} onValueChange={(v) => setAddMode(v as 'has' | 'not_has')}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="has">✅ Possui o produto</SelectItem>
              <SelectItem value="not_has">❌ Não possui o produto</SelectItem>
            </SelectContent>
          </Select>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar produtos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-9"
            />
          </div>
        </div>

        {/* Products list */}
        <ScrollArea className="h-[200px]">
          <div className="p-2">
            {isLoading ? (
              <div className="text-center py-4 text-sm text-muted-foreground">
                Carregando produtos...
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="text-center py-4 text-sm text-muted-foreground">
                {searchQuery ? 'Nenhum produto encontrado' : 'Sem produtos disponíveis'}
              </div>
            ) : (
              <div className="space-y-0.5">
                {filteredProducts.map((product) => (
                  <button
                    key={product}
                    className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md hover:bg-muted cursor-pointer text-left"
                    onClick={() => handleAddRule(product)}
                  >
                    <Plus className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="text-sm truncate flex-1">{product}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Clear all */}
        {activeCount > 0 && (
          <div className="p-2 border-t">
            <Button size="sm" variant="ghost" onClick={handleClearAll} className="w-full">
              <X className="h-4 w-4 mr-1" />
              Limpar filtros ({activeCount})
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};
