import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, Phone, User, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { R2CarrinhoAttendee } from '@/hooks/useR2CarrinhoData';

interface R2AgendadasListProps {
  attendees: R2CarrinhoAttendee[];
  isLoading?: boolean;
  onSelectAttendee?: (attendee: R2CarrinhoAttendee) => void;
}

export function R2AgendadasList({ attendees, isLoading, onSelectAttendee }: R2AgendadasListProps) {
  if (isLoading) {
    return <div className="flex justify-center py-8">Carregando...</div>;
  }

  if (attendees.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Calendar className="h-12 w-12 mb-4 opacity-50" />
        <p>Nenhuma R2 agendada na semana</p>
      </div>
    );
  }

  // Group by day
  const byDay = attendees.reduce((acc, att) => {
    const day = format(new Date(att.scheduled_at), 'yyyy-MM-dd');
    if (!acc[day]) acc[day] = [];
    acc[day].push(att);
    return acc;
  }, {} as Record<string, R2CarrinhoAttendee[]>);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="text-lg px-3 py-1">
          {attendees.length} agendadas
        </Badge>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data/Hora</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Closer</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Object.entries(byDay).map(([day, dayAttendees]) => (
              <>
                <TableRow key={`header-${day}`} className="bg-muted/50">
                  <TableCell colSpan={5} className="font-semibold">
                    {format(new Date(day), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                    <Badge variant="outline" className="ml-2">{dayAttendees.length}</Badge>
                  </TableCell>
                </TableRow>
                {dayAttendees.map((att) => (
                  <TableRow 
                    key={att.id}
                    className="cursor-pointer hover:bg-muted/30"
                    onClick={() => onSelectAttendee?.(att)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">
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
                    <TableCell>
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300">
                        Agendada
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
