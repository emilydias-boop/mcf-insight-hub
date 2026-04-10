import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AlertTriangle, Phone, User, Calendar, Filter, CalendarPlus, ShoppingCart, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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

export function R2AccumulatedList({ leads, isLoading, onSchedule, onEncaixar, isEncaixando, encaixandoId }: R2AccumulatedListProps) {
  const [typeFilter, setTypeFilter] = useState('all');

  const filteredLeads = typeFilter === 'all'
    ? leads
    : leads.filter(l => l.origin_type === typeFilter);

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

  const proximaSemanaCount = leads.filter(l => l.origin_type === 'proxima_semana').length;
  const semR2Count = leads.filter(l => l.origin_type === 'sem_r2').length;

  // Check if a lead has an existing meeting (can be encaixado directly)
  const canEncaixar = (lead: R2AccumulatedLead) => !!lead.meeting_id;

  return (
    <div className="space-y-4">
      {/* Type Filter Buttons */}
      <div className="flex flex-wrap items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        {TYPE_FILTERS.map((filter) => {
          const count = filter.value === 'all'
            ? leads.length
            : filter.value === 'proxima_semana'
              ? proximaSemanaCount
              : semR2Count;

          if (filter.value !== 'all' && count === 0) return null;

          return (
            <Button
              key={filter.value}
              variant={typeFilter === filter.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTypeFilter(filter.value)}
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
            {filteredLeads.map((lead) => (
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
    </div>
  );
}
