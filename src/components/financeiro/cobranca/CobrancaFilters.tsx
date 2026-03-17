import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { BillingFilters, SUBSCRIPTION_STATUS_LABELS, PAYMENT_METHOD_LABELS } from '@/types/billing';
import { Search } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface CobrancaFiltersProps {
  filters: BillingFilters;
  onFiltersChange: (filters: BillingFilters) => void;
}

export const CobrancaFilters = ({ filters, onFiltersChange }: CobrancaFiltersProps) => {
  const { data: products = [] } = useQuery({
    queryKey: ['billing-products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('billing_subscriptions')
        .select('product_name, product_category')
        .order('product_name');
      if (error) throw error;
      const uniqueProducts = [...new Map((data || []).map(p => [p.product_name, p])).values()];
      return uniqueProducts as { product_name: string; product_category: string | null }[];
    },
  });

  const categories = [...new Set(products.map(p => p.product_category).filter(Boolean))] as string[];

  return (
    <div className="flex flex-wrap gap-3 items-end">
      <div className="relative flex-1 min-w-[200px] max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, email ou produto..."
          className="pl-9"
          value={filters.search || ''}
          onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
        />
      </div>

      <Select
        value={filters.status || 'todos'}
        onValueChange={(val) => onFiltersChange({ ...filters, status: val as any })}
      >
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos os status</SelectItem>
          {Object.entries(SUBSCRIPTION_STATUS_LABELS).map(([k, v]) => (
            <SelectItem key={k} value={k}>{v}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.formaPagamento || 'todos'}
        onValueChange={(val) => onFiltersChange({ ...filters, formaPagamento: val as any })}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Forma pgto" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todas as formas</SelectItem>
          {Object.entries(PAYMENT_METHOD_LABELS).map(([k, v]) => (
            <SelectItem key={k} value={k}>{v}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={(filters as any).product || 'todos'}
        onValueChange={(val) => onFiltersChange({ ...filters, product: val } as any)}
      >
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="Produto" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos os produtos</SelectItem>
          {products.map(p => (
            <SelectItem key={p.product_name} value={p.product_name}>{p.product_name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {categories.length > 0 && (
        <Select
          value={(filters as any).category || 'todos'}
          onValueChange={(val) => onFiltersChange({ ...filters, category: val } as any)}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas categorias</SelectItem>
            {categories.map(c => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Switch
            id="inadimplentes"
            checked={filters.inadimplentes || false}
            onCheckedChange={(checked) => onFiltersChange({ ...filters, inadimplentes: checked })}
          />
          <Label htmlFor="inadimplentes" className="text-xs cursor-pointer">Inadimplentes</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id="quitados"
            checked={filters.quitados || false}
            onCheckedChange={(checked) => onFiltersChange({ ...filters, quitados: checked })}
          />
          <Label htmlFor="quitados" className="text-xs cursor-pointer">Quitados</Label>
        </div>
      </div>
    </div>
  );
};
