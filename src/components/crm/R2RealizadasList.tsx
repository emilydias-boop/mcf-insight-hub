import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CheckCircle, Phone, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { R2CarrinhoAttendee } from '@/hooks/useR2CarrinhoData';

interface R2RealizadasListProps {
  attendees: R2CarrinhoAttendee[];
  isLoading?: boolean;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  statusOptions: Array<{ id: string; name: string; color: string }>;
}

export function R2RealizadasList({ 
  attendees, 
  isLoading, 
  statusFilter, 
  onStatusFilterChange,
  statusOptions 
}: R2RealizadasListProps) {
  // Filter by status if selected
  const filteredAttendees = statusFilter === 'all' 
    ? attendees 
    : attendees.filter(att => att.r2_status_id === statusFilter);

  // Count by status
  const statusCounts = attendees.reduce((acc, att) => {
    const statusId = att.r2_status_id || 'sem_status';
    acc[statusId] = (acc[statusId] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  if (isLoading) {
    return <div className="flex justify-center py-8">Carregando...</div>;
  }

  if (attendees.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <CheckCircle className="h-12 w-12 mb-4 opacity-50" />
        <p>Nenhuma R2 realizada na semana</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary" className="text-lg px-3 py-1">
            {attendees.length} realizadas
          </Badge>
          {statusOptions.map(opt => (
            <Badge 
              key={opt.id} 
              variant="outline"
              style={{ 
                backgroundColor: `${opt.color}20`,
                borderColor: opt.color,
                color: opt.color 
              }}
            >
              {opt.name}: {statusCounts[opt.id] || 0}
            </Badge>
          ))}
        </div>
        <Select value={statusFilter} onValueChange={onStatusFilterChange}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filtrar por status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {statusOptions.map(opt => (
              <SelectItem key={opt.id} value={opt.id}>
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: opt.color }} 
                  />
                  {opt.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data/Hora</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Status Final</TableHead>
              <TableHead>Closer</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAttendees.map((att) => {
              const statusOpt = statusOptions.find(s => s.id === att.r2_status_id);
              
              return (
                <TableRow key={att.id}>
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
                      <div className="flex flex-col">
                        <span className="font-medium">{att.attendee_name || att.deal_name || 'Sem nome'}</span>
                        {att.partner_name && (
                          <span className="text-xs text-muted-foreground">+ {att.partner_name}</span>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 font-mono text-sm">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      {att.attendee_phone || att.contact_phone || '-'}
                    </div>
                  </TableCell>
                  <TableCell>
                    {statusOpt ? (
                      <Badge
                        style={{ 
                          backgroundColor: `${statusOpt.color}20`,
                          borderColor: statusOpt.color,
                          color: statusOpt.color 
                        }}
                      >
                        {statusOpt.name}
                      </Badge>
                    ) : (
                      <Badge variant="outline">Sem status</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {att.closer_color && (
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: att.closer_color }}
                        />
                      )}
                      {att.closer_name || '-'}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
