import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ShoppingCart, Phone, User, Bell, Filter } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { R2ForaDoCarrinhoAttendee } from '@/hooks/useR2ForaDoCarrinhoData';

interface R2ForaDoCarrinhoListProps {
  attendees: R2ForaDoCarrinhoAttendee[];
  isLoading?: boolean;
}

const STATUS_FILTERS = [
  { value: 'all', label: 'Todos' },
  { value: 'Reembolso', label: 'Reembolso' },
  { value: 'Desistente', label: 'Desistente' },
  { value: 'Reprovado', label: 'Reprovado' },
  { value: 'Próxima Semana', label: 'Próxima Semana' },
  { value: 'Cancelado', label: 'Cancelado' },
];

export function R2ForaDoCarrinhoList({ attendees, isLoading }: R2ForaDoCarrinhoListProps) {
  const [statusFilter, setStatusFilter] = useState('all');

  const filteredAttendees = statusFilter === 'all' 
    ? attendees 
    : attendees.filter(a => a.r2_status_name === statusFilter);

  if (isLoading) {
    return <div className="flex justify-center py-8">Carregando...</div>;
  }

  if (attendees.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <ShoppingCart className="h-12 w-12 mb-4 opacity-50" />
        <p>Nenhum lead fora do carrinho na semana</p>
      </div>
    );
  }

  // Count by status
  const statusCounts = attendees.reduce((acc, att) => {
    acc[att.r2_status_name] = (acc[att.r2_status_name] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-4">
      {/* Status Filter Buttons */}
      <div className="flex flex-wrap items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        {STATUS_FILTERS.map((filter) => {
          const count = filter.value === 'all' 
            ? attendees.length 
            : statusCounts[filter.value] || 0;

          if (filter.value !== 'all' && count === 0) return null;

          return (
            <Button
              key={filter.value}
              variant={statusFilter === filter.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter(filter.value)}
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
              <TableHead>Data R2</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Motivo</TableHead>
              <TableHead>Closer</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAttendees.map((att) => (
              <TableRow 
                key={att.id}
                className={att.r2_status_name === 'Próxima Semana' ? 'bg-orange-50 dark:bg-orange-950/20' : ''}
              >
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium">
                      {format(new Date(att.scheduled_at), 'dd/MM/yyyy', { locale: ptBR })}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {format(new Date(att.scheduled_at), 'HH:mm', { locale: ptBR })}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">
                      {att.attendee_name || att.deal_name || 'Sem nome'}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2 font-mono text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    {att.attendee_phone || att.contact_phone || '-'}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Badge 
                      style={{ 
                        backgroundColor: att.r2_status_color,
                        color: 'white'
                      }}
                      className={att.r2_status_name === 'Próxima Semana' ? 'animate-pulse' : ''}
                    >
                      {att.r2_status_name === 'Próxima Semana' && (
                        <Bell className="h-3 w-3 mr-1" />
                      )}
                      {att.r2_status_name}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-sm text-muted-foreground max-w-[200px] truncate block">
                    {att.motivo || '-'}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {att.closer_color && (
                      <div 
                        className="w-3 h-3 rounded-full flex-shrink-0" 
                        style={{ backgroundColor: att.closer_color }}
                      />
                    )}
                    <span className="truncate">{att.closer_name || '-'}</span>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {filteredAttendees.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          Nenhum lead encontrado com esse filtro
        </div>
      )}
    </div>
  );
}
