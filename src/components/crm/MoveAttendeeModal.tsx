import { useState, useMemo } from 'react';
import { format, startOfToday, setHours, setMinutes, addMinutes, isBefore, isAfter, startOfDay, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, Clock, Users, ArrowRight, User, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useMeetingsForDate, useMoveAttendeeToMeeting, syncDealStageFromAgenda } from '@/hooks/useAgendaData';
import { useClosers, useBookedSlots } from '@/hooks/useCloserScheduling';
import { useCloserDaySlots } from '@/hooks/useCloserMeetingLinks';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface MoveAttendeeModalProps {
  attendee: {
    id: string;
    name: string;
    isPartner: boolean;
  } | null;
  currentMeetingId: string | null;
  currentMeetingDate?: Date;
  currentAttendeeStatus?: string;
  currentCloserId?: string;
  currentCloserName?: string;
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

export function MoveAttendeeModal({ 
  attendee, 
  currentMeetingId,
  currentMeetingDate,
  currentAttendeeStatus,
  currentCloserId,
  currentCloserName,
  open, 
  onOpenChange 
}: MoveAttendeeModalProps) {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [selectedCloser, setSelectedCloser] = useState<string | null>(null);
  const [moveReason, setMoveReason] = useState('');
  const queryClient = useQueryClient();
  
  const { role } = useAuth();
  const isAdmin = role === 'admin';
  
  const { data: closers } = useClosers();
  const dayOfWeek = selectedDate ? selectedDate.getDay() : 0;
  const { data: daySlots } = useCloserDaySlots(dayOfWeek, 'r1');
  const { data: bookedSlots } = useBookedSlots(
    selectedDate || new Date(), 
    selectedDate || new Date()
  );
  const { data: meetings, isLoading: meetingsLoading } = useMeetingsForDate(selectedDate, isAdmin);
  const moveAttendee = useMoveAttendeeToMeeting();

  // Calculate available slots for the selected date using closer_meeting_links
  const availableSlots = useMemo(() => {
    if (!selectedDate || !closers || !daySlots) return [];
    
    const slots: AvailableSlot[] = [];
    
    for (const slot of daySlots) {
      const closer = closers.find(c => c.id === slot.closer_id);
      if (!closer) continue;
      
      // Parse o horário do slot (formato HH:mm:ss)
      const [hour, minute] = slot.start_time.split(':').map(Number);
      const slotTime = setMinutes(setHours(startOfDay(selectedDate), hour), minute);
      
      // Verificar se o slot é no futuro
      if (isAfter(slotTime, new Date())) {
        // Verificar se já está reservado
        const isBooked = bookedSlots?.some(booked => {
          const bookedTime = new Date(booked.scheduled_at);
          return booked.closer_id === closer.id && 
            format(bookedTime, 'HH:mm') === format(slotTime, 'HH:mm');
        });
        
        // Admin pode ver todos os horários, mesmo os reservados
        if (isAdmin || !isBooked) {
          slots.push({
            closerId: closer.id,
            closerName: closer.name,
            closerColor: (closer as any).color || '#3B82F6',
            datetime: new Date(slotTime),
            duration: 60, // duração padrão
            isBooked: isBooked,
          });
        }
      }
    }
    
    return slots.sort((a, b) => a.datetime.getTime() - b.datetime.getTime());
  }, [selectedDate, closers, daySlots, bookedSlots, isAdmin]);

  // Filter out the current meeting
  const existingMeetings = meetings?.filter(m => m.id !== currentMeetingId) || [];

  // Verificar se a data selecionada é diferente da data atual da reunião
  const isDifferentDay = useMemo(() => {
    if (!selectedDate || !currentMeetingDate) return false;
    return !isSameDay(selectedDate, currentMeetingDate);
  }, [selectedDate, currentMeetingDate]);

  // Permitir mover para outro dia se o participante está como no_show
  // Admin pode mover para qualquer dia independente do status
  const isNoShow = currentAttendeeStatus === 'no_show';
  const blockDifferentDay = isDifferentDay && !isNoShow && !isAdmin;

  // Apply closer filter
  const filteredSlots = useMemo(() => {
    if (!selectedCloser) return availableSlots;
    return availableSlots.filter(slot => slot.closerId === selectedCloser);
  }, [availableSlots, selectedCloser]);

  const filteredMeetings = useMemo(() => {
    if (!selectedCloser) return existingMeetings;
    return existingMeetings.filter(m => m.closer?.id === selectedCloser);
  }, [existingMeetings, selectedCloser]);

  // Mutation para mover attendee para um novo slot
  const moveToNewSlot = useMutation({
    mutationFn: async ({ slot, reason }: { slot: AvailableSlot; reason: string }) => {
      if (!attendee) throw new Error('No attendee');

      const scheduledAt = slot.datetime.toISOString();

      // 1. Verificar se já existe um slot para este closer/horário
      const { data: existingSlot } = await supabase
        .from('meeting_slots')
        .select('id')
        .eq('closer_id', slot.closerId)
        .eq('scheduled_at', scheduledAt)
        .in('status', ['scheduled', 'rescheduled'])
        .maybeSingle();

      let targetSlotId: string;

      if (existingSlot) {
        targetSlotId = existingSlot.id;
      } else {
        const { data: newSlot, error: createError } = await supabase
          .from('meeting_slots')
          .insert({
            closer_id: slot.closerId,
            scheduled_at: scheduledAt,
            duration_minutes: slot.duration,
            status: 'scheduled',
            lead_type: 'A',
          })
          .select()
          .single();

        if (createError) throw createError;
        targetSlotId = newSlot.id;
      }

      // 2. Para no-show sendo reagendado, precisamos criar um NOVO attendee
      // e vincular ao original via parent_attendee_id
      if (isNoShow && isDifferentDay) {
        // Buscar dados do attendee original para copiar
        const { data: originalAttendee } = await supabase
          .from('meeting_slot_attendees')
          .select('contact_id, deal_id, booked_by')
          .eq('id', attendee.id)
          .single();

        if (!originalAttendee) throw new Error('Attendee original não encontrado');

        // Admin preserva status original ao mover para dia diferente
        const shouldPreserveStatusNoShow = isAdmin && 
          ['contract_paid', 'completed', 'refunded', 'approved', 'rejected'].includes(currentAttendeeStatus || '');

        // Criar novo attendee vinculado ao original (reagendamento)
        const { data: newAttendee, error: createAttendeeError } = await supabase
          .from('meeting_slot_attendees')
          .insert({
            meeting_slot_id: targetSlotId,
            contact_id: originalAttendee.contact_id,
            deal_id: originalAttendee.deal_id,
            status: shouldPreserveStatusNoShow ? currentAttendeeStatus : 'rescheduled',
            is_reschedule: !shouldPreserveStatusNoShow,
            parent_attendee_id: attendee.id, // Vincula ao original no-show
            booked_by: originalAttendee.booked_by,
            booked_at: new Date().toISOString(), // Data do reagendamento
          })
          .select()
          .single();

        if (createAttendeeError) throw createAttendeeError;

        // Mover partners para o novo attendee
        await supabase
          .from('meeting_slot_attendees')
          .update({ 
            meeting_slot_id: targetSlotId,
            parent_attendee_id: newAttendee.id
          })
          .eq('parent_attendee_id', attendee.id);

        // Registrar log de movimentação
        const { data: authData } = await supabase.auth.getUser();
        let movedByName = null;
        
        if (authData?.user?.id) {
          const { data: userProfile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', authData.user.id)
            .single();
          movedByName = userProfile?.full_name;
        }

        await supabase.from('attendee_movement_logs').insert({
          attendee_id: newAttendee.id,
          from_slot_id: currentMeetingId,
          to_slot_id: targetSlotId,
          from_scheduled_at: currentMeetingDate?.toISOString() || null,
          to_scheduled_at: scheduledAt,
          from_closer_id: currentCloserId || null,
          from_closer_name: currentCloserName || null,
          to_closer_id: slot.closerId,
          to_closer_name: slot.closerName,
          previous_status: currentAttendeeStatus || null,
          reason: reason || null,
          movement_type: shouldPreserveStatusNoShow ? 'transfer_preserved' : 'no_show_reschedule',
          moved_by: authData?.user?.id || null,
          moved_by_name: movedByName,
          moved_by_role: null
        });

        // Adicionar nota técnica ao novo attendee
        await supabase.from('attendee_notes').insert({
          attendee_id: newAttendee.id,
          note: `[REAGENDAMENTO] Motivo: ${reason || 'Não informado'}. Original: ${currentCloserName || 'N/A'} em ${currentMeetingDate ? format(currentMeetingDate, "dd/MM 'às' HH:mm") : 'N/A'}. Status anterior: No-Show.`,
          note_type: 'reschedule',
          created_by: authData?.user?.id || null,
        });

        // Sync deal stage back to R1 Agendada only if NOT preserving status
        if (originalAttendee.deal_id && !shouldPreserveStatusNoShow) {
          await syncDealStageFromAgenda(originalAttendee.deal_id, 'rescheduled', 'r1');
          
          // Mark deal as rescheduled in custom_fields
          const { data: currentDeal } = await supabase
            .from('crm_deals')
            .select('custom_fields')
            .eq('id', originalAttendee.deal_id)
            .single();
          
          const currentFields = (currentDeal?.custom_fields as Record<string, unknown>) || {};
          const rescheduleCount = (currentFields.reschedule_count as number) || 0;
          
          await supabase
            .from('crm_deals')
            .update({ 
              custom_fields: {
                ...currentFields,
                is_rescheduled: true,
                reschedule_count: rescheduleCount + 1,
                last_reschedule_at: new Date().toISOString()
              }
            })
            .eq('id', originalAttendee.deal_id);
        }

        return { id: targetSlotId, newAttendeeId: newAttendee.id };
      }
      // Para movimentações no mesmo dia, apenas atualizar o attendee existente
      // Admin preserva status original (contract_paid, completed, etc)
      // Usuários normais sempre marcam como rescheduled
      const shouldPreserveStatus = isAdmin && 
        ['contract_paid', 'completed', 'refunded', 'approved', 'rejected'].includes(currentAttendeeStatus || '');

      const { error: moveError } = await supabase
        .from('meeting_slot_attendees')
        .update({ 
          meeting_slot_id: targetSlotId,
          status: shouldPreserveStatus ? currentAttendeeStatus : 'rescheduled',
          is_reschedule: !shouldPreserveStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', attendee.id);

      if (moveError) throw moveError;

      // Mover partners vinculados
      await supabase
        .from('meeting_slot_attendees')
        .update({ meeting_slot_id: targetSlotId })
        .eq('parent_attendee_id', attendee.id);

      // Limpar slot antigo se ficou órfão
      const { count } = await supabase
        .from('meeting_slot_attendees')
        .select('*', { count: 'exact', head: true })
        .eq('meeting_slot_id', currentMeetingId);

      if (count === 0) {
        await supabase
          .from('meeting_slots')
          .update({ status: 'canceled' })
          .eq('id', currentMeetingId);
      }

      // Registrar log de movimentação
      const { data: authData } = await supabase.auth.getUser();
      let movedByName = null;
      
      if (authData?.user?.id) {
        const { data: userProfile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', authData.user.id)
          .single();
        movedByName = userProfile?.full_name;
      }

      await supabase.from('attendee_movement_logs').insert({
        attendee_id: attendee.id,
        from_slot_id: currentMeetingId,
        to_slot_id: targetSlotId,
        from_scheduled_at: currentMeetingDate?.toISOString() || null,
        to_scheduled_at: scheduledAt,
        from_closer_id: currentCloserId || null,
        from_closer_name: currentCloserName || null,
        to_closer_id: slot.closerId,
        to_closer_name: slot.closerName,
        previous_status: currentAttendeeStatus || null,
        reason: reason || null,
        movement_type: shouldPreserveStatus ? 'transfer_preserved' : 'same_day_reschedule',
        moved_by: authData?.user?.id || null,
        moved_by_name: movedByName,
        moved_by_role: null
      });

      return { id: targetSlotId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agenda-meetings'] });
      queryClient.invalidateQueries({ queryKey: ['agenda-stats'] });
      queryClient.invalidateQueries({ queryKey: ['meeting_slots'] });
      queryClient.invalidateQueries({ queryKey: ['booked-slots'] });
      queryClient.invalidateQueries({ queryKey: ['sdr-meetings-from-agenda'] });
      queryClient.invalidateQueries({ queryKey: ['sdr-meetings-v2'] });
      queryClient.invalidateQueries({ queryKey: ['sdr-metrics-v2'] });
      queryClient.invalidateQueries({ queryKey: ['attendee-movement-history'] });
      toast.success('Participante movido com sucesso');
      onOpenChange(false);
      setSelectedDate(null);
      setMoveReason('');
    },
    onError: () => {
      toast.error('Erro ao mover participante');
    },
  });

  const handleMoveToExisting = (targetMeeting: any) => {
    if (!attendee) return;
    
    // Validar observação obrigatória para no_show em outro dia
    if (isNoShow && isDifferentDay && (!moveReason || moveReason.trim().length < 10)) {
      toast.error('Informe o motivo do reagendamento (mínimo 10 caracteres)');
      return;
    }
    
    moveAttendee.mutate(
      { 
        attendeeId: attendee.id, 
        targetMeetingSlotId: targetMeeting.id,
        currentMeetingId: currentMeetingId || undefined,
        currentMeetingDate: currentMeetingDate?.toISOString(),
        currentAttendeeStatus: currentAttendeeStatus,
        currentCloserId: currentCloserId,
        currentCloserName: currentCloserName,
        targetCloserId: targetMeeting.closer?.id,
        targetCloserName: targetMeeting.closer?.name,
        targetScheduledAt: targetMeeting.scheduled_at,
        reason: moveReason.trim() || undefined,
        isNoShow: isNoShow,
        preserveStatus: isAdmin
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          setSelectedDate(null);
          setMoveReason('');
        }
      }
    );
  };

  const handleMoveToNewSlot = (slot: AvailableSlot) => {
    // Validar observação obrigatória para no_show em outro dia
    if (isNoShow && isDifferentDay && (!moveReason || moveReason.trim().length < 10)) {
      toast.error('Informe o motivo do reagendamento (mínimo 10 caracteres)');
      return;
    }
    moveToNewSlot.mutate({ slot, reason: moveReason.trim() });
  };

  const handleClose = () => {
    onOpenChange(false);
    setSelectedDate(null);
    setSelectedCloser(null);
    setMoveReason('');
  };

  const isLoading = meetingsLoading || moveToNewSlot.isPending || moveAttendee.isPending;

  if (!attendee) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRight className="h-5 w-5" />
            Mover Participante
          </DialogTitle>
          <DialogDescription>
            Movendo <strong>{attendee.name}</strong> para outra reunião.
            {attendee.isPartner && (
              <Badge variant="outline" className="ml-2">Sócio</Badge>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Date Picker */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Selecionar Data</label>
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left">
                  <Calendar className="h-4 w-4 mr-2" />
                  {selectedDate 
                    ? format(selectedDate, "EEEE, dd 'de' MMMM", { locale: ptBR })
                    : 'Escolha uma data'
                  }
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
                  disabled={(date) => !isAdmin && date < startOfToday()}
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Closer Filter */}
          {selectedDate && closers && closers.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Filtrar por Closer</label>
              <Select
                value={selectedCloser || 'all'}
                onValueChange={(value) => setSelectedCloser(value === 'all' ? null : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos os closers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os closers</SelectItem>
                  {closers.map((closer) => (
                    <SelectItem key={closer.id} value={closer.id}>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: (closer as any).color || '#3B82F6' }}
                        />
                        {closer.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Alerta para dias diferentes (bloqueado se não for no_show) */}
          {selectedDate && blockDifferentDay && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Para mover para outro dia, primeiro marque como <strong>"No-Show"</strong>. 
                Apenas remanejamentos no mesmo dia (horário ou closer) são permitidos.
              </AlertDescription>
            </Alert>
          )}

          {/* Aviso informativo quando no_show é movido para outro dia */}
          {selectedDate && isDifferentDay && isNoShow && (
            <Alert className="border-amber-500 bg-amber-500/10">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <AlertDescription className="text-amber-600">
                Lead em <strong>No-Show</strong>: permitido mover para outro dia.
              </AlertDescription>
            </Alert>
          )}

          {/* Campo de observação - obrigatório para no_show em outro dia */}
          {selectedDate && isDifferentDay && isNoShow && !blockDifferentDay && (
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Motivo do Reagendamento <span className="text-destructive">*</span>
              </label>
              <Textarea
                placeholder="Explique o motivo do reagendamento após no-show..."
                value={moveReason}
                onChange={(e) => setMoveReason(e.target.value)}
                className="min-h-[80px]"
              />
              {moveReason.trim().length > 0 && moveReason.trim().length < 10 && (
                <p className="text-xs text-destructive">
                  Mínimo de 10 caracteres obrigatório
                </p>
              )}
            </div>
          )}

          {/* Available Slots & Meetings */}
          {selectedDate && !blockDifferentDay && (
            <ScrollArea className="h-[300px]">
              <div className="space-y-4 pr-4">
                {/* Available Slots Section */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">
                    Slots Disponíveis
                  </label>
                  
                  {filteredSlots.length === 0 ? (
                    <div className="text-center py-4 text-muted-foreground border rounded-lg">
                      <Clock className="h-6 w-6 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Nenhum slot disponível</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filteredSlots.map((slot, idx) => (
                        <div
                          key={`slot-${slot.closerId}-${slot.datetime.getTime()}-${idx}`}
                          className="border rounded-lg p-3 hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div 
                                className="w-3 h-3 rounded-full shrink-0"
                                style={{ backgroundColor: slot.closerColor }}
                              />
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-sm">
                                    {slot.closerName}
                                  </span>
                                  <Badge
                                    variant={slot.isBooked ? 'secondary' : 'outline'}
                                    className={cn(
                                      'text-xs',
                                      slot.isBooked 
                                        ? 'text-amber-600 border-amber-300 bg-amber-50' 
                                        : 'text-green-600 border-green-300'
                                    )}
                                  >
                                    {slot.isBooked ? 'Ocupado (Admin)' : 'Livre'}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <Clock className="h-3 w-3" />
                                  <span>{format(slot.datetime, 'HH:mm')}</span>
                                  <span>•</span>
                                  <span>{slot.duration}min</span>
                                </div>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              onClick={() => handleMoveToNewSlot(slot)}
                              disabled={isLoading}
                            >
                              Mover
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Existing Meetings Section */}
                {filteredMeetings.length > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-muted-foreground">
                        Encaixar em Reunião Existente
                      </label>
                      
                      <div className="space-y-2">
                        {filteredMeetings.map((meeting) => {
                          const attendeeCount = meeting.attendees?.filter(a => !a.is_partner).length || 0;
                          const scheduledAt = new Date(meeting.scheduled_at);
                          
                          return (
                            <div
                              key={meeting.id}
                              className="border rounded-lg p-3 hover:bg-muted/50 transition-colors"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div 
                                    className="w-3 h-3 rounded-full shrink-0"
                                    style={{ backgroundColor: meeting.closer?.color || '#3B82F6' }}
                                  />
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium text-sm">
                                        {meeting.closer?.name}
                                      </span>
                                      <Badge 
                                        variant={meeting.status === 'completed' ? 'secondary' : 'outline'}
                                        className={cn(
                                          'text-xs',
                                          meeting.status === 'completed' 
                                            ? 'text-blue-600 border-blue-300 bg-blue-50' 
                                            : 'text-green-600 border-green-300'
                                        )}
                                      >
                                        {meeting.status === 'completed' ? 'Realizada' : 'Agendada'}
                                      </Badge>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                      <Clock className="h-3 w-3" />
                                      <span>{format(scheduledAt, 'HH:mm')}</span>
                                      <span>•</span>
                                      <Users className="h-3 w-3" />
                                      <span>{attendeeCount} participante{attendeeCount !== 1 ? 's' : ''}</span>
                                    </div>
                                  </div>
                                </div>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleMoveToExisting(meeting)}
                                  disabled={isLoading}
                                >
                                  Encaixar
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </ScrollArea>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
