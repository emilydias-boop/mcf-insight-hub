import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarX, Calendar, Phone, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { R2CarrinhoAttendee } from '@/hooks/useR2CarrinhoData';

interface R2NoShowListProps {
  attendees: R2CarrinhoAttendee[];
  isLoading?: boolean;
  onReschedule?: (meetingId: string) => void;
}

export function R2NoShowList({ attendees, isLoading, onReschedule }: R2NoShowListProps) {
  if (isLoading) {
    return <div className="flex justify-center py-8">Carregando...</div>;
  }

  if (attendees.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <CalendarX className="h-12 w-12 mb-4 opacity-50" />
        <p>Nenhum no-show na semana</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Badge variant="destructive" className="text-lg px-3 py-1">
          {attendees.length} no-shows
        </Badge>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data/Hora Original</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Closer</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {attendees.map((att) => (
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
                  <div className="flex justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onReschedule?.(att.meeting_id)}
                    >
                      <Calendar className="h-4 w-4 mr-2" />
                      Remarcar R2
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
