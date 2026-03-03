import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MoreHorizontal, CheckCircle, XCircle, AlertTriangle, ExternalLink, ArrowRightLeft } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { MeetingSlot, useUpdateMeetingStatus, useCancelMeeting } from '@/hooks/useAgendaData';
import { cn } from '@/lib/utils';
import { useMemo } from 'react';

interface MeetingsListProps {
  meetings: MeetingSlot[];
  isLoading: boolean;
  onViewDeal: (dealId: string) => void;
}

const ATTENDEE_STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: typeof CheckCircle }> = {
  invited: { label: 'Agendada', variant: 'default', icon: CheckCircle },
  scheduled: { label: 'Agendada', variant: 'default', icon: CheckCircle },
  rescheduled: { label: 'Reagendada', variant: 'secondary', icon: AlertTriangle },
  completed: { label: 'Realizada', variant: 'outline', icon: CheckCircle },
  no_show: { label: 'No-show', variant: 'destructive', icon: XCircle },
  canceled: { label: 'Cancelada', variant: 'outline', icon: XCircle },
  cancelled: { label: 'Cancelada', variant: 'outline', icon: XCircle },
  contract_paid: { label: 'Contrato Pago', variant: 'default', icon: CheckCircle },
  approved: { label: 'Aprovado', variant: 'default', icon: CheckCircle },
  rejected: { label: 'Rejeitado', variant: 'destructive', icon: XCircle },
  refunded: { label: 'Reembolsado', variant: 'outline', icon: XCircle },
};

interface AttendeeRow {
  meetingId: string;
  meetingStatus: string;
  scheduledAt: string;
  closerName: string | null;
  dealId: string | null;
  attendeeId: string;
  attendeeName: string;
  attendeePhone: string | null;
  attendeeStatus: string;
  isReschedule: boolean;
}

export function MeetingsList({ meetings, isLoading, onViewDeal }: MeetingsListProps) {
  const updateStatus = useUpdateMeetingStatus();
  const cancelMeeting = useCancelMeeting();

  // Expand meetings into attendee-level rows
  const attendeeRows = useMemo((): AttendeeRow[] => {
    const rows: AttendeeRow[] = [];
    for (const meeting of meetings) {
      if (meeting.attendees?.length) {
        for (const att of meeting.attendees) {
          // Skip partners - they share the slot with the main lead
          if (att.is_partner) continue;
          rows.push({
            meetingId: meeting.id,
            meetingStatus: meeting.status,
            scheduledAt: meeting.scheduled_at,
            closerName: meeting.closer?.name || null,
            dealId: att.deal_id || meeting.deal_id || null,
            attendeeId: att.id,
            attendeeName: att.attendee_name || att.contact?.name || 'Lead',
            attendeePhone: att.attendee_phone || att.contact?.phone || null,
            attendeeStatus: att.status || meeting.status,
            isReschedule: !!(att.parent_attendee_id && !att.is_partner &&
              !['contract_paid', 'completed', 'refunded', 'approved', 'rejected'].includes(att.status)),
          });
        }
      } else {
        // Slot without attendees - show slot-level info
        rows.push({
          meetingId: meeting.id,
          meetingStatus: meeting.status,
          scheduledAt: meeting.scheduled_at,
          closerName: meeting.closer?.name || null,
          dealId: meeting.deal_id || null,
          attendeeId: meeting.id,
          attendeeName: meeting.deal?.contact?.name || meeting.deal?.name || 'Sem lead',
          attendeePhone: meeting.deal?.contact?.phone || null,
          attendeeStatus: meeting.status,
          isReschedule: false,
        });
      }
    }
    return rows;
  }, [meetings]);

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

  if (attendeeRows.length === 0) {
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
          {attendeeRows.map(row => {
            const statusConfig = ATTENDEE_STATUS_CONFIG[row.attendeeStatus] || ATTENDEE_STATUS_CONFIG.scheduled;
            const StatusIcon = statusConfig.icon;
            const canChangeStatus = ['invited', 'scheduled', 'rescheduled'].includes(row.attendeeStatus);

            return (
              <TableRow key={`${row.meetingId}-${row.attendeeId}`}>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium">
                      {format(parseISO(row.scheduledAt), "dd/MM/yyyy", { locale: ptBR })}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {format(parseISO(row.scheduledAt), "HH:mm")}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium">{row.attendeeName}</span>
                      {row.isReschedule && (
                        <Badge variant="outline" className="text-[10px] px-1 py-0 bg-orange-100 text-orange-700 border-orange-300 gap-0.5">
                          <ArrowRightLeft className="h-2.5 w-2.5" />
                          Remanej.
                        </Badge>
                      )}
                    </div>
                    {row.attendeePhone && (
                      <span className="text-sm text-muted-foreground">{row.attendeePhone}</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <span className="font-medium">{row.closerName || '-'}</span>
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
                      {row.dealId && (
                        <DropdownMenuItem onClick={() => onViewDeal(row.dealId!)}>
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Ver negócio
                        </DropdownMenuItem>
                      )}
                      {canChangeStatus && (
                        <>
                          <DropdownMenuItem onClick={() => handleUpdateStatus(row.meetingId, 'completed')}>
                            <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                            Marcar como realizada
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleUpdateStatus(row.meetingId, 'no_show')}>
                            <AlertTriangle className="h-4 w-4 mr-2 text-yellow-500" />
                            Marcar como no-show
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => cancelMeeting.mutate(row.meetingId)}
                            className="text-destructive"
                          >
                            <XCircle className="h-4 w-4 mr-2" />
                            Cancelar reunião
                          </DropdownMenuItem>
                        </>
                      )}
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
