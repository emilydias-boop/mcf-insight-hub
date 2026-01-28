import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, Phone, User, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
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
                <div className="divide-y">
                  {sortedAttendees.map((att) => {
                    const statusInfo = STATUS_LABELS[att.status] || STATUS_LABELS.scheduled;
                    
                    return (
                      <div
                        key={att.id}
                        className="p-3 hover:bg-muted/30 cursor-pointer transition-colors"
                        onClick={() => onSelectAttendee?.(att)}
                      >
                        {/* Linha 1: Horário + Nome + Telefone */}
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5 text-primary font-semibold min-w-[60px]">
                            <Clock className="h-4 w-4" />
                            <span>{format(new Date(att.scheduled_at), 'HH:mm')}</span>
                          </div>
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <User className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="font-medium truncate">
                              {att.attendee_name || att.deal_name || 'Sem nome'}
                            </span>
                            {att.partner_name && (
                              <span className="text-xs text-muted-foreground">+ {att.partner_name}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 font-mono text-sm text-muted-foreground">
                            <Phone className="h-3.5 w-3.5" />
                            <span>{att.attendee_phone || att.contact_phone || '-'}</span>
                          </div>
                        </div>
                        
                        {/* Linha 2: Closer + Status */}
                        <div className="flex items-center justify-between mt-1.5 pl-[72px]">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            {att.closer_color && (
                              <div 
                                className="w-2.5 h-2.5 rounded-full" 
                                style={{ backgroundColor: att.closer_color }}
                              />
                            )}
                            <span>Closer: {att.closer_name || '-'}</span>
                          </div>
                          <Badge 
                            variant="outline" 
                            className={cn('text-xs', statusInfo.className)}
                          >
                            {statusInfo.label}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
