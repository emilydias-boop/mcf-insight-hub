import { useMemo, useState } from 'react';
import { format, isBefore, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarDays, Trash2, Clock, LifeBuoy, CalendarPlus, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';

import {
  useR1SupportDaysForCloser,
  useR1SupportDaysWithSlots,
  useCreateR1SupportDay,
  useDeleteR1SupportDay,
  type R1SupportDayRow,
} from '@/hooks/useR1SupportDays';
import { cn } from '@/lib/utils';

interface R1SupportDaysConfigProps {
  closer: {
    id: string;
    name: string;
    color?: string | null;
  };
  onNavigateAway?: () => void;
}

const TIME_MIN = '06:00';
const TIME_MAX = '22:00';

function formatWindow(row: R1SupportDayRow): string | null {
  if (!row.start_time && !row.end_time) return null;
  const start = (row.start_time ?? '').slice(0, 5);
  const end = (row.end_time ?? '').slice(0, 5);
  if (!start || !end) return null;
  return `${start}–${end}`;
}

export function R1SupportDaysConfig({ closer, onNavigateAway }: R1SupportDaysConfigProps) {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());
  const [allDay, setAllDay] = useState(true);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('18:00');
  const [notes, setNotes] = useState('');

  const today = startOfDay(new Date());

  const { data: rows, isLoading } = useR1SupportDaysForCloser(closer.id);
  const { data: monthDates } = useR1SupportDaysWithSlots(closer.id, calendarMonth);
  const createMutation = useCreateR1SupportDay();
  const deleteMutation = useDeleteR1SupportDay();

  const releasedDateKeys = useMemo(
    () => new Set((rows || []).map((r) => r.support_date)),
    [rows]
  );

  const closerColor = closer.color || 'hsl(var(--primary))';

  const handleRelease = async () => {
    if (!selectedDate) {
      toast.error('Selecione uma data no calendário');
      return;
    }

    let payloadStart: string | null = null;
    let payloadEnd: string | null = null;

    if (!allDay) {
      if (!startTime || !endTime) {
        toast.error('Informe início e fim da janela');
        return;
      }
      if (startTime < TIME_MIN || endTime > TIME_MAX) {
        toast.error(`Janela deve estar entre ${TIME_MIN} e ${TIME_MAX}`);
        return;
      }
      if (startTime >= endTime) {
        toast.error('O horário de início deve ser anterior ao fim');
        return;
      }
      payloadStart = `${startTime}:00`;
      payloadEnd = `${endTime}:00`;
    }

    const created = await createMutation.mutateAsync({
      closerId: closer.id,
      date: selectedDate,
      startTime: payloadStart,
      endTime: payloadEnd,
      notes: notes.trim() || null,
    });

    // Reset campos auxiliares (mantém data selecionada para feedback visual)
    setNotes('');

    // Toast secundário explicando o efeito
    if (created) {
      const dateLabel = format(selectedDate, "dd/MM/yyyy", { locale: ptBR });
      toast.message(`${closer.name} agora pode agendar R1 em ${dateLabel}`, {
        description: 'Acesso à grade completa, busca de leads e agendamento liberados.',
      });
    }
  };

  const handleDelete = async (row: R1SupportDayRow) => {
    await deleteMutation.mutateAsync({ id: row.id, closerId: closer.id });
  };

  const selectedDateKey = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : null;
  const isSelectedAlreadyReleased = selectedDateKey ? releasedDateKeys.has(selectedDateKey) : false;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-6">
      {/* Coluna esquerda: Calendário */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <CalendarDays className="h-4 w-4" />
          Calendário
        </div>
        <div className="rounded-md border bg-card">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={setSelectedDate}
            month={calendarMonth}
            onMonthChange={setCalendarMonth}
            locale={ptBR}
            disabled={(d) => isBefore(startOfDay(d), today)}
            modifiers={{ released: monthDates || [] }}
            modifiersStyles={{
              released: {
                backgroundColor: closerColor,
                color: 'hsl(var(--primary-foreground))',
                fontWeight: 600,
              },
            }}
            className={cn('p-3 pointer-events-auto')}
          />
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span
            className="inline-block w-3 h-3 rounded-full border"
            style={{ backgroundColor: closerColor }}
          />
          Dias liberados para apoio R1
        </div>
      </div>

      {/* Coluna direita: Detalhes do dia + lista */}
      <div className="space-y-4">
        {/* Alert explicativo: o que o apoio R1 destrava */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>O que o apoio R1 habilita?</AlertTitle>
          <AlertDescription>
            Nos dias liberados, <strong>{closer.name}</strong> poderá:
            <ul className="list-disc pl-5 mt-1 space-y-0.5 text-xs">
              <li>Acessar a Agenda R1 com grade completa</li>
              <li>Buscar leads de qualquer SDR da BU</li>
              <li>Agendar reuniões R1 (para si ou para outros closers R1)</li>
              <li>Acessar pipeline de Negócios da BU</li>
            </ul>
          </AlertDescription>
        </Alert>

        {selectedDate ? (
          <div className="rounded-md border p-4 space-y-4 bg-card">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <div className="text-base font-semibold capitalize">
                  {format(selectedDate, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </div>
                <div className="text-xs text-muted-foreground capitalize">
                  {format(selectedDate, 'EEEE', { locale: ptBR })}
                </div>
              </div>
              {isSelectedAlreadyReleased && (
                <Badge variant="secondary">Já liberado</Badge>
              )}
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="all-day-switch" className="text-sm">
                  Dia inteiro
                </Label>
                <p className="text-xs text-muted-foreground">
                  Desligue para definir uma janela específica
                </p>
              </div>
              <Switch
                id="all-day-switch"
                checked={allDay}
                onCheckedChange={setAllDay}
              />
            </div>

            {!allDay && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="start-time" className="text-xs">Início</Label>
                  <Input
                    id="start-time"
                    type="time"
                    step={900}
                    min={TIME_MIN}
                    max={TIME_MAX}
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="end-time" className="text-xs">Fim</Label>
                  <Input
                    id="end-time"
                    type="time"
                    step={900}
                    min={TIME_MIN}
                    max={TIME_MAX}
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div className="space-y-1">
              <Label htmlFor="notes" className="text-xs">Observação (opcional)</Label>
              <Input
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex.: cobrindo falta do João"
                maxLength={200}
              />
            </div>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    className="w-full"
                    onClick={handleRelease}
                    disabled={createMutation.isPending}
                  >
                    <LifeBuoy className="h-4 w-4 mr-2" />
                    {createMutation.isPending ? 'Liberando...' : 'Liberar dia de apoio R1'}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  O closer poderá agendar e atender reuniões R1 nesta data
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        ) : (
          <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            Selecione uma data no calendário para liberar apoio R1.
          </div>
        )}

        {/* Lista de datas liberadas */}
        <div className="rounded-md border bg-card">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <div className="text-sm font-medium">Datas liberadas</div>
            <Badge variant="outline">{rows?.length ?? 0}</Badge>
          </div>
          <ScrollArea className="h-[260px]">
            <div className="p-2 space-y-1">
              {isLoading ? (
                <>
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </>
              ) : (rows?.length ?? 0) === 0 ? (
                <div className="text-center text-xs text-muted-foreground py-8">
                  Nenhuma data liberada para apoio R1.
                </div>
              ) : (
                rows!.map((row) => {
                  const window = formatWindow(row);
                  const dateObj = new Date(row.support_date + 'T12:00:00');
                  const isPast = isBefore(startOfDay(dateObj), today);
                  return (
                    <div
                      key={row.id}
                      className={cn(
                        'flex items-center justify-between gap-2 rounded-md px-3 py-2 border bg-background',
                        isPast && 'opacity-60'
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium capitalize">
                            {format(dateObj, "EEE, dd/MM/yyyy", { locale: ptBR })}
                          </span>
                          {window ? (
                            <Badge variant="secondary" className="gap-1">
                              <Clock className="h-3 w-3" /> {window}
                            </Badge>
                          ) : (
                            <Badge variant="outline">Dia inteiro</Badge>
                          )}
                          {isPast && <Badge variant="outline">Expirado</Badge>}
                        </div>
                        {row.notes && (
                          <div className="text-xs text-muted-foreground truncate mt-0.5">
                            {row.notes}
                          </div>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(row)}
                        disabled={deleteMutation.isPending}
                        aria-label="Remover liberação"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Atalho: abrir Agenda R1 já com este closer pré-selecionado */}
        {(rows?.length ?? 0) > 0 && (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              onNavigateAway?.();
              navigate(`/crm/agenda?openSchedule=1&closerId=${closer.id}`);
            }}
          >
            <CalendarPlus className="h-4 w-4 mr-2" />
            Abrir Agenda R1 para agendar agora
          </Button>
        )}
      </div>
    </div>
  );
}

export default R1SupportDaysConfig;