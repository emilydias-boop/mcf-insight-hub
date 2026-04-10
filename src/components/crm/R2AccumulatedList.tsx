import { useState, useMemo } from 'react';
import { AlertTriangle, Phone, User, Calendar, Filter, CalendarPlus, ShoppingCart, Loader2, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { R2AccumulatedLead } from '@/hooks/useR2AccumulatedLeads';

interface R2AccumulatedListProps {
  leads: R2AccumulatedLead[];
  isLoading?: boolean;
  onSchedule?: (lead: R2AccumulatedLead) => void;
  onEncaixar?: (lead: R2AccumulatedLead) => void;
  isEncaixando?: boolean;
  encaixandoId?: string | null;
}

const TYPE_FILTERS = [
  { value: 'all', label: 'Todos' },
  { value: 'proxima_semana', label: '📅 Próxima Semana' },
  { value: 'sem_r2', label: '⚠️ Sem R2' },
];

const PAGE_SIZE_OPTIONS = ['20', '50', '100'];

export function R2AccumulatedList({ leads, isLoading, onSchedule, onEncaixar, isEncaixando, encaixandoId }: R2AccumulatedListProps) {
  const [typeFilter, setTypeFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const searchFiltered = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    let result = leads;

    if (q) {
      result = result.filter(l =>
        (l.attendee_name || '').toLowerCase().includes(q) ||
        (l.deal_name || '').toLowerCase().includes(q) ||
        (l.attendee_phone || '').toLowerCase().includes(q) ||
        (l.contact_phone || '').toLowerCase().includes(q) ||
        (l.contact_email || '').toLowerCase().includes(q)
      );
    }

    return result;
  }, [leads, searchQuery]);

  const filteredLeads = useMemo(() => {
    return typeFilter === 'all'
      ? searchFiltered
      : searchFiltered.filter(l => l.origin_type === typeFilter);
  }, [searchFiltered, typeFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredLeads.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedLeads = filteredLeads.slice((safePage - 1) * pageSize, safePage * pageSize);

  const proximaSemanaCount = searchFiltered.filter(l => l.origin_type === 'proxima_semana').length;
  const semR2Count = searchFiltered.filter(l => l.origin_type === 'sem_r2').length;

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const handleTypeFilterChange = (value: string) => {
    setTypeFilter(value);
    setCurrentPage(1);
  };

  const handlePageSizeChange = (value: string) => {
    setPageSize(Number(value));
    setCurrentPage(1);
  };

  const canEncaixar = (lead: R2AccumulatedLead) => !!lead.meeting_id;

  if (isLoading) {
    return <div className="flex justify-center py-8">Carregando...</div>;
  }

  if (leads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <AlertTriangle className="h-12 w-12 mb-4 opacity-50" />
        <p>Nenhum lead acumulado de semanas anteriores</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search + Type Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, telefone ou email..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          {TYPE_FILTERS.map((filter) => {
            const count = filter.value === 'all'
              ? searchFiltered.length
              : filter.value === 'proxima_semana'
                ? proximaSemanaCount
                : semR2Count;

            if (filter.value !== 'all' && count === 0) return null;

            return (
              <Button
                key={filter.value}
                variant={typeFilter === filter.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleTypeFilterChange(filter.value)}
                className="flex items-center gap-1"
              >
                {filter.label}
                <span className="text-xs bg-background/20 px-1.5 py-0.5 rounded-full">
                  {count}
                </span>
              </Button>
            );
          })}
        </div>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tipo</TableHead>
              <TableHead>Semana Original</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Closer</TableHead>
              <TableHead>Status R2</TableHead>
              <TableHead className="text-right">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedLeads.map((lead) => (
              <TableRow
                key={lead.id}
                className={lead.origin_type === 'proxima_semana'
                  ? 'bg-orange-50 dark:bg-orange-950/20'
                  : 'bg-yellow-50 dark:bg-yellow-950/20'
                }
              >
                <TableCell>
                  <Badge
                    variant={lead.origin_type === 'proxima_semana' ? 'default' : 'destructive'}
                    className={lead.origin_type === 'proxima_semana'
                      ? 'bg-orange-500 hover:bg-orange-600'
                      : ''
                    }
                  >
                    {lead.origin_type === 'proxima_semana' ? '📅 Próx. Semana' : '⚠️ Sem R2'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1 text-sm">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                    {lead.origin_week_label}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">
                      {lead.attendee_name || lead.deal_name || 'Sem nome'}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2 font-mono text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    {lead.attendee_phone || lead.contact_phone || '-'}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {lead.closer_color && (
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: lead.closer_color }}
                      />
                    )}
                    <span className="truncate">{lead.closer_name || '-'}</span>
                  </div>
                </TableCell>
                <TableCell>
                  {lead.r2_status_name ? (
                    <Badge
                      style={{
                        backgroundColor: lead.r2_status_color || undefined,
                        color: 'white',
                      }}
                    >
                      {lead.r2_status_name}
                    </Badge>
                  ) : (
                    <span className="text-sm text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {canEncaixar(lead) ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onEncaixar?.(lead)}
                      disabled={isEncaixando && encaixandoId === lead.id}
                      className="flex items-center gap-1"
                    >
                      {isEncaixando && encaixandoId === lead.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <ShoppingCart className="h-3.5 w-3.5" />
                      )}
                      Encaixar
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onSchedule?.(lead)}
                      className="flex items-center gap-1"
                    >
                      <CalendarPlus className="h-3.5 w-3.5" />
                      Agendar R2
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {filteredLeads.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          Nenhum lead encontrado com esse filtro
        </div>
      )}

      {/* Pagination */}
      {filteredLeads.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
          <div className="text-muted-foreground">
            {filteredLeads.length} lead{filteredLeads.length !== 1 ? 's' : ''} encontrado{filteredLeads.length !== 1 ? 's' : ''}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Por página:</span>
              <Select value={String(pageSize)} onValueChange={handlePageSizeChange}>
                <SelectTrigger className="w-[70px] h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZE_OPTIONS.map(opt => (
                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={safePage <= 1}
              >
                <ChevronLeft className="h-4 w-4" />
                Anterior
              </Button>
              <span className="text-muted-foreground whitespace-nowrap">
                Página {safePage} de {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
              >
                Próximo
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
