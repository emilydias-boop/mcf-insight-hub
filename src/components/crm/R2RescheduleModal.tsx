import { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, Clock, User, StickyNote, Link2, FileText, Tag, Loader2, ExternalLink } from 'lucide-react';
import { useR2CloserAvailableSlots } from '@/hooks/useR2CloserAvailableSlots';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { R2MeetingSlot, R2CloserWithAvailability, useRescheduleR2Meeting } from '@/hooks/useR2AgendaData';
import { useUpdateR2Attendee } from '@/hooks/useR2AttendeeUpdate';
import { 
  R2StatusOption, 
  R2ThermometerOption,
  LEAD_PROFILE_OPTIONS,
  VIDEO_STATUS_OPTIONS 
} from '@/types/r2Agenda';
import { cn } from '@/lib/utils';

interface R2RescheduleModalProps {
  meeting: R2MeetingSlot | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  closers: R2CloserWithAvailability[];
  statusOptions: R2StatusOption[];
  thermometerOptions: R2ThermometerOption[];
}


export function R2RescheduleModal({ 
  meeting, 
  open, 
  onOpenChange, 
  closers,
  statusOptions,
  thermometerOptions 
}: R2RescheduleModalProps) {
  // Scheduling fields
  const [selectedCloser, setSelectedCloser] = useState(meeting?.closer?.id || '');
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedTime, setSelectedTime] = useState('09:00');
  const [rescheduleNote, setRescheduleNote] = useState('');

  // R2-specific fields from existing attendee
  const [leadProfile, setLeadProfile] = useState<string>('');
  const [videoStatus, setVideoStatus] = useState<string>('pendente');
  const [r2StatusId, setR2StatusId] = useState<string>('');
  const [thermometerIds, setThermometerIds] = useState<string[]>([]);
  const [meetingLink, setMeetingLink] = useState<string>('');
  const [r2Confirmation, setR2Confirmation] = useState<string>('');
  const [r2Observations, setR2Observations] = useState<string>('');

  const rescheduleMeeting = useRescheduleR2Meeting();
  const updateAttendee = useUpdateR2Attendee();

  // Fetch available slots for selected closer + date
  const { data: closerSlots, isLoading: loadingSlots } = useR2CloserAvailableSlots(
    selectedCloser || undefined,
    selectedDate
  );

  // All configured slots (for showing occupied ones too)
  const allConfiguredSlots = useMemo(() => {
    if (!closerSlots) return [];
    return closerSlots.availableSlots;
  }, [closerSlots]);

  // Available time slots based on closer configuration
  const availableTimeSlots = useMemo(() => {
    if (!closerSlots) return [];
    return closerSlots.availableSlots.filter(s => s.isAvailable);
  }, [closerSlots]);

  // Helper for placeholder text
  const getTimePlaceholder = () => {
    if (!selectedCloser) return 'Selecione closer';
    if (!selectedDate) return 'Selecione data';
    if (loadingSlots) return 'Carregando...';
    if (allConfiguredSlots.length === 0) return 'Sem horários';
    if (availableTimeSlots.length === 0) return 'Todos ocupados';
    return 'Selecione';
  };

  // Load existing attendee data when modal opens
  useEffect(() => {
    if (meeting && open) {
      setSelectedCloser(meeting.closer?.id || '');
      
      const attendee = meeting.attendees?.[0] as Record<string, unknown> | undefined;
      if (attendee) {
        setLeadProfile((attendee.lead_profile as string) || '');
        setVideoStatus((attendee.video_status as string) || 'pendente');
        setR2StatusId((attendee.r2_status_id as string) || '');
        setThermometerIds((attendee.thermometer_ids as string[]) || []);
        setMeetingLink((attendee.meeting_link as string) || '');
        setR2Confirmation((attendee.r2_confirmation as string) || '');
        setR2Observations((attendee.r2_observations as string) || '');
      }
    }
  }, [meeting, open]);

  // Reset time when closer or date changes
  useEffect(() => {
    setSelectedTime('');
  }, [selectedCloser, selectedDate]);

  if (!meeting) return null;

  const attendee = meeting.attendees?.[0];
  const originalNote = meeting.notes;

  const toggleThermometer = (id: string) => {
    setThermometerIds(prev => 
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    );
  };

  const handleSubmit = async () => {
    if (!selectedDate) return;

    const [hours, minutes] = selectedTime.split(':').map(Number);
    const newDate = new Date(selectedDate);
    newDate.setHours(hours, minutes, 0, 0);

    // First reschedule the meeting with full context for proper history tracking
    rescheduleMeeting.mutate({
      meetingId: meeting.id,
      newDate,
      closerId: selectedCloser !== meeting.closer?.id ? selectedCloser : undefined,
      attendeeId: attendee?.id,
      originalDate: meeting.scheduled_at,
      originalCloserId: meeting.closer?.id,
      originalAttendeeStatus: attendee?.status,
      rescheduleNote: rescheduleNote.trim() || undefined,
    }, {
      onSuccess: async () => {
        // Then update attendee fields if we have an attendee
        if (attendee) {
          await updateAttendee.mutateAsync({
            attendeeId: attendee.id,
            updates: {
              lead_profile: leadProfile || null,
              video_status: (videoStatus as 'ok' | 'pendente') || null,
              r2_status_id: r2StatusId || null,
              thermometer_ids: thermometerIds,
              meeting_link: meetingLink || null,
              r2_confirmation: r2Confirmation || null,
              r2_observations: r2Observations || null,
            }
          });
        }
        
        resetForm();
        onOpenChange(false);
      },
    });
  };

  const resetForm = () => {
    setRescheduleNote('');
    setSelectedDate(undefined);
    setSelectedTime('09:00');
    setLeadProfile('');
    setVideoStatus('pendente');
    setR2StatusId('');
    setThermometerIds([]);
    setMeetingLink('');
    setR2Confirmation('');
    setR2Observations('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
<DialogContent className="max-w-md flex flex-col max-h-[90vh]">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-purple-600" />
            Reagendar Reunião R2
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 h-[calc(90vh-120px)]">
          <div className="space-y-4 pr-4 pb-4">
            {/* Current Info */}
            <div className="bg-purple-50 dark:bg-purple-950/30 rounded-lg p-3 text-sm">
              <div className="font-medium">
                {attendee?.name || attendee?.deal?.contact?.name || attendee?.deal?.name || 'Lead'}
              </div>
              <div className="text-muted-foreground">
                Atual: {format(new Date(meeting.scheduled_at), "dd/MM 'às' HH:mm", { locale: ptBR })} com {meeting.closer?.name}
              </div>
            </div>

            {/* Original Note */}
            {originalNote && (
              <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <StickyNote className="h-4 w-4" />
                  Nota Original
                </div>
                <p className="text-sm whitespace-pre-wrap text-muted-foreground max-h-24 overflow-y-auto">
                  {originalNote}
                </p>
              </div>
            )}

            {/* New Closer */}
            <div className="space-y-2">
              <Label>Closer R2</Label>
              <Select value={selectedCloser} onValueChange={setSelectedCloser}>
                <SelectTrigger>
                  <User className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {closers.map(closer => (
                    <SelectItem key={closer.id} value={closer.id}>
                      {closer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date and Time */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nova Data</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button 
                      variant="outline" 
                      className={cn('w-full justify-start text-left', !selectedDate && 'text-muted-foreground')}
                    >
                      {selectedDate ? format(selectedDate, 'dd/MM/yyyy') : 'Selecione'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={selectedDate}
                      onSelect={setSelectedDate}
                      disabled={(date) => date < new Date(new Date().setHours(0,0,0,0))}
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  Horário
                  {loadingSlots && <Loader2 className="h-3 w-3 animate-spin" />}
                </Label>
                <Select 
                  value={selectedTime} 
                  onValueChange={setSelectedTime}
                  disabled={!selectedCloser || !selectedDate || loadingSlots || allConfiguredSlots.length === 0}
                >
                  <SelectTrigger>
                    <Clock className="h-4 w-4 mr-2" />
                    <SelectValue placeholder={getTimePlaceholder()} />
                  </SelectTrigger>
                  <SelectContent>
                    {allConfiguredSlots.map(slot => (
                      <SelectItem 
                        key={slot.time} 
                        value={slot.time}
                        disabled={!slot.isAvailable}
                        className={cn(!slot.isAvailable && "opacity-50")}
                      >
                        <span className="flex items-center gap-2">
                          {slot.time}
                          {slot.link && <ExternalLink className="h-3 w-3 text-muted-foreground" />}
                          {!slot.isAvailable && <span className="text-xs text-destructive">(ocupado)</span>}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Warning when no slots configured */}
            {selectedCloser && selectedDate && !loadingSlots && allConfiguredSlots.length === 0 && (
              <p className="text-xs text-amber-600">
                Closer sem horários configurados para {format(selectedDate, 'EEEE', { locale: ptBR })}.
              </p>
            )}

            {/* Reschedule Note */}
            <div className="space-y-2">
              <Label>Motivo do Reagendamento</Label>
              <Textarea
                value={rescheduleNote}
                onChange={(e) => setRescheduleNote(e.target.value)}
                placeholder="Ex: Cliente pediu para remarcar..."
                rows={2}
              />
            </div>

            {/* Separator */}
            <Separator className="my-4" />

            {/* R2-Specific Fields */}
            <div className="space-y-4">
              {/* Row: Lead Profile + Video Status */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs">Perfil do Lead</Label>
                  <Select value={leadProfile} onValueChange={setLeadProfile}>
                    <SelectTrigger className="h-9">
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

                <div className="space-y-2">
                  <Label className="text-xs">Status do Vídeo</Label>
                  <Select value={videoStatus} onValueChange={setVideoStatus}>
                    <SelectTrigger className="h-9">
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
              </div>

              {/* Status Final */}
              <div className="space-y-2">
                <Label className="text-xs">Status Final</Label>
                <Select value={r2StatusId} onValueChange={setR2StatusId}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="— Sem status —" />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.filter(s => s.is_active).map(status => (
                      <SelectItem key={status.id} value={status.id}>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-2 h-2 rounded-full" 
                            style={{ backgroundColor: status.color }}
                          />
                          {status.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Thermometer Tags */}
              {thermometerOptions.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs flex items-center gap-1">
                    <Tag className="h-3 w-3" />
                    Termômetro / Tags
                  </Label>
                  <div className="flex flex-wrap gap-1.5">
                    {thermometerOptions.filter(t => t.is_active).map(therm => (
                      <Badge
                        key={therm.id}
                        variant={thermometerIds.includes(therm.id) ? "default" : "outline"}
                        className="cursor-pointer transition-all text-xs"
                        style={{
                          backgroundColor: thermometerIds.includes(therm.id) ? therm.color : 'transparent',
                          borderColor: therm.color,
                          color: thermometerIds.includes(therm.id) ? '#fff' : therm.color,
                        }}
                        onClick={() => toggleThermometer(therm.id)}
                      >
                        {therm.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Meeting Link */}
              <div className="space-y-2">
                <Label className="text-xs flex items-center gap-1">
                  <Link2 className="h-3 w-3" />
                  Link da Reunião
                </Label>
                <Input
                  value={meetingLink}
                  onChange={(e) => setMeetingLink(e.target.value)}
                  placeholder="https://meet.google.com/..."
                  className="h-9"
                />
              </div>

              {/* R2 Confirmation */}
              <div className="space-y-2">
                <Label className="text-xs flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  Confirmação R2
                </Label>
                <Input
                  value={r2Confirmation}
                  onChange={(e) => setR2Confirmation(e.target.value)}
                  placeholder="Confirmado p/ R2, etc."
                  className="h-9"
                />
              </div>

              {/* R2 Observations */}
              <div className="space-y-2">
                <Label className="text-xs flex items-center gap-1">
                  <StickyNote className="h-3 w-3" />
                  Observações R2
                </Label>
                <Textarea
                  value={r2Observations}
                  onChange={(e) => setR2Observations(e.target.value)}
                  placeholder="Anotações sobre a reunião..."
                  rows={2}
                />
              </div>
            </div>

            {/* Submit */}
            <Button 
              className="w-full bg-purple-600 hover:bg-purple-700" 
              onClick={handleSubmit}
              disabled={!selectedDate || rescheduleMeeting.isPending || updateAttendee.isPending}
            >
              {rescheduleMeeting.isPending || updateAttendee.isPending ? 'Reagendando...' : 'Reagendar R2'}
            </Button>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
