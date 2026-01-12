import { useState, useMemo } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useDistinctProducts } from "@/hooks/useDistinctProducts";
import { Search, CheckSquare, XSquare } from "lucide-react";

interface ProductFilterSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedProducts: string[];
  onApply: (products: string[]) => void;
}

export function ProductFilterSheet({
  open,
  onOpenChange,
  selectedProducts,
  onApply,
}: ProductFilterSheetProps) {
  const { data: products, isLoading } = useDistinctProducts();
  const [localSelection, setLocalSelection] = useState<Set<string>>(
    new Set(selectedProducts)
  );
  const [searchTerm, setSearchTerm] = useState("");

  // Sync local selection when sheet opens
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setLocalSelection(new Set(selectedProducts));
      setSearchTerm("");
    }
    onOpenChange(isOpen);
  };

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    if (!searchTerm.trim()) return products;
    
    const term = searchTerm.toLowerCase();
    return products.filter(p => 
      p.product_name.toLowerCase().includes(term)
    );
  }, [products, searchTerm]);

  const toggleProduct = (productName: string) => {
    setLocalSelection((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(productName)) {
        newSet.delete(productName);
      } else {
        newSet.add(productName);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (!products) return;
    const allNames = filteredProducts.map((p) => p.product_name);
    setLocalSelection((prev) => new Set([...prev, ...allNames]));
  };

  const handleClearAll = () => {
    const filteredNames = new Set(filteredProducts.map(p => p.product_name));
    setLocalSelection((prev) => {
      const newSet = new Set(prev);
      filteredNames.forEach(name => newSet.delete(name));
      return newSet;
    });
  };

  const handleClearAllProducts = () => {
    setLocalSelection(new Set());
  };

  const handleApply = () => {
    onApply(Array.from(localSelection));
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="w-[420px] sm:w-[540px] flex flex-col">
        <SheetHeader>
          <SheetTitle>Configurar Produtos</SheetTitle>
          <SheetDescription>
            Selecione quais produtos devem aparecer na tabela. 
            Se nenhum for selecionado, todos serão exibidos.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 flex-1 overflow-hidden mt-4">
          {/* Busca local */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar produto..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Botões de ação rápida */}
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={handleSelectAll}>
              <CheckSquare className="h-4 w-4 mr-1" />
              Selecionar Visíveis
            </Button>
            <Button variant="outline" size="sm" onClick={handleClearAll}>
              <XSquare className="h-4 w-4 mr-1" />
              Limpar Visíveis
            </Button>
            <Button variant="ghost" size="sm" onClick={handleClearAllProducts}>
              Limpar Todos
            </Button>
          </div>

          {/* Contador */}
          <div className="text-sm text-muted-foreground">
            {localSelection.size > 0 ? (
              <span className="font-medium text-primary">{localSelection.size}</span>
            ) : (
              <span>Nenhum</span>
            )} produto(s) selecionado(s)
            {products && ` de ${products.length} disponíveis`}
          </div>

          {/* Lista de produtos */}
          <ScrollArea className="flex-1 -mx-6 px-6">
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 10 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : (
              <div className="space-y-1">
                {filteredProducts.map((product) => (
                  <div
                    key={product.product_name}
                    className="flex items-center gap-3 py-2 px-2 rounded-md hover:bg-muted/50 cursor-pointer"
                    onClick={() => toggleProduct(product.product_name)}
                  >
                    <Checkbox
                      checked={localSelection.has(product.product_name)}
                      onCheckedChange={() => toggleProduct(product.product_name)}
                    />
                    <span className="flex-1 text-sm truncate">
                      {product.product_name}
                    </span>
                    <Badge variant="secondary" className="shrink-0">
                      {product.transaction_count}
                    </Badge>
                  </div>
                ))}
                
                {filteredProducts.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhum produto encontrado
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </div>

        <SheetFooter className="mt-4 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleApply}>
            Aplicar{localSelection.size > 0 ? ` (${localSelection.size})` : ''}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
