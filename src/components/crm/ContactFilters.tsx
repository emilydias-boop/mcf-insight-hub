import { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { X, Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ThermalStatus } from '@/hooks/useContactsEnriched';

export interface ContactFilterValues {
  pipeline: string;
  stage: string;
  sdr: string;
  closer: string;
  status: string;
  dateRange: string;
  partnerProduct: string;
}

interface FilterOptions {
  pipelines: { id: string; name: string }[];
  stages: string[];
  sdrs: string[];
  closers: string[];
}

interface ContactFiltersProps {
  filters: ContactFilterValues;
  onChange: (filters: ContactFilterValues) => void;
  options: FilterOptions;
  resultCount: number;
  totalCount: number;
  partnerProductOptions?: string[];
}

const statusOptions: { value: ThermalStatus | ''; label: string }[] = [
  { value: 'quente', label: '🔥 Quente' },
  { value: 'morno', label: '🟡 Morno' },
  { value: 'frio', label: '🟠 Frio' },
  { value: 'perdido', label: '🔴 Perdido' },
  { value: 'sem_deal', label: '⚪ Sem deal' },
];

const dateRangeOptions = [
  { value: '7', label: 'Últimos 7 dias' },
  { value: '30', label: 'Últimos 30 dias' },
  { value: '90', label: 'Últimos 90 dias' },
];

const emptyFilters: ContactFilterValues = {
  pipeline: '',
  stage: '',
  sdr: '',
  closer: '',
  status: '',
  dateRange: '',
  partnerProduct: '',
};

const hasActiveFilters = (f: ContactFilterValues) =>
  Object.values(f).some(v => v !== '');

export const ContactFilters = ({ filters, onChange, options, resultCount, totalCount, partnerProductOptions = [] }: ContactFiltersProps) => {
  const [partnerOpen, setPartnerOpen] = useState(false);

  const update = (key: keyof ContactFilterValues, value: string) => {
    const next = { ...filters, [key]: value === '__all__' ? '' : value };
    // Reset stage when pipeline changes
    if (key === 'pipeline') next.stage = '';
    onChange(next);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {/* Pipeline */}
        {options.pipelines.length > 0 && (
          <Select value={filters.pipeline || '__all__'} onValueChange={v => update('pipeline', v)}>
            <SelectTrigger className="h-8 w-[150px] text-xs bg-card">
              <SelectValue placeholder="Pipeline" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todas pipelines</SelectItem>
              {options.pipelines.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Stage */}
        {options.stages.length > 0 && (
          <Select value={filters.stage || '__all__'} onValueChange={v => update('stage', v)}>
            <SelectTrigger className="h-8 w-[150px] text-xs bg-card">
              <SelectValue placeholder="Etapa" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todas etapas</SelectItem>
              {options.stages.map(s => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* SDR */}
        {options.sdrs.length > 0 && (
          <Select value={filters.sdr || '__all__'} onValueChange={v => update('sdr', v)}>
            <SelectTrigger className="h-8 w-[130px] text-xs bg-card">
              <SelectValue placeholder="SDR" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos SDRs</SelectItem>
              {options.sdrs.map(s => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Closer */}
        {options.closers.length > 0 && (
          <Select value={filters.closer || '__all__'} onValueChange={v => update('closer', v)}>
            <SelectTrigger className="h-8 w-[130px] text-xs bg-card">
              <SelectValue placeholder="Closer" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos Closers</SelectItem>
              {options.closers.map(c => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Status */}
        <Select value={filters.status || '__all__'} onValueChange={v => update('status', v)}>
          <SelectTrigger className="h-8 w-[130px] text-xs bg-card">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos status</SelectItem>
            {statusOptions.map(s => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Date range */}
        <Select value={filters.dateRange || '__all__'} onValueChange={v => update('dateRange', v)}>
          <SelectTrigger className="h-8 w-[150px] text-xs bg-card">
            <SelectValue placeholder="Data criação" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Qualquer data</SelectItem>
            {dateRangeOptions.map(d => (
              <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Partnership — searchable */}
        <Popover open={partnerOpen} onOpenChange={setPartnerOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={partnerOpen}
              className="h-8 w-[180px] justify-between text-xs bg-card font-normal"
            >
              <span className="truncate">
                {!filters.partnerProduct
                  ? 'Parceria'
                  : filters.partnerProduct === '__any__'
                    ? '🤝 Qualquer parceria'
                    : filters.partnerProduct === '__incorporador__'
                      ? '🏗️ Incorporador'
                      : filters.partnerProduct === '__anticrise__'
                        ? '📉 Anticrise'
                        : filters.partnerProduct}
              </span>
              <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[220px] p-0" align="start">
            <Command>
              <CommandInput placeholder="Buscar produto..." className="h-8 text-xs" />
              <CommandList>
                <CommandEmpty>Nenhum produto encontrado.</CommandEmpty>
                <CommandGroup>
                  <CommandItem
                    value="__all__"
                    onSelect={() => { update('partnerProduct', '__all__'); setPartnerOpen(false); }}
                    className="text-xs"
                  >
                    <Check className={cn("mr-2 h-3 w-3", !filters.partnerProduct ? "opacity-100" : "opacity-0")} />
                    Sem filtro
                  </CommandItem>
                   <CommandItem
                    value="__any__"
                    onSelect={() => { update('partnerProduct', '__any__'); setPartnerOpen(false); }}
                    className="text-xs"
                  >
                    <Check className={cn("mr-2 h-3 w-3", filters.partnerProduct === '__any__' ? "opacity-100" : "opacity-0")} />
                    🤝 Qualquer parceria
                  </CommandItem>
                  <CommandItem
                    value="__incorporador__"
                    onSelect={() => { update('partnerProduct', '__incorporador__'); setPartnerOpen(false); }}
                    className="text-xs"
                  >
                    <Check className={cn("mr-2 h-3 w-3", filters.partnerProduct === '__incorporador__' ? "opacity-100" : "opacity-0")} />
                    🏗️ Incorporador
                  </CommandItem>
                  <CommandItem
                    value="__anticrise__"
                    onSelect={() => { update('partnerProduct', '__anticrise__'); setPartnerOpen(false); }}
                    className="text-xs"
                  >
                    <Check className={cn("mr-2 h-3 w-3", filters.partnerProduct === '__anticrise__' ? "opacity-100" : "opacity-0")} />
                    📉 Anticrise
                  </CommandItem>
                  {partnerProductOptions.map(p => (
                    <CommandItem
                      key={p}
                      value={p}
                      onSelect={() => { update('partnerProduct', p); setPartnerOpen(false); }}
                      className="text-xs"
                    >
                      <Check className={cn("mr-2 h-3 w-3", filters.partnerProduct === p ? "opacity-100" : "opacity-0")} />
                      {p}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {hasActiveFilters(filters) && (
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => onChange(emptyFilters)}>
            <X className="h-3 w-3 mr-1" />
            Limpar
          </Button>
        )}
      </div>

      {/* Result counter */}
      <p className="text-xs text-muted-foreground">
        {resultCount === totalCount
          ? `${totalCount} contatos`
          : `${resultCount} de ${totalCount} contatos`}
      </p>
    </div>
  );
};

export { emptyFilters };
export type { FilterOptions };
