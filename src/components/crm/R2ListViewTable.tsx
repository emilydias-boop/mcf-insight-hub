import { useState, useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  ExternalLink, MessageSquare, Phone, 
  ChevronDown, Check, X, Video, 
  AlertCircle
} from 'lucide-react';
import {
  Table, TableBody, TableCell, TableHead, 
  TableHeader, TableRow
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, 
  SelectTrigger, SelectValue
} from '@/components/ui/select';
import {
  Popover, PopoverContent, PopoverTrigger
} from '@/components/ui/popover';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { R2MeetingRow, R2StatusOption, R2ThermometerOption, LEAD_PROFILE_OPTIONS, ATTENDANCE_STATUS_OPTIONS, VIDEO_STATUS_OPTIONS } from '@/types/r2Agenda';
import { useUpdateR2Attendee } from '@/hooks/useR2AttendeeUpdate';
import { Checkbox } from '@/components/ui/checkbox';

interface R2ListViewTableProps {
  meetings: R2MeetingRow[];
  statusOptions: R2StatusOption[];
  thermometerOptions: R2ThermometerOption[];
  onSelectMeeting: (meeting: R2MeetingRow) => void;
  isLoading?: boolean;
}

export function R2ListViewTable({
  meetings,
  statusOptions,
  thermometerOptions,
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

  const handleQuickUpdate = (attendeeId: string, field: string, value: unknown) => {
    updateAttendee.mutate({
      attendeeId,
      updates: { [field]: value }
    });
    setEditingCell(null);
  };

  const handleThermometerToggle = (attendeeId: string, currentIds: string[], thermometerId: string) => {
    const newIds = currentIds.includes(thermometerId)
      ? currentIds.filter(id => id !== thermometerId)
      : [...currentIds, thermometerId];
    
    handleQuickUpdate(attendeeId, 'thermometer_ids', newIds);
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
            <TableHead className="w-[100px]">Perfil</TableHead>
            <TableHead className="w-[120px]">Comparecimento</TableHead>
            <TableHead className="w-[120px]">Closer</TableHead>
            <TableHead className="w-[100px]">Vídeo</TableHead>
            <TableHead className="w-[140px]">Status Final</TableHead>
            <TableHead className="min-w-[150px]">Termômetro</TableHead>
            <TableHead className="w-[80px]">Link</TableHead>
            <TableHead className="min-w-[150px]">Observações</TableHead>
            <TableHead className="w-[120px]">Confirmação R2</TableHead>
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
                    <div className="font-medium text-sm">{contactName}</div>
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

                {/* Perfil */}
                <TableCell onClick={e => e.stopPropagation()}>
                  <Select
                    value={attendee.lead_profile || ''}
                    onValueChange={(value) => handleQuickUpdate(attendee.id, 'lead_profile', value || null)}
                  >
                    <SelectTrigger className="h-7 text-xs border-0 bg-transparent hover:bg-muted/50">
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      {LEAD_PROFILE_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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

                {/* Vídeo */}
                <TableCell onClick={e => e.stopPropagation()}>
                  <Select
                    value={attendee.video_status || 'pendente'}
                    onValueChange={(value) => handleQuickUpdate(attendee.id, 'video_status', value)}
                  >
                    <SelectTrigger className={cn(
                      "h-7 text-xs border-0",
                      attendee.video_status === 'ok' && "bg-green-500/20 text-green-700",
                      attendee.video_status === 'pendente' && "bg-yellow-500/20 text-yellow-700"
                    )}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {VIDEO_STATUS_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>
                          <div className="flex items-center gap-1">
                            {opt.value === 'ok' ? <Check className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                            {opt.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>

                {/* Status Final */}
                <TableCell onClick={e => e.stopPropagation()}>
                  <Select
                    value={attendee.r2_status_id || '__none__'}
                    onValueChange={(value) => handleQuickUpdate(attendee.id, 'r2_status_id', value === '__none__' ? null : value)}
                  >
                    <SelectTrigger 
                      className="h-7 text-xs border-0"
                      style={{ 
                        backgroundColor: attendee.r2_status ? `${attendee.r2_status.color}20` : undefined,
                        color: attendee.r2_status?.color 
                      }}
                    >
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— Sem status —</SelectItem>
                      {statusOptions.map(opt => (
                        <SelectItem key={opt.id} value={opt.id}>
                          <div className="flex items-center gap-2">
                            <div 
                              className="h-2 w-2 rounded-full" 
                              style={{ backgroundColor: opt.color }} 
                            />
                            {opt.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>

                {/* Termômetro */}
                <TableCell onClick={e => e.stopPropagation()}>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1">
                        {(attendee.thermometers?.length || 0) > 0 ? (
                          <div className="flex flex-wrap gap-0.5">
                            {attendee.thermometers?.slice(0, 2).map(t => (
                              <Badge 
                                key={t.id} 
                                variant="outline" 
                                className="text-[10px] px-1 py-0"
                                style={{ borderColor: t.color, color: t.color }}
                              >
                                {t.name.slice(0, 8)}
                              </Badge>
                            ))}
                            {(attendee.thermometers?.length || 0) > 2 && (
                              <Badge variant="outline" className="text-[10px] px-1 py-0">
                                +{attendee.thermometers!.length - 2}
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                        <ChevronDown className="h-3 w-3" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-48 p-2" align="start">
                      <div className="space-y-1">
                        {thermometerOptions.map(opt => (
                          <div 
                            key={opt.id}
                            className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted/50 cursor-pointer"
                            onClick={() => handleThermometerToggle(
                              attendee.id, 
                              attendee.thermometer_ids || [], 
                              opt.id
                            )}
                          >
                            <Checkbox 
                              checked={(attendee.thermometer_ids || []).includes(opt.id)}
                              className="h-3 w-3"
                            />
                            <div 
                              className="h-2 w-2 rounded-full" 
                              style={{ backgroundColor: opt.color }} 
                            />
                            <span className="text-xs">{opt.name}</span>
                          </div>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
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
                    <button
                      className="text-muted-foreground hover:text-foreground"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingCell(`${key}-meeting_link`);
                      }}
                    >
                      <Video className="h-4 w-4" />
                    </button>
                  )}
                </TableCell>

                {/* Observações */}
                <TableCell onClick={e => e.stopPropagation()}>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          className="text-left text-xs text-muted-foreground truncate max-w-[150px] block"
                          onClick={() => setEditingCell(`${key}-r2_observations`)}
                        >
                          {attendee.r2_observations ? (
                            <span className="flex items-center gap-1">
                              <MessageSquare className="h-3 w-3 flex-shrink-0" />
                              {attendee.r2_observations.slice(0, 30)}...
                            </span>
                          ) : (
                            <span className="text-muted-foreground/50">Adicionar nota</span>
                          )}
                        </button>
                      </TooltipTrigger>
                      {attendee.r2_observations && (
                        <TooltipContent className="max-w-xs">
                          {attendee.r2_observations}
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </TooltipProvider>
                </TableCell>

                {/* Confirmação R2 */}
                <TableCell onClick={e => e.stopPropagation()}>
                  {isEditing('r2_confirmation') ? (
                    <Input
                      autoFocus
                      className="h-7 text-xs"
                      defaultValue={attendee.r2_confirmation || ''}
                      onBlur={(e) => handleQuickUpdate(attendee.id, 'r2_confirmation', e.target.value || null)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleQuickUpdate(attendee.id, 'r2_confirmation', (e.target as HTMLInputElement).value || null);
                        }
                        if (e.key === 'Escape') setEditingCell(null);
                      }}
                    />
                  ) : (
                    <button
                      className="text-xs text-left w-full px-1 py-0.5 rounded hover:bg-muted/50 min-h-[24px]"
                      onClick={() => setEditingCell(`${key}-r2_confirmation`)}
                    >
                      {attendee.r2_confirmation || <span className="text-muted-foreground">—</span>}
                    </button>
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
