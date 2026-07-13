import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { 
  ExternalLink, Phone, Video
} from 'lucide-react';
import {
  Table, TableBody, TableCell, TableHead, 
  TableHeader, TableRow
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, 
  SelectTrigger, SelectValue
} from '@/components/ui/select';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { R2MeetingRow, R2StatusOption, R2ThermometerOption, ATTENDANCE_STATUS_OPTIONS } from '@/types/r2Agenda';
import { useUpdateR2Attendee } from '@/hooks/useR2AttendeeUpdate';
import { useR2LeadsChannelMap, R2LeadInput } from '@/hooks/useR2LeadsChannelMap';
import { R2LeadBadges } from './R2LeadBadges';
import { useContractPaidClosersByDeal } from '@/hooks/useContractPaidClosersByDeal';

interface R2ListViewTableProps {
  meetings: R2MeetingRow[];
  statusOptions?: R2StatusOption[];
  thermometerOptions?: R2ThermometerOption[];
  onSelectMeeting: (meeting: R2MeetingRow) => void;
  isLoading?: boolean;
}

export function R2ListViewTable({
  meetings,
  onSelectMeeting,
  isLoading
}: R2ListViewTableProps) {
  const updateAttendee = useUpdateR2Attendee();
  const [editingCell, setEditingCell] = useState<string | null>(null);

  // Flatten meetings to rows (one row per attendee)
  const rows = useMemo(() => {
    return meetings.flatMap(meeting => 
      (meeting.attendees || []).map(attendee => ({
        meeting,
        attendee,
        key: `${meeting.id}-${attendee.id}`
      }))
    );
  }, [meetings]);

  const channelInputs: R2LeadInput[] = useMemo(() => rows.map(({ meeting, attendee, key }) => ({
    key,
    email: (attendee as any).email || (attendee as any).deal?.contact?.email || null,
    phone: (attendee as any).phone || (attendee as any).deal?.contact?.phone || null,
    dealId: (attendee as any).deal_id || (attendee as any).deal?.id || null,
    scheduledAt: meeting.scheduled_at || null,
  })), [rows]);
  const channelMap = useR2LeadsChannelMap(channelInputs);

  // Map dealId -> name of the closer who marked the contract as paid.
  // Used so R2 special markings (e.g. "Anamnese Leticia") still surface
  // when the contract was paid by a different closer than the R1 closer
  // saved on the R2 meeting.
  const dealIds = useMemo(
    () => rows.map(({ attendee }) => (attendee as any).deal_id || (attendee as any).deal?.id || null),
    [rows]
  );
  const { data: contractPaidClosersByDeal } = useContractPaidClosersByDeal(dealIds);

  const handleQuickUpdate = (attendeeId: string, field: string, value: unknown) => {
    updateAttendee.mutate({
      attendeeId,
      updates: { [field]: value }
    });
    setEditingCell(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Nenhuma reunião R2 encontrada no período selecionado.
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="w-[80px]">Hora</TableHead>
            <TableHead className="min-w-[180px]">Lead</TableHead>
            <TableHead className="w-[120px]">Sócio</TableHead>
            <TableHead className="w-[120px]">Comparecimento</TableHead>
            <TableHead className="w-[120px]">Closer</TableHead>
            <TableHead className="w-[80px]">Link</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(({ meeting, attendee, key }) => {
            const contactName = attendee.name || attendee.deal?.contact?.name || 'Lead';
            const contactPhone = attendee.phone || attendee.deal?.contact?.phone;
            const isEditing = (field: string) => editingCell === `${key}-${field}`;

            return (
              <TableRow 
                key={key} 
                className="hover:bg-muted/30 cursor-pointer"
                onClick={() => onSelectMeeting(meeting)}
              >
                {/* Hora */}
                <TableCell className="font-mono text-sm">
                  {format(parseISO(meeting.scheduled_at), 'HH:mm')}
                </TableCell>

                {/* Lead (nome + telefone) */}
                <TableCell onClick={e => e.stopPropagation()}>
                  <div className="space-y-0.5">
                    <div className="font-medium text-sm flex items-center gap-2 flex-wrap">
                      <span>{contactName}</span>
                      <R2LeadBadges
                        channel={channelMap.get(key)?.channel}
                        r1CloserName={
                          (attendee as any).r1_closer_name ||
                          meeting.r1_closer?.name ||
                          null
                        }
                        contractPaidCloserName={
                          contractPaidClosersByDeal?.get(
                            ((attendee as any).deal_id || (attendee as any).deal?.id || '') as string
                          ) || null
                        }
                        isContractPaid={
                          (attendee as any).status === 'contract_paid' ||
                          !!contractPaidClosersByDeal?.get(
                            ((attendee as any).deal_id || (attendee as any).deal?.id || '') as string
                          )
                        }
                        scheduledAt={meeting.scheduled_at}
                      />
                    </div>
                    {contactPhone && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        <a 
                          href={`tel:${contactPhone}`}
                          className="hover:underline"
                          onClick={e => e.stopPropagation()}
                        >
                          {contactPhone}
                        </a>
                      </div>
                    )}
                  </div>
                </TableCell>

                {/* Sócio */}
                <TableCell onClick={e => e.stopPropagation()}>
                  {isEditing('partner_name') ? (
                    <Input
                      autoFocus
                      className="h-7 text-xs"
                      defaultValue={attendee.partner_name || ''}
                      onBlur={(e) => handleQuickUpdate(attendee.id, 'partner_name', e.target.value || null)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleQuickUpdate(attendee.id, 'partner_name', (e.target as HTMLInputElement).value || null);
                        }
                        if (e.key === 'Escape') setEditingCell(null);
                      }}
                    />
                  ) : (
                    <button
                      className="text-sm text-left w-full px-1 py-0.5 rounded hover:bg-muted/50 min-h-[24px]"
                      onClick={() => setEditingCell(`${key}-partner_name`)}
                    >
                      {attendee.partner_name || <span className="text-muted-foreground text-xs">—</span>}
                    </button>
                  )}
                </TableCell>

                {/* Comparecimento */}
                <TableCell onClick={e => e.stopPropagation()}>
                  <Select
                    value={attendee.status}
                    onValueChange={(value) => handleQuickUpdate(attendee.id, 'status', value)}
                  >
                    <SelectTrigger className={cn(
                      "h-7 text-xs border-0",
                      attendee.status === 'completed' && "bg-green-500/20 text-green-700",
                      attendee.status === 'no_show' && "bg-red-500/20 text-red-700",
                      attendee.status === 'invited' && "bg-purple-500/20 text-purple-700"
                    )}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ATTENDANCE_STATUS_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>

                {/* Closer */}
                <TableCell>
                  <span className="text-sm">{meeting.closer?.name || '—'}</span>
                </TableCell>

                {/* Link */}
                <TableCell onClick={e => e.stopPropagation()}>
                  {attendee.meeting_link ? (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <a
                            href={attendee.meeting_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                            onClick={e => e.stopPropagation()}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </TooltipTrigger>
                        <TooltipContent>Abrir link da reunião</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : (
                    <span className="text-muted-foreground">
                      <Video className="h-4 w-4" />
                    </span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
