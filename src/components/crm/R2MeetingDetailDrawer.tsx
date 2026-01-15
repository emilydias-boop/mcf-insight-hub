import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Phone, Calendar, CheckCircle, XCircle, 
  ExternalLink, Clock, User, Users, Video,
  MessageSquare, History, Save
} from 'lucide-react';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, 
  SelectTrigger, SelectValue
} from '@/components/ui/select';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger
} from '@/components/ui/collapsible';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { 
  R2MeetingRow, R2StatusOption, R2ThermometerOption,
  LEAD_PROFILE_OPTIONS, ATTENDANCE_STATUS_OPTIONS, VIDEO_STATUS_OPTIONS
} from '@/types/r2Agenda';
import { useUpdateR2Attendee } from '@/hooks/useR2AttendeeUpdate';
import { useR2AuditHistory, getAuditDiff } from '@/hooks/useR2AuditHistory';
import { useUpdateR2MeetingStatus } from '@/hooks/useR2AgendaData';

interface R2MeetingDetailDrawerProps {
  meeting: R2MeetingRow | null;
  statusOptions: R2StatusOption[];
  thermometerOptions: R2ThermometerOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReschedule: (meeting: R2MeetingRow) => void;
}

const MEETING_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  scheduled: { label: 'Agendada', color: 'bg-purple-500' },
  rescheduled: { label: 'Reagendada', color: 'bg-yellow-500' },
  completed: { label: 'Realizada', color: 'bg-green-500' },
  no_show: { label: 'No-show', color: 'bg-red-500' },
  canceled: { label: 'Cancelada', color: 'bg-muted' },
  contract_paid: { label: 'Contrato Pago', color: 'bg-emerald-600' },
};

export function R2MeetingDetailDrawer({
  meeting,
  statusOptions,
  thermometerOptions,
  open,
  onOpenChange,
  onReschedule
}: R2MeetingDetailDrawerProps) {
  const [selectedAttendeeId, setSelectedAttendeeId] = useState<string | null>(null);
  const [showAudit, setShowAudit] = useState(false);
  
  const updateAttendee = useUpdateR2Attendee();
  const updateMeetingStatus = useUpdateR2MeetingStatus();
  
  const attendee = meeting?.attendees?.find(a => a.id === selectedAttendeeId) || meeting?.attendees?.[0];
  const { data: auditHistory } = useR2AuditHistory(attendee?.id || null);

  if (!meeting) return null;

  const statusInfo = MEETING_STATUS_LABELS[meeting.status] || MEETING_STATUS_LABELS.scheduled;
  const isPending = meeting.status === 'scheduled' || meeting.status === 'rescheduled';
  const contactPhone = attendee?.phone || attendee?.deal?.contact?.phone;

  const handleAttendeeUpdate = (field: string, value: unknown) => {
    if (!attendee) return;
    updateAttendee.mutate({
      attendeeId: attendee.id,
      updates: { [field]: value }
    });
  };

  const handleStatusChange = (newStatus: string) => {
    updateMeetingStatus.mutate({ meetingId: meeting.id, status: newStatus });
  };

  const handleWhatsApp = () => {
    if (contactPhone) {
      const phone = contactPhone.replace(/\D/g, '');
      window.open(`https://wa.me/55${phone}`, '_blank');
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg p-0 flex flex-col">
        <SheetHeader className="border-b p-4">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-lg flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-purple-500" />
              Detalhes R2
            </SheetTitle>
            <Badge className={cn(statusInfo.color, 'text-white')}>
              {statusInfo.label}
            </Badge>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-4">
            {/* Meeting Info */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="font-medium">
                    {format(parseISO(meeting.scheduled_at), "EEEE, d 'de' MMMM", { locale: ptBR })}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {format(parseISO(meeting.scheduled_at), 'HH:mm')} - 30min
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-sm text-muted-foreground">Closer R2</div>
                  <div className="font-medium">{meeting.closer?.name}</div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Histórico do Funil */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground flex items-center gap-2">
                <History className="h-3 w-3" />
                Histórico do Funil
              </Label>
              <div className="bg-muted/30 rounded-lg p-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">SDR:</span>
                  <span className="font-medium">
                    {meeting.sdr?.name || meeting.sdr?.email || '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Closer R1:</span>
                  <span className="font-medium">
                    {meeting.r1_closer?.name || '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Agendou R2:</span>
                  <span className="font-medium">
                    {meeting.booked_by?.name || '—'}
                  </span>
                </div>
              </div>
            </div>

            <Separator />

            {/* Participant Selection (if multiple) */}
            {meeting.attendees && meeting.attendees.length > 1 && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Participante
                </Label>
                <Select
                  value={attendee?.id}
                  onValueChange={setSelectedAttendeeId}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {meeting.attendees.map(att => (
                      <SelectItem key={att.id} value={att.id}>
                        {att.name || att.deal?.contact?.name || 'Lead'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Attendee Details Form */}
            {attendee && (
              <div className="space-y-4">
                <div className="bg-muted/30 rounded-lg p-3 space-y-3">
                  <div className="font-medium">
                    {attendee.name || attendee.deal?.contact?.name || 'Lead'}
                  </div>
                  {contactPhone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <a href={`tel:${contactPhone}`} className="text-sm hover:underline">
                        {contactPhone}
                      </a>
                      <Button variant="ghost" size="sm" onClick={handleWhatsApp}>
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>

                {/* Editable Fields */}
                <div className="grid gap-4">
                  {/* Sócio */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Sócio Responsável</Label>
                    <Input
                      value={attendee.partner_name || ''}
                      onChange={(e) => handleAttendeeUpdate('partner_name', e.target.value || null)}
                      placeholder="Nome do sócio"
                    />
                  </div>

                  {/* Perfil do Lead */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Perfil do Lead</Label>
                    <Select
                      value={attendee.lead_profile || ''}
                      onValueChange={(v) => handleAttendeeUpdate('lead_profile', v || null)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {LEAD_PROFILE_OPTIONS.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Comparecimento */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Comparecimento</Label>
                    <Select
                      value={attendee.status}
                      onValueChange={(v) => handleAttendeeUpdate('status', v)}
                    >
                      <SelectTrigger>
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
                  </div>

                  {/* Vídeo */}
                  <div className="space-y-1.5">
                    <Label className="text-xs flex items-center gap-1">
                      <Video className="h-3 w-3" />
                      Status do Vídeo
                    </Label>
                    <Select
                      value={attendee.video_status || 'pendente'}
                      onValueChange={(v) => handleAttendeeUpdate('video_status', v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {VIDEO_STATUS_OPTIONS.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Status Final */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Status Final</Label>
                    <Select
                      value={attendee.r2_status_id || '__none__'}
                      onValueChange={(v) => handleAttendeeUpdate('r2_status_id', v === '__none__' ? null : v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
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
                  </div>

                  {/* Termômetro */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Termômetro / Tags</Label>
                    <div className="flex flex-wrap gap-2 p-2 border rounded-md min-h-[40px]">
                      {thermometerOptions.map(opt => {
                        const isSelected = (attendee.thermometer_ids || []).includes(opt.id);
                        return (
                          <Badge
                            key={opt.id}
                            variant={isSelected ? "default" : "outline"}
                            className="cursor-pointer"
                            style={{ 
                              backgroundColor: isSelected ? opt.color : 'transparent',
                              borderColor: opt.color,
                              color: isSelected ? 'white' : opt.color
                            }}
                            onClick={() => {
                              const newIds = isSelected
                                ? (attendee.thermometer_ids || []).filter(id => id !== opt.id)
                                : [...(attendee.thermometer_ids || []), opt.id];
                              handleAttendeeUpdate('thermometer_ids', newIds);
                            }}
                          >
                            {opt.name}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>

                  {/* Link da Reunião */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Link da Reunião</Label>
                    <Input
                      value={attendee.meeting_link || ''}
                      onChange={(e) => handleAttendeeUpdate('meeting_link', e.target.value || null)}
                      placeholder="https://..."
                    />
                  </div>

                  {/* Confirmação R2 */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Confirmação R2</Label>
                    <Input
                      value={attendee.r2_confirmation || ''}
                      onChange={(e) => handleAttendeeUpdate('r2_confirmation', e.target.value || null)}
                      placeholder="Confirmado p/ R2, etc."
                    />
                  </div>

                  {/* Observações */}
                  <div className="space-y-1.5">
                    <Label className="text-xs flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" />
                      Observações R2
                    </Label>
                    <Textarea
                      value={attendee.r2_observations || ''}
                      onChange={(e) => handleAttendeeUpdate('r2_observations', e.target.value || null)}
                      placeholder="Anotações sobre a reunião..."
                      rows={3}
                    />
                  </div>
                </div>

                <Separator />

                {/* Audit History */}
                <Collapsible open={showAudit} onOpenChange={setShowAudit}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="w-full justify-between">
                      <span className="flex items-center gap-2">
                        <History className="h-4 w-4" />
                        Histórico de Alterações
                      </span>
                      <Badge variant="outline">{auditHistory?.length || 0}</Badge>
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2">
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {auditHistory?.length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-2">
                          Nenhuma alteração registrada
                        </p>
                      )}
                      {auditHistory?.map(log => {
                        const changes = getAuditDiff(log.old_data, log.new_data);
                        if (changes.length === 0) return null;
                        
                        return (
                          <div key={log.id} className="text-xs border-l-2 border-muted pl-2 py-1">
                            <div className="text-muted-foreground">
                              {format(parseISO(log.created_at), "dd/MM HH:mm")}
                              {log.user?.name && ` - ${log.user.name}`}
                            </div>
                            {changes.map((change, i) => (
                              <div key={i} className="text-foreground">{change}</div>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer Actions */}
        <div className="border-t p-4 space-y-2">
          {isPending && (
            <div className="grid grid-cols-2 gap-2">
              <Button 
                variant="outline" 
                className="text-green-600 border-green-200 hover:bg-green-50"
                onClick={() => handleStatusChange('completed')}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Realizada
              </Button>
              <Button 
                variant="outline"
                className="text-red-600 border-red-200 hover:bg-red-50"
                onClick={() => handleStatusChange('no_show')}
              >
                <XCircle className="h-4 w-4 mr-2" />
                No-show
              </Button>
            </div>
          )}
          
          <div className="grid grid-cols-2 gap-2">
            <Button 
              variant="outline"
              onClick={() => onReschedule(meeting)}
            >
              <Clock className="h-4 w-4 mr-2" />
              Reagendar
            </Button>
            <Button 
              variant="outline"
              className="text-emerald-600 border-emerald-200 hover:bg-emerald-50"
              onClick={() => handleStatusChange('contract_paid')}
            >
              Contrato Pago
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
