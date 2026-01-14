import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Eye, MoreHorizontal, CheckCircle, XCircle, AlertTriangle, ExternalLink, ArrowRightLeft } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { MeetingSlot, useUpdateMeetingStatus, useCancelMeeting } from '@/hooks/useAgendaData';
import { cn } from '@/lib/utils';

interface MeetingsListProps {
  meetings: MeetingSlot[];
  isLoading: boolean;
  onViewDeal: (dealId: string) => void;
}

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: typeof CheckCircle }> = {
  scheduled: { label: 'Agendada', variant: 'default', icon: CheckCircle },
  rescheduled: { label: 'Reagendada', variant: 'secondary', icon: AlertTriangle },
  completed: { label: 'Realizada', variant: 'outline', icon: CheckCircle },
  no_show: { label: 'No-show', variant: 'destructive', icon: XCircle },
  canceled: { label: 'Cancelada', variant: 'outline', icon: XCircle },
  contract_paid: { label: 'Contrato Pago', variant: 'default', icon: CheckCircle },
};

export function MeetingsList({ meetings, isLoading, onViewDeal }: MeetingsListProps) {
  const updateStatus = useUpdateMeetingStatus();
  const cancelMeeting = useCancelMeeting();

  const handleUpdateStatus = (meetingId: string, status: string) => {
    updateStatus.mutate({ meetingId, status });
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (meetings.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Nenhuma reunião encontrada
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead>Data/Hora</TableHead>
            <TableHead>Lead</TableHead>
            <TableHead>Closer</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {meetings.map(meeting => {
            const statusConfig = STATUS_CONFIG[meeting.status] || STATUS_CONFIG.scheduled;
            const StatusIcon = statusConfig.icon;

            return (
              <TableRow key={meeting.id}>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium">
                      {format(parseISO(meeting.scheduled_at), "dd/MM/yyyy", { locale: ptBR })}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {format(parseISO(meeting.scheduled_at), "HH:mm")}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-0.5">
                    {meeting.attendees?.length ? (
                      <>
                        {meeting.attendees.map((att, idx) => (
                          <div key={att.id} className="flex items-center gap-1.5">
                            <span className={idx === 0 ? "font-medium" : "text-sm text-muted-foreground"}>
                              {att.attendee_name || att.contact?.name || 'Lead'}
                            </span>
                            {att.is_partner && (
                              <Badge variant="outline" className="text-[10px] px-1 py-0">Sócio</Badge>
                            )}
                            {!att.is_partner && att.parent_attendee_id && (
                              <Badge variant="outline" className="text-[10px] px-1 py-0 bg-orange-100 text-orange-700 border-orange-300 gap-0.5">
                                <ArrowRightLeft className="h-2.5 w-2.5" />
                                Remanej.
                              </Badge>
                            )}
                          </div>
                        ))}
                        {(meeting.attendees[0]?.attendee_phone || meeting.attendees[0]?.contact?.phone) && (
                          <span className="text-sm text-muted-foreground">
                            {meeting.attendees[0].attendee_phone || meeting.attendees[0].contact?.phone}
                          </span>
                        )}
                      </>
                    ) : (
                      <>
                        <span className="font-medium">
                          {meeting.deal?.contact?.name || meeting.deal?.name || 'Sem lead'}
                        </span>
                        {meeting.deal?.contact?.phone && (
                          <span className="text-sm text-muted-foreground">
                            {meeting.deal.contact.phone}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <span className="font-medium">{meeting.closer?.name || '-'}</span>
                </TableCell>
                <TableCell>
                  <Badge variant={statusConfig.variant} className="gap-1">
                    <StatusIcon className="h-3 w-3" />
                    {statusConfig.label}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {meeting.deal_id && (
                        <DropdownMenuItem onClick={() => onViewDeal(meeting.deal_id!)}>
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Ver negócio
                        </DropdownMenuItem>
                      )}
                      {meeting.status === 'scheduled' || meeting.status === 'rescheduled' ? (
                        <>
                          <DropdownMenuItem onClick={() => handleUpdateStatus(meeting.id, 'completed')}>
                            <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                            Marcar como realizada
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleUpdateStatus(meeting.id, 'no_show')}>
                            <AlertTriangle className="h-4 w-4 mr-2 text-yellow-500" />
                            Marcar como no-show
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => cancelMeeting.mutate(meeting.id)}
                            className="text-destructive"
                          >
                            <XCircle className="h-4 w-4 mr-2" />
                            Cancelar reunião
                          </DropdownMenuItem>
                        </>
                      ) : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
