import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCRMOrigins } from '@/hooks/useCRMData';
import { X } from 'lucide-react';
import type { OrphanDealsFilters } from '@/hooks/useOrphanDeals';

interface Props {
  filters: OrphanDealsFilters;
  onFiltersChange: (filters: OrphanDealsFilters) => void;
}

const DATA_SOURCES = [
  { value: 'webhook', label: 'Webhook' },
  { value: 'csv', label: 'CSV Import' },
  { value: 'manual', label: 'Manual' },
];

export function OrphanDealsFiltersComponent({ filters, onFiltersChange }: Props) {
  const { data: originsData } = useCRMOrigins();

  const allOrigins = originsData?.flatMap(g => g.children) || [];

  const updateFilter = <K extends keyof OrphanDealsFilters>(key: K, value: OrphanDealsFilters[K]) => {
    onFiltersChange({ ...filters, [key]: value, page: 1 });
  };

  const clearFilters = () => {
    onFiltersChange({ page: 1, per_page: filters.per_page });
  };

  const hasActiveFilters = filters.origin_id || filters.data_source || 
    filters.has_suggestion !== null && filters.has_suggestion !== undefined ||
    filters.date_from || filters.date_to || filters.min_value;

  return (
    <div className="flex flex-wrap items-end gap-3 p-4 bg-muted/30 rounded-lg">
      <div className="space-y-1.5">
        <Label className="text-xs">Origem</Label>
        <Select 
          value={filters.origin_id || 'all'} 
          onValueChange={(v) => updateFilter('origin_id', v === 'all' ? undefined : v)}
        >
          <SelectTrigger className="w-48 h-9">
            <SelectValue placeholder="Todas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as origens</SelectItem>
            {allOrigins.map(origin => (
              <SelectItem key={origin.id} value={origin.id}>
                {origin.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Fonte</Label>
        <Select 
          value={filters.data_source || 'all'} 
          onValueChange={(v) => updateFilter('data_source', v === 'all' ? undefined : v)}
        >
          <SelectTrigger className="w-36 h-9">
            <SelectValue placeholder="Todas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {DATA_SOURCES.map(ds => (
              <SelectItem key={ds.value} value={ds.value}>
                {ds.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Sugestão</Label>
        <Select 
          value={filters.has_suggestion === true ? 'yes' : filters.has_suggestion === false ? 'no' : 'all'} 
          onValueChange={(v) => updateFilter('has_suggestion', v === 'all' ? null : v === 'yes')}
        >
          <SelectTrigger className="w-36 h-9">
            <SelectValue placeholder="Todas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="yes">Com sugestão</SelectItem>
            <SelectItem value="no">Sem sugestão</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">De</Label>
        <Input
          type="date"
          value={filters.date_from || ''}
          onChange={(e) => updateFilter('date_from', e.target.value || undefined)}
          className="w-36 h-9"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Até</Label>
        <Input
          type="date"
          value={filters.date_to || ''}
          onChange={(e) => updateFilter('date_to', e.target.value || undefined)}
          className="w-36 h-9"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Valor mín.</Label>
        <Input
          type="number"
          placeholder="0"
          value={filters.min_value || ''}
          onChange={(e) => updateFilter('min_value', e.target.value ? Number(e.target.value) : undefined)}
          className="w-24 h-9"
        />
      </div>

      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9">
          <X className="h-4 w-4 mr-1" />
          Limpar
        </Button>
      )}
    </div>
  );
}
