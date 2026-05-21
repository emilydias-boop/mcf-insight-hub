import { useState, useMemo } from 'react';
import { format, startOfToday, setHours, setMinutes, startOfDay, isAfter } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, Clock, Users, ArrowRightLeft, UserCog, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useMeetingsForDate } from '@/hooks/useAgendaData';
import { useClosers, useBookedSlots } from '@/hooks/useCloserScheduling';
import { useCloserDaySlots } from '@/hooks/useCloserMeetingLinks';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface MeetingLite {
  id: string;
  scheduled_at: string;
  closer?: { id: string; name: string; color?: string };
  attendees?: Array<{
    id: string;
    attendee_name?: string | null;
    is_partner?: boolean;
    status?: string;
    contact?: { name?: string } | null;
  }>;
}

interface Props {
  meeting: MeetingLite | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface AvailableSlot {
  closerId: string;
  closerName: string;
  closerColor: string;
  datetime: Date;
  duration: number;
  isBooked?: boolean;
}

export function MoveEntireMeetingModal({ meeting, open, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const { data: closers } = useClosers();

  // ----------- Tab: Swap Closer -----------
  const [newCloserId, setNewCloserId] = useState<string>('');
  const [swapReason, setSwapReason] = useState('');

  const swapCloser = useMutation({
    mutationFn: async () => {
      if (!meeting || !newCloserId) throw new Error('Dados incompletos');
      const targetCloser = closers?.find((c) => c.id === newCloserId);
      if (!targetCloser) throw new Error('Closer destino inválido');

      // Atualiza closer do slot
      const { error: updErr } = await supabase
        .from('meeting_slots')
        .update({ closer_id: newCloserId, updated_at: new Date().toISOString() })
        .eq('id', meeting.id);
      if (updErr) throw updErr;

      // Log para cada participante
      const { data: authData } = await supabase.auth.getUser();
      let movedByName: string | null = null;
      if (authData?.user?.id) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', authData.user.id)
          .single();
        movedByName = prof?.full_name ?? null;
      }

      const logs = (meeting.attendees || []).map((a) => ({
        attendee_id: a.id,
        from_slot_id: meeting.id,
        to_slot_id: meeting.id,
        from_scheduled_at: meeting.scheduled_at,
        to_scheduled_at: meeting.scheduled_at,
        from_closer_id: meeting.closer?.id || null,
        from_closer_name: meeting.closer?.name || null,
        to_closer_id: newCloserId,
        to_closer_name: targetCloser.name,
        previous_status: a.status || null,
        reason: swapReason.trim() || 'Troca de closer (reunião inteira)',
        movement_type: 'transfer_preserved',
        moved_by: authData?.user?.id || null,
        moved_by_name: movedByName,
      }));
      if (logs.length > 0) {
        await supabase.from('attendee_movement_logs').insert(logs);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agenda-meetings'] });
      queryClient.invalidateQueries({ queryKey: ['meeting_slots'] });
      queryClient.invalidateQueries({ queryKey: ['booked-slots'] });
      queryClient.invalidateQueries({ queryKey: ['attendee-movement-history'] });
      toast.success('Closer da reunião alterado');
      onOpenChange(false);
      setNewCloserId('');
      setSwapReason('');
    },
    onError: (e: any) => toast.error(e?.message || 'Erro ao trocar closer'),
  });

  // ----------- Tab: Move all to existing slot -----------
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [selectedCloser, setSelectedCloser] = useState<string | null>(null);
  const [moveReason, setMoveReason] = useState('');

  const dayOfWeek = selectedDate ? selectedDate.getDay() : 0;
  const { data: daySlots } = useCloserDaySlots(dayOfWeek, 'r1');
  const { data: bookedSlots } = useBookedSlots(
    selectedDate || new Date(),
    selectedDate || new Date(),
  );
  const { data: meetingsForDate, isLoading: meetingsLoading } = useMeetingsForDate(
    selectedDate,
    true,
  );

  const availableSlots = useMemo<AvailableSlot[]>(() => {
    if (!selectedDate || !closers || !daySlots) return [];
    const slots: AvailableSlot[] = [];
    for (const slot of daySlots) {
      const closer = closers.find((c) => c.id === slot.closer_id);
      if (!closer) continue;
      const [h, m] = slot.start_time.split(':').map(Number);
      const dt = setMinutes(setHours(startOfDay(selectedDate), h), m);
      const isBooked = bookedSlots?.some(
        (b) =>
          b.closer_id === closer.id &&
          format(new Date(b.scheduled_at), 'HH:mm') === format(dt, 'HH:mm'),
      );
      slots.push({
        closerId: closer.id,
        closerName: closer.name,
        closerColor: (closer as any).color || '#3B82F6',
        datetime: dt,
        duration: 60,
        isBooked,
      });
    }
    return slots.sort((a, b) => a.datetime.getTime() - b.datetime.getTime());
  }, [selectedDate, closers, daySlots, bookedSlots]);

  const existingMeetings = (meetingsForDate || []).filter((m) => m.id !== meeting?.id);
  const filteredSlots = selectedCloser
    ? availableSlots.filter((s) => s.closerId === selectedCloser)
    : availableSlots;
  const filteredMeetings = selectedCloser
    ? existingMeetings.filter((m) => m.closer?.id === selectedCloser)
    : existingMeetings;

  const moveAll = useMutation({
    mutationFn: async ({
      targetSlotId,
      targetCloserId,
      targetCloserName,
      targetScheduledAt,
    }: {
      targetSlotId: string;
      targetCloserId: string;
      targetCloserName: string;
      targetScheduledAt: string;
    }) => {
      if (!meeting) throw new Error('Reunião inválida');
      const attendees = meeting.attendees || [];

      const { data: authData } = await supabase.auth.getUser();
      let movedByName: string | null = null;
      if (authData?.user?.id) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', authData.user.id)
          .single();
        movedByName = prof?.full_name ?? null;
      }

      for (const a of attendees) {
        // Atualiza o attendee preservando status original
        const preserve = ['contract_paid', 'completed', 'refunded', 'approved', 'rejected'].includes(
          a.status || '',
        );
        const { error: updErr } = await supabase
          .from('meeting_slot_attendees')
          .update({
            meeting_slot_id: targetSlotId,
            status: preserve ? a.status : 'rescheduled',
            is_reschedule: !preserve,
            updated_at: new Date().toISOString(),
          })
          .eq('id', a.id);
        if (updErr) throw updErr;

        await supabase.from('attendee_movement_logs').insert({
          attendee_id: a.id,
          from_slot_id: meeting.id,
          to_slot_id: targetSlotId,
          from_scheduled_at: meeting.scheduled_at,
          to_scheduled_at: targetScheduledAt,
          from_closer_id: meeting.closer?.id || null,
          from_closer_name: meeting.closer?.name || null,
          to_closer_id: targetCloserId,
          to_closer_name: targetCloserName,
          previous_status: a.status || null,
          reason: moveReason.trim() || 'Reunião inteira movida',
          movement_type: preserve ? 'transfer_preserved' : 'same_day_reschedule',
          moved_by: authData?.user?.id || null,
          moved_by_name: movedByName,
        });
      }

      // Cancela slot antigo (ficou sem participantes)
      await supabase
        .from('meeting_slots')
        .update({ status: 'canceled' })
        .eq('id', meeting.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agenda-meetings'] });
      queryClient.invalidateQueries({ queryKey: ['meeting_slots'] });
      queryClient.invalidateQueries({ queryKey: ['booked-slots'] });
      queryClient.invalidateQueries({ queryKey: ['attendee-movement-history'] });
      queryClient.invalidateQueries({ queryKey: ['sdr-meetings-from-agenda'] });
      queryClient.invalidateQueries({ queryKey: ['sdr-meetings-v2'] });
      toast.success('Reunião inteira movida com sucesso');
      onOpenChange(false);
      setSelectedDate(null);
      setSelectedCloser(null);
      setMoveReason('');
    },
    onError: (e: any) => toast.error(e?.message || 'Erro ao mover reunião'),
  });

  const handleMoveToSlot = async (slot: AvailableSlot) => {
    if (!meeting) return;
    const scheduledAt = slot.datetime.toISOString();
    // Garante slot destino
    const { data: existing } = await supabase
      .from('meeting_slots')
      .select('id')
      .eq('closer_id', slot.closerId)
      .eq('scheduled_at', scheduledAt)
      .in('status', ['scheduled', 'rescheduled'])
      .maybeSingle();
    let targetSlotId = existing?.id;
    if (!targetSlotId) {
      const { data: created, error } = await supabase
        .from('meeting_slots')
        .insert({
          closer_id: slot.closerId,
          scheduled_at: scheduledAt,
          duration_minutes: slot.duration,
          status: 'scheduled',
          lead_type: 'A',
        })
        .select('id')
        .single();
      if (error) {
        toast.error('Erro ao criar slot destino');
        return;
      }
      targetSlotId = created.id;
    }
    moveAll.mutate({
      targetSlotId,
      targetCloserId: slot.closerId,
      targetCloserName: slot.closerName,
      targetScheduledAt: scheduledAt,
    });
  };

  const handleMoveToMeeting = (target: any) => {
    moveAll.mutate({
      targetSlotId: target.id,
      targetCloserId: target.closer?.id,
      targetCloserName: target.closer?.name,
      targetScheduledAt: target.scheduled_at,
    });
  };

  if (!meeting) return null;

  const attendeeCount = (meeting.attendees || []).filter((a) => !a.is_partner).length;
  const otherClosers = (closers || []).filter((c) => c.id !== meeting.closer?.id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5" />
            Mover Reunião Inteira
          </DialogTitle>
          <DialogDescription>
            {attendeeCount} participante{attendeeCount !== 1 ? 's' : ''} •{' '}
            {format(new Date(meeting.scheduled_at), "dd/MM 'às' HH:mm", { locale: ptBR })} •{' '}
            Closer atual: <strong>{meeting.closer?.name}</strong>
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="closer" className="w-full">
          <TabsList className="grid grid-cols-2">
            <TabsTrigger value="closer">
              <UserCog className="h-4 w-4 mr-2" />
              Trocar Closer
            </TabsTrigger>
            <TabsTrigger value="slot">
              <ArrowRightLeft className="h-4 w-4 mr-2" />
              Mover p/ outro slot
            </TabsTrigger>
          </TabsList>

          {/* ---- Trocar Closer ---- */}
          <TabsContent value="closer" className="space-y-4 py-4">
            <Alert>
              <AlertDescription>
                A data e horário permanecem. Todos os participantes serão atribuídos ao novo closer.
              </AlertDescription>
            </Alert>
            <div className="space-y-2">
              <label className="text-sm font-medium">Novo Closer</label>
              <Select value={newCloserId} onValueChange={setNewCloserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um closer" />
                </SelectTrigger>
                <SelectContent>
                  {otherClosers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: (c as any).color || '#3B82F6' }}
                        />
                        {c.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Motivo (opcional)</label>
              <Textarea
                placeholder="Ex.: closer original indisponível, redistribuição de carga..."
                value={swapReason}
                onChange={(e) => setSwapReason(e.target.value)}
                className="min-h-[70px]"
              />
            </div>
            <Button
              className="w-full"
              disabled={!newCloserId || swapCloser.isPending}
              onClick={() => swapCloser.mutate()}
            >
              {swapCloser.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Trocar Closer da Reunião
            </Button>
          </TabsContent>

          {/* ---- Mover slot ---- */}
          <TabsContent value="slot" className="space-y-4 py-4">
            <Alert>
              <AlertDescription>
                Todos os <strong>{attendeeCount}</strong> participantes serão movidos para o slot
                escolhido. O slot atual será cancelado.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <label className="text-sm font-medium">Selecionar Data</label>
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left">
                    <Calendar className="h-4 w-4 mr-2" />
                    {selectedDate
                      ? format(selectedDate, "EEEE, dd 'de' MMMM", { locale: ptBR })
                      : 'Escolha uma data'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={selectedDate || undefined}
                    onSelect={(date) => {
                      setSelectedDate(date || null);
                      setCalendarOpen(false);
                    }}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {selectedDate && closers && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Filtrar por Closer</label>
                <Select
                  value={selectedCloser || 'all'}
                  onValueChange={(v) => setSelectedCloser(v === 'all' ? null : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os closers</SelectItem>
                    {closers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">Motivo (opcional)</label>
              <Textarea
                placeholder="Motivo do remanejamento..."
                value={moveReason}
                onChange={(e) => setMoveReason(e.target.value)}
                className="min-h-[60px]"
              />
            </div>

            {selectedDate && (
              <ScrollArea className="h-[280px]">
                <div className="space-y-4 pr-3">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">
                      Slots Disponíveis
                    </label>
                    {filteredSlots.length === 0 ? (
                      <div className="text-center py-4 text-muted-foreground border rounded-lg text-sm">
                        Nenhum slot
                      </div>
                    ) : (
                      filteredSlots.map((s, i) => (
                        <div
                          key={`${s.closerId}-${s.datetime.getTime()}-${i}`}
                          className="border rounded-lg p-3 flex items-center justify-between hover:bg-muted/50"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: s.closerColor }}
                            />
                            <div>
                              <div className="flex items-center gap-2 text-sm font-medium">
                                {s.closerName}
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    'text-xs',
                                    s.isBooked
                                      ? 'text-amber-600 border-amber-300'
                                      : 'text-green-600 border-green-300',
                                  )}
                                >
                                  {s.isBooked ? 'Ocupado' : 'Livre'}
                                </Badge>
                              </div>
                              <div className="text-xs text-muted-foreground flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {format(s.datetime, 'HH:mm')} • {s.duration}min
                              </div>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            disabled={moveAll.isPending}
                            onClick={() => handleMoveToSlot(s)}
                          >
                            Mover
                          </Button>
                        </div>
                      ))
                    )}
                  </div>

                  {filteredMeetings.length > 0 && (
                    <>
                      <Separator />
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-muted-foreground">
                          Encaixar em Reunião Existente
                        </label>
                        {filteredMeetings.map((m: any) => {
                          const count = m.attendees?.filter((a: any) => !a.is_partner).length || 0;
                          return (
                            <div
                              key={m.id}
                              className="border rounded-lg p-3 flex items-center justify-between hover:bg-muted/50"
                            >
                              <div className="flex items-center gap-3">
                                <div
                                  className="w-3 h-3 rounded-full"
                                  style={{ backgroundColor: m.closer?.color || '#3B82F6' }}
                                />
                                <div>
                                  <div className="text-sm font-medium">{m.closer?.name}</div>
                                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {format(new Date(m.scheduled_at), 'HH:mm')} •{' '}
                                    <Users className="h-3 w-3" /> {count}
                                  </div>
                                </div>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={moveAll.isPending}
                                onClick={() => handleMoveToMeeting(m)}
                              >
                                Encaixar
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              </ScrollArea>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}