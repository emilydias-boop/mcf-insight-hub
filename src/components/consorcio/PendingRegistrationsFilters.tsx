import { useMemo } from 'react';
import { format } from 'date-fns';
import { Search, X, Calendar as CalendarIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import type { EnrichedPendingRegistration } from '@/hooks/useConsorcioPendingRegistrations';

export type DatePreset = 'all' | 'today' | 'week' | 'month' | 'custom';

export interface PendingFiltersState {
  search: string;
  datePreset: DatePreset;
  dateFrom: Date | null;
  dateTo: Date | null;
  valorMin: string;
  valorMax: string;
  parcelasMin: string;
  parcelasMax: string;
  closer: string;
  origem: string;
}

export const defaultPendingFilters: PendingFiltersState = {
  search: '',
  datePreset: 'all',
  dateFrom: null,
  dateTo: null,
  valorMin: '',
  valorMax: '',
  parcelasMin: '',
  parcelasMax: '',
  closer: '__all__',
  origem: '__all__',
};

interface Props {
  filters: PendingFiltersState;
  onChange: (f: PendingFiltersState) => void;
  registrations: EnrichedPendingRegistration[];
}

export function PendingRegistrationsFilters({ filters, onChange, registrations }: Props) {
  const closers = useMemo(() => {
    const set = new Set<string>();
    registrations.forEach((r) => r.closer_name && set.add(r.closer_name));
    return Array.from(set).sort();
  }, [registrations]);

  const origens = useMemo(() => {
    const set = new Set<string>();
    registrations.forEach((r) => r.origem_label && set.add(r.origem_label));
    return Array.from(set).sort();
  }, [registrations]);

  const update = (patch: Partial<PendingFiltersState>) => onChange({ ...filters, ...patch });

  const hasActive =
    filters.search ||
    filters.datePreset !== 'all' ||
    filters.valorMin ||
    filters.valorMax ||
    filters.parcelasMin ||
    filters.parcelasMax ||
    filters.closer !== '__all__' ||
    filters.origem !== '__all__';

  return (
    <div className="mb-4 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, valor, origem, closer..."
            value={filters.search}
            onChange={(e) => update({ search: e.target.value })}
            className="pl-8 h-9"
          />
        </div>

        <Select value={filters.datePreset} onValueChange={(v: DatePreset) => update({ datePreset: v })}>
          <SelectTrigger className="h-9 w-[150px]">
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todo o período</SelectItem>
            <SelectItem value="today">Hoje</SelectItem>
            <SelectItem value="week">Últimos 7 dias</SelectItem>
            <SelectItem value="month">Este mês</SelectItem>
            <SelectItem value="custom">Personalizado</SelectItem>
          </SelectContent>
        </Select>

        {filters.datePreset === 'custom' && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn('h-9 justify-start gap-2', !filters.dateFrom && 'text-muted-foreground')}>
                <CalendarIcon className="h-4 w-4" />
                {filters.dateFrom && filters.dateTo
                  ? `${format(filters.dateFrom, 'dd/MM')} – ${format(filters.dateTo, 'dd/MM')}`
                  : 'Selecionar datas'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="range"
                selected={{ from: filters.dateFrom || undefined, to: filters.dateTo || undefined }}
                onSelect={(range) => update({ dateFrom: range?.from || null, dateTo: range?.to || null })}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>
        )}

        <Select value={filters.closer} onValueChange={(v) => update({ closer: v })}>
          <SelectTrigger className="h-9 w-[180px]">
            <SelectValue placeholder="Closer" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos os closers</SelectItem>
            {closers.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.origem} onValueChange={(v) => update({ origem: v })}>
          <SelectTrigger className="h-9 w-[180px]">
            <SelectValue placeholder="Origem" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todas as origens</SelectItem>
            {origens.map((o) => (
              <SelectItem key={o} value={o}>{o}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasActive && (
          <Button variant="ghost" size="sm" className="h-9" onClick={() => onChange(defaultPendingFilters)}>
            <X className="h-4 w-4 mr-1" /> Limpar
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Valor da cota:</span>
        <Input
          type="number"
          placeholder="Mín"
          value={filters.valorMin}
          onChange={(e) => update({ valorMin: e.target.value })}
          className="h-8 w-28"
        />
        <Input
          type="number"
          placeholder="Máx"
          value={filters.valorMax}
          onChange={(e) => update({ valorMax: e.target.value })}
          className="h-8 w-28"
        />
        <span className="text-xs text-muted-foreground ml-2">Parcelas:</span>
        <Input
          type="number"
          placeholder="Mín"
          value={filters.parcelasMin}
          onChange={(e) => update({ parcelasMin: e.target.value })}
          className="h-8 w-20"
        />
        <Input
          type="number"
          placeholder="Máx"
          value={filters.parcelasMax}
          onChange={(e) => update({ parcelasMax: e.target.value })}
          className="h-8 w-20"
        />
      </div>
    </div>
  );
}

export function applyPendingFilters(
  registrations: EnrichedPendingRegistration[],
  f: PendingFiltersState,
): EnrichedPendingRegistration[] {
  let from: Date | null = null;
  let to: Date | null = null;
  const now = new Date();
  if (f.datePreset === 'today') {
    from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  } else if (f.datePreset === 'week') {
    from = new Date(now);
    from.setDate(from.getDate() - 6);
    from.setHours(0, 0, 0, 0);
    to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  } else if (f.datePreset === 'month') {
    from = new Date(now.getFullYear(), now.getMonth(), 1);
    to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  } else if (f.datePreset === 'custom') {
    from = f.dateFrom;
    to = f.dateTo ? new Date(f.dateTo.getFullYear(), f.dateTo.getMonth(), f.dateTo.getDate(), 23, 59, 59) : null;
  }

  const q = f.search.trim().toLowerCase();
  const vMin = f.valorMin ? Number(f.valorMin) : null;
  const vMax = f.valorMax ? Number(f.valorMax) : null;
  const pMin = f.parcelasMin ? Number(f.parcelasMin) : null;
  const pMax = f.parcelasMax ? Number(f.parcelasMax) : null;

  return registrations.filter((r) => {
    // Date filter (data solicitada = aceite_date || created_at)
    if (from || to) {
      const base = r.aceite_date
        ? new Date(r.aceite_date + 'T00:00:00')
        : new Date(r.created_at);
      if (from && base < from) return false;
      if (to && base > to) return false;
    }

    const valor = Number(r.valor_credito) || 0;
    if (vMin != null && valor < vMin) return false;
    if (vMax != null && valor > vMax) return false;

    const np = r.parcelas_empresa?.length || 0;
    if (pMin != null && np < pMin) return false;
    if (pMax != null && np > pMax) return false;

    if (f.closer !== '__all__' && (r.closer_name || '') !== f.closer) return false;
    if (f.origem !== '__all__' && (r.origem_label || '') !== f.origem) return false;

    if (q) {
      const nome = (r.tipo_pessoa === 'pf' ? r.nome_completo : r.razao_social) || '';
      const haystack = [
        nome,
        r.cpf,
        r.cnpj,
        r.closer_name,
        r.origem_label,
        String(valor),
        valor.toFixed(2),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }

    return true;
  });
}