import React, { useState } from 'react';
import { format, getDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Trash2, Copy, Plus, Loader2, CalendarDays } from 'lucide-react';
import { R2Closer } from '@/hooks/useR2Closers';
import {
  useR2DailySlotsForDate,
  useR2DaysWithSlots,
  useCreateR2DailySlot,
  useDeleteR2DailySlot,
  useUpdateR2DailySlot,
  useCopyWeekdaySlotsToDate,
  useClearR2DailySlotsForDate,
} from '@/hooks/useR2DailySlots';
import { cn } from '@/lib/utils';

const WEEKDAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

interface R2DailySlotConfigProps {
  closer: R2Closer;
}

export function R2DailySlotConfig({ closer }: R2DailySlotConfigProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [newSlotTime, setNewSlotTime] = useState('');
  const [newSlotLink, setNewSlotLink] = useState('');

  // Queries
  const { data: dailySlots = [], isLoading: isLoadingSlots } = useR2DailySlotsForDate(
    closer.id,
    selectedDate
  );
  const { data: daysWithSlots = [] } = useR2DaysWithSlots(closer.id, currentMonth);

  // Mutations
  const createSlot = useCreateR2DailySlot();
  const deleteSlot = useDeleteR2DailySlot();
  const updateSlot = useUpdateR2DailySlot();
  const copyWeekdaySlots = useCopyWeekdaySlotsToDate();
  const clearSlots = useClearR2DailySlotsForDate();

  const handleAddSlot = () => {
    if (!selectedDate || !newSlotTime) return;

    createSlot.mutate({
      closerId: closer.id,
      date: selectedDate,
      startTime: newSlotTime,
      googleMeetLink: newSlotLink || undefined,
    }, {
      onSuccess: () => {
        setNewSlotTime('');
        setNewSlotLink('');
      },
    });
  };

  const handleCopyFromWeekday = () => {
    if (!selectedDate) return;
    copyWeekdaySlots.mutate({ closerId: closer.id, date: selectedDate });
  };

  const handleClearAll = () => {
    if (!selectedDate) return;
    if (confirm('Limpar todos os horários desta data?')) {
      clearSlots.mutate({ closerId: closer.id, date: selectedDate });
    }
  };

  const dayOfWeek = selectedDate ? getDay(selectedDate) : null;
  const weekdayName = dayOfWeek !== null ? WEEKDAY_NAMES[dayOfWeek] : '';

  // Custom day renderer for calendar
  const modifiers = {
    hasSlots: daysWithSlots,
  };

  const modifiersStyles = {
    hasSlots: {
      backgroundColor: closer.color || 'hsl(var(--primary))',
      color: 'white',
      borderRadius: '50%',
    },
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Calendar */}
      <div>
        <Label className="text-sm font-medium mb-2 block">Selecione a data</Label>
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={setSelectedDate}
          month={currentMonth}
          onMonthChange={setCurrentMonth}
          locale={ptBR}
          modifiers={modifiers}
          modifiersStyles={modifiersStyles}
          className="rounded-md border"
        />
        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: closer.color || 'hsl(var(--primary))' }}
          />
          <span>Dias com horários configurados</span>
        </div>
      </div>

      {/* Slot Configuration */}
      <div>
        {!selectedDate ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <CalendarDays className="h-12 w-12 mb-2" />
            <p>Selecione uma data no calendário</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Date Header */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">
                  {format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}
                </h3>
                <Badge variant="outline">{weekdayName}</Badge>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyFromWeekday}
                  disabled={copyWeekdaySlots.isPending}
                >
                  {copyWeekdaySlots.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Copy className="h-4 w-4 mr-1" />
                  )}
                  Copiar de {weekdayName}
                </Button>
                {dailySlots.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClearAll}
                    disabled={clearSlots.isPending}
                    className="text-destructive hover:text-destructive"
                  >
                    Limpar
                  </Button>
                )}
              </div>
            </div>

            {/* Configured Slots */}
            <ScrollArea className="h-[200px]">
              {isLoadingSlots ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : dailySlots.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Nenhum horário configurado</p>
                  <p className="text-xs mt-1">
                    Use "Copiar de {weekdayName}" ou adicione manualmente
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {dailySlots.map((slot) => (
                    <div
                      key={slot.id}
                      className="flex items-center gap-2 p-2 rounded-md border bg-card"
                    >
                      <Badge variant="secondary" className="font-mono">
                        {slot.start_time.substring(0, 5)}
                      </Badge>
                      <Input
                        value={slot.google_meet_link || ''}
                        onChange={(e) => {
                          updateSlot.mutate({
                            slotId: slot.id,
                            googleMeetLink: e.target.value,
                          });
                        }}
                        placeholder="Link do Meet"
                        className="flex-1 h-8 text-xs"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => deleteSlot.mutate(slot.id)}
                        disabled={deleteSlot.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>

            {/* Add New Slot */}
            <div className="border-t pt-4">
              <Label className="text-sm font-medium mb-2 block">Adicionar horário</Label>
              <div className="flex gap-2">
                <Input
                  type="time"
                  value={newSlotTime}
                  onChange={(e) => setNewSlotTime(e.target.value)}
                  className="w-28"
                />
                <Input
                  value={newSlotLink}
                  onChange={(e) => setNewSlotLink(e.target.value)}
                  placeholder="Link do Meet (opcional)"
                  className="flex-1"
                />
                <Button
                  onClick={handleAddSlot}
                  disabled={!newSlotTime || createSlot.isPending}
                  size="icon"
                >
                  {createSlot.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
