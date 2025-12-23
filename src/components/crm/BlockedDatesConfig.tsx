import { useState } from 'react';
import { format, parseISO, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarOff, Trash2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  CloserWithAvailability, 
  BlockedDate, 
  useAddBlockedDate, 
  useRemoveBlockedDate 
} from '@/hooks/useAgendaData';
import { cn } from '@/lib/utils';

interface BlockedDatesConfigProps {
  closers: CloserWithAvailability[];
  blockedDates: BlockedDate[];
}

export function BlockedDatesConfig({ closers, blockedDates }: BlockedDatesConfigProps) {
  const [selectedCloser, setSelectedCloser] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [reason, setReason] = useState('');

  const addBlockedDate = useAddBlockedDate();
  const removeBlockedDate = useRemoveBlockedDate();

  const handleAdd = () => {
    if (!selectedCloser || !selectedDate) return;

    addBlockedDate.mutate({
      closerId: selectedCloser,
      date: selectedDate,
      reason: reason || undefined,
    }, {
      onSuccess: () => {
        setSelectedDate(undefined);
        setReason('');
      },
    });
  };

  const getCloserName = (closerId: string) => {
    return closers.find(c => c.id === closerId)?.name || 'Desconhecido';
  };

  const getCloserColor = (closerId: string) => {
    return closers.find(c => c.id === closerId)?.color || '#3B82F6';
  };

  // Group blocked dates by closer
  const groupedDates = blockedDates.reduce((acc, bd) => {
    if (!acc[bd.closer_id]) {
      acc[bd.closer_id] = [];
    }
    acc[bd.closer_id].push(bd);
    return acc;
  }, {} as Record<string, BlockedDate[]>);

  return (
    <div className="space-y-6">
      {/* Add New Block */}
      <div className="border rounded-lg p-4 space-y-4">
        <h4 className="font-medium flex items-center gap-2">
          <CalendarOff className="h-4 w-4" />
          Adicionar Bloqueio
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Closer</Label>
            <Select value={selectedCloser} onValueChange={setSelectedCloser}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {closers.map(closer => (
                  <SelectItem key={closer.id} value={closer.id}>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: closer.color }}
                      />
                      {closer.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Data</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button 
                  variant="outline" 
                  className={cn('w-full justify-start', !selectedDate && 'text-muted-foreground')}
                >
                  {selectedDate ? format(selectedDate, 'dd/MM/yyyy') : 'Selecione a data'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  disabled={(date) => date < new Date(new Date().setHours(0,0,0,0))}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>Motivo (opcional)</Label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: Férias, Feriado..."
            />
          </div>
        </div>

        <Button 
          onClick={handleAdd}
          disabled={!selectedCloser || !selectedDate || addBlockedDate.isPending}
          className="w-full md:w-auto"
        >
          <Plus className="h-4 w-4 mr-2" />
          Bloquear Data
        </Button>
      </div>

      {/* Blocked Dates List */}
      <div className="space-y-4">
        <h4 className="font-medium">Datas Bloqueadas</h4>

        {Object.keys(groupedDates).length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhuma data bloqueada
          </p>
        ) : (
          <ScrollArea className="h-[300px]">
            <div className="space-y-4 pr-4">
              {Object.entries(groupedDates).map(([closerId, dates]) => (
                <div key={closerId} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: getCloserColor(closerId) }}
                    />
                    <span className="font-medium text-sm">{getCloserName(closerId)}</span>
                  </div>
                  
                  <div className="pl-5 space-y-1">
                    {dates.sort((a, b) => 
                      new Date(a.blocked_date).getTime() - new Date(b.blocked_date).getTime()
                    ).map(bd => (
                      <div 
                        key={bd.id}
                        className="flex items-center justify-between p-2 rounded-md bg-muted/50 hover:bg-muted"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium">
                            {format(parseISO(bd.blocked_date), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                          </span>
                          {bd.reason && (
                            <span className="text-xs text-muted-foreground">
                              ({bd.reason})
                            </span>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => removeBlockedDate.mutate(bd.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}
