import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { R2CarrinhoAttendee } from '@/hooks/useR2CarrinhoData';
import { cn } from '@/lib/utils';

interface R2AgendadasListProps {
  attendees: R2CarrinhoAttendee[];
  isLoading?: boolean;
  onSelectAttendee?: (attendee: R2CarrinhoAttendee) => void;
}

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  scheduled: { label: 'Agendada', className: 'bg-blue-500 text-white border-blue-500' },
  invited: { label: 'Convidado', className: 'bg-purple-500 text-white border-purple-500' },
  completed: { label: 'Realizada', className: 'bg-green-500 text-white border-green-500' },
  no_show: { label: 'No-show', className: 'bg-red-500 text-white border-red-500' },
  contract_paid: { label: 'Contrato Pago', className: 'bg-emerald-600 text-white border-emerald-600' },
  refunded: { label: 'Reembolsado', className: 'bg-orange-500 text-white border-orange-500' },
  pending: { label: 'Pendente', className: 'bg-yellow-500 text-black border-yellow-500' },
};

function renderStatusCell(att: R2CarrinhoAttendee) {
  const isContractPaid = att.status === 'contract_paid' || att.meeting_status === 'contract_paid';
  const isAprovado = att.r2_status_name?.toLowerCase().includes('aprovado');
  
  if (isContractPaid) {
    return (
      <div className="flex items-center justify-end gap-2">
        <span className="text-emerald-600 text-sm font-medium">
          CP {att.contract_paid_at ? format(new Date(att.contract_paid_at), 'dd/MM') : ''}
        </span>
        {isAprovado && (
          <Badge className="bg-emerald-500 text-white text-xs">Aprovado</Badge>
        )}
      </div>
    );
  }
  
  const statusInfo = STATUS_LABELS[att.status] || STATUS_LABELS[att.meeting_status] || STATUS_LABELS.scheduled;
  
  return (
    <div className="flex items-center justify-end gap-2">
      <Badge variant="outline" className={cn('text-xs', statusInfo.className)}>
        {statusInfo.label}
      </Badge>
      {isAprovado && (
        <span className="text-emerald-500 font-medium">✓</span>
      )}
    </div>
  );
}

export function R2AgendadasList({ attendees, isLoading, onSelectAttendee }: R2AgendadasListProps) {
  if (isLoading) {
    return <div className="flex justify-center py-8">Carregando...</div>;
  }

  if (attendees.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Calendar className="h-12 w-12 mb-4 opacity-50" />
        <p>Nenhuma R2 encontrada na semana</p>
      </div>
    );
  }

  // Group by day (using scheduled_at = meeting date)
  const byDay = attendees.reduce((acc, att) => {
    const day = format(new Date(att.scheduled_at), 'yyyy-MM-dd');
    if (!acc[day]) acc[day] = [];
    acc[day].push(att);
    return acc;
  }, {} as Record<string, R2CarrinhoAttendee[]>);

  // Sort days chronologically
  const sortedDays = Object.keys(byDay).sort();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="text-lg px-3 py-1">
          {attendees.length} R2s na semana
        </Badge>
      </div>

      <div className="space-y-4">
        {sortedDays.map((day) => {
          const dayAttendees = byDay[day];
          // Sort by time within the day
          const sortedAttendees = [...dayAttendees].sort((a, b) => 
            new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
          );

          return (
            <Card key={day}>
              <CardHeader className="py-3 px-4 bg-muted/50">
                <div className="flex items-center justify-between">
                  <span className="font-semibold capitalize">
                    {format(new Date(day), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                  </span>
                  <Badge variant="outline">{dayAttendees.length}</Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[80px]">Horário</TableHead>
                      <TableHead>Nome Lead</TableHead>
                      <TableHead>Closer R2</TableHead>
                      <TableHead className="w-[90px]">Dia R1</TableHead>
                      <TableHead className="text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedAttendees.map((att) => (
                      <TableRow
                        key={att.id}
                        className="cursor-pointer hover:bg-muted/30"
                        onClick={() => onSelectAttendee?.(att)}
                      >
                        <TableCell className="font-mono font-medium text-primary">
                          {format(new Date(att.scheduled_at), 'HH:mm')}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium truncate max-w-[200px]">
                              {att.attendee_name || att.deal_name || 'Sem nome'}
                            </span>
                            {att.partner_name && (
                              <span className="text-xs text-muted-foreground">+ {att.partner_name}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {att.closer_color && (
                              <div 
                                className="w-2.5 h-2.5 rounded-full shrink-0" 
                                style={{ backgroundColor: att.closer_color }}
                              />
                            )}
                            <span className="truncate">{att.closer_name || '-'}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm text-muted-foreground">
                          {att.r1_date ? format(new Date(att.r1_date), 'dd/MM') : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          {renderStatusCell(att)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
