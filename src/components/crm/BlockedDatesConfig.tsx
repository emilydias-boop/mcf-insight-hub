import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarOff, Trash2, Plus, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { 
  useBlockedDates,
  useAddBlockedDate, 
  useRemoveBlockedDate 
} from '@/hooks/useAgendaData';

interface BlockedDatesConfigProps {
  closerId: string;
}

export function BlockedDatesConfig({ closerId }: BlockedDatesConfigProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [reason, setReason] = useState('');
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [useSpecificTime, setUseSpecificTime] = useState(false);
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('18:00');

  const { data: allBlockedDates = [] } = useBlockedDates(closerId);
  const addBlockedDate = useAddBlockedDate();
  const removeBlockedDate = useRemoveBlockedDate();

  const closerBlockedDates = allBlockedDates.filter(bd => bd.closer_id === closerId);

  const handleAddDate = () => {
    if (!selectedDate) return;
    
    addBlockedDate.mutate({
      closerId,
      date: selectedDate,
      reason: reason || undefined,
      blocked_start_time: useSpecificTime ? startTime : undefined,
      blocked_end_time: useSpecificTime ? endTime : undefined,
    });
    
    setSelectedDate(undefined);
    setReason('');
    setUseSpecificTime(false);
    setStartTime('08:00');
    setEndTime('18:00');
    setCalendarOpen(false);
  };

  const handleRemoveDate = (id: string) => {
    removeBlockedDate.mutate(id);
  };

  const blockedDatesList = closerBlockedDates
    .sort((a, b) => new Date(a.blocked_date).getTime() - new Date(b.blocked_date).getTime());

  return (
    <div className="space-y-4">
      {/* Add New Blocked Date */}
      <div className="border rounded-lg p-4 space-y-3">
        <Label className="flex items-center gap-2">
          <CalendarOff className="h-4 w-4" />
          Adicionar Bloqueio
        </Label>
        
        <div className="flex gap-2">
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="flex-1 justify-start">
                {selectedDate 
                  ? format(selectedDate, "dd 'de' MMMM, yyyy", { locale: ptBR })
                  : "Selecionar data"
                }
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                locale={ptBR}
                disabled={(date) => date < new Date()}
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Toggle for specific time */}
        <div className="flex items-center justify-between">
          <Label htmlFor="specific-time" className="flex items-center gap-2 text-sm cursor-pointer">
            <Clock className="h-4 w-4" />
            Bloquear horário específico
          </Label>
          <Switch
            id="specific-time"
            checked={useSpecificTime}
            onCheckedChange={setUseSpecificTime}
          />
        </div>

        {/* Time inputs */}
        {useSpecificTime && (
          <div className="flex gap-2 items-center">
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground">Início</Label>
              <Input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <span className="text-muted-foreground mt-5">até</span>
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground">Fim</Label>
              <Input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>
        )}
        
        <Input
          placeholder="Motivo (opcional)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        
        <Button 
          onClick={handleAddDate} 
          disabled={!selectedDate || addBlockedDate.isPending}
          className="w-full"
        >
          <Plus className="h-4 w-4 mr-2" />
          Adicionar Bloqueio
        </Button>
      </div>

      {/* List of Blocked Dates */}
      <div className="border rounded-lg p-4">
        <Label className="mb-3 block">Datas Bloqueadas</Label>
        
        {blockedDatesList.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhuma data bloqueada
          </p>
        ) : (
          <ScrollArea className="h-[200px]">
            <div className="space-y-2">
              {blockedDatesList.map(bd => (
                <div
                  key={bd.id}
                  className="flex items-center justify-between p-2 bg-muted/50 rounded"
                >
                  <div>
                    <div className="text-sm font-medium">
                      {format(parseISO(bd.blocked_date), "dd 'de' MMMM, yyyy", { locale: ptBR })}
                      {bd.blocked_start_time && bd.blocked_end_time ? (
                        <span className="text-xs text-muted-foreground ml-2">
                          {bd.blocked_start_time.slice(0, 5)} até {bd.blocked_end_time.slice(0, 5)}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground ml-2">(Dia inteiro)</span>
                      )}
                    </div>
                    {bd.reason && (
                      <div className="text-xs text-muted-foreground">{bd.reason}</div>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveDate(bd.id)}
                    disabled={removeBlockedDate.isPending}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}
