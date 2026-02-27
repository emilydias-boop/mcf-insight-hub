import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import type { ThermalStatus } from '@/hooks/useContactsEnriched';

export interface ContactFilterValues {
  pipeline: string;
  stage: string;
  sdr: string;
  closer: string;
  status: string;
  dateRange: string;
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
};

const hasActiveFilters = (f: ContactFilterValues) =>
  Object.values(f).some(v => v !== '');

export const ContactFilters = ({ filters, onChange, options, resultCount, totalCount }: ContactFiltersProps) => {
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
