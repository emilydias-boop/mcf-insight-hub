import { useMemo, useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Search, X } from 'lucide-react';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';
import { DatePickerCustom } from '@/components/ui/DatePickerCustom';
import { CloserLead } from '@/hooks/useCloserDetailData';

type DatePreset = 'all' | 'today' | 'week' | 'month' | 'custom';

interface CloserLeadsFiltersProps {
  leads: CloserLead[];
  onFilter: (filtered: CloserLead[]) => void;
  showR1Sdr?: boolean;
}

export function CloserLeadsFilters({ leads, onFilter, showR1Sdr = false }: CloserLeadsFiltersProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sdrFilter, setSdrFilter] = useState<string>('all');
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [customStart, setCustomStart] = useState<Date | undefined>();
  const [customEnd, setCustomEnd] = useState<Date | undefined>();

  // Extract unique statuses
  const statuses = useMemo(() => {
    const set = new Set<string>();
    leads.forEach(l => set.add(l.status));
    return Array.from(set).sort();
  }, [leads]);

  // Extract unique SDR names
  const sdrNames = useMemo(() => {
    const set = new Set<string>();
    leads.forEach(l => {
      if (showR1Sdr) {
        if (l.r1_sdr_name) set.add(l.r1_sdr_name);
        if (l.booked_by_name) set.add(l.booked_by_name);
      } else {
        if (l.booked_by_name) set.add(l.booked_by_name);
      }
    });
    return Array.from(set).sort();
  }, [leads, showR1Sdr]);

  const statusLabel = (s: string) => {
    switch (s) {
      case 'contract_paid': return 'Contrato Pago';
      case 'completed': return 'Realizada';
      case 'no_show': return 'No-Show';
      case 'scheduled': return 'Agendada';
      case 'cancelled': return 'Cancelada';
      default: return s;
    }
  };

  // Apply filters
  useEffect(() => {
    let filtered = [...leads];

    // Text search
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      filtered = filtered.filter(l =>
        l.contact_name?.toLowerCase().includes(q) ||
        l.contact_email?.toLowerCase().includes(q) ||
        l.contact_phone?.includes(q) ||
        l.deal_name?.toLowerCase().includes(q)
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(l => l.status === statusFilter);
    }

    // SDR filter
    if (sdrFilter !== 'all') {
      filtered = filtered.filter(l =>
        l.booked_by_name === sdrFilter || l.r1_sdr_name === sdrFilter
      );
    }

    // Date filter
    if (datePreset !== 'all') {
      const now = new Date();
      let rangeStart: Date;
      let rangeEnd: Date;

      if (datePreset === 'today') {
        rangeStart = startOfDay(now);
        rangeEnd = endOfDay(now);
      } else if (datePreset === 'week') {
        rangeStart = startOfWeek(now, { weekStartsOn: 1 });
        rangeEnd = endOfWeek(now, { weekStartsOn: 1 });
      } else if (datePreset === 'month') {
        rangeStart = startOfMonth(now);
        rangeEnd = endOfMonth(now);
      } else if (datePreset === 'custom' && customStart && customEnd) {
        rangeStart = startOfDay(customStart);
        rangeEnd = endOfDay(customEnd);
      } else {
        onFilter(filtered);
        return;
      }

      filtered = filtered.filter(l => {
        const d = parseISO(l.scheduled_at);
        return isWithinInterval(d, { start: rangeStart, end: rangeEnd });
      });
    }

    onFilter(filtered);
  }, [search, statusFilter, sdrFilter, datePreset, customStart, customEnd, leads, onFilter]);

  const hasActiveFilters = search || statusFilter !== 'all' || sdrFilter !== 'all' || datePreset !== 'all';

  const clearAll = () => {
    setSearch('');
    setStatusFilter('all');
    setSdrFilter('all');
    setDatePreset('all');
    setCustomStart(undefined);
    setCustomEnd(undefined);
  };

  return (
    <div className="space-y-3 mb-4">
      {/* Row 1: Search + Status + SDR */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-[320px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar nome, email, telefone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px] h-9">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Status</SelectItem>
            {statuses.map(s => (
              <SelectItem key={s} value={s}>{statusLabel(s)}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {sdrNames.length > 0 && (
          <Select value={sdrFilter} onValueChange={setSdrFilter}>
            <SelectTrigger className="w-[180px] h-9">
              <SelectValue placeholder="SDR" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos SDRs</SelectItem>
              {sdrNames.map(n => (
                <SelectItem key={n} value={n}>{n}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearAll} className="h-9 px-2 text-muted-foreground">
            <X className="h-4 w-4 mr-1" />
            Limpar
          </Button>
        )}
      </div>

      {/* Row 2: Date presets */}
      <div className="flex flex-wrap items-center gap-2">
        {(['all', 'today', 'week', 'month', 'custom'] as DatePreset[]).map(p => (
          <Button
            key={p}
            variant={datePreset === p ? 'default' : 'outline'}
            size="sm"
            className="h-8"
            onClick={() => setDatePreset(p)}
          >
            {p === 'all' ? 'Todos' : p === 'today' ? 'Hoje' : p === 'week' ? 'Semana' : p === 'month' ? 'Mês' : 'Custom'}
          </Button>
        ))}

        {datePreset === 'custom' && (
          <div className="flex items-center gap-2">
            <DatePickerCustom
              mode="single"
              selected={customStart}
              onSelect={(d) => setCustomStart(d as Date)}
              placeholder="Início"
            />
            <span className="text-muted-foreground">—</span>
            <DatePickerCustom
              mode="single"
              selected={customEnd}
              onSelect={(d) => setCustomEnd(d as Date)}
              placeholder="Fim"
            />
          </div>
        )}
      </div>
    </div>
  );
}
