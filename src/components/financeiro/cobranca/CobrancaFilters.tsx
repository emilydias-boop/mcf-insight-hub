import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BillingFilters, SUBSCRIPTION_STATUS_LABELS, PAYMENT_METHOD_LABELS } from '@/types/billing';
import { Search } from 'lucide-react';

interface CobrancaFiltersProps {
  filters: BillingFilters;
  onFiltersChange: (filters: BillingFilters) => void;
}

export const CobrancaFilters = ({ filters, onFiltersChange }: CobrancaFiltersProps) => {
  return (
    <div className="flex flex-wrap gap-3">
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

      <Input
        placeholder="Responsável"
        className="w-[160px]"
        value={filters.responsavel || ''}
        onChange={(e) => onFiltersChange({ ...filters, responsavel: e.target.value })}
      />
    </div>
  );
};
