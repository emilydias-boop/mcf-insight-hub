import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, Save, Phone, MessageCircle, Mail, Video, AlertCircle, Loader2 } from 'lucide-react';
import { useSaveNextAction, NextActionType } from '@/hooks/useNextAction';

interface NextActionBlockCompactProps {
  dealId: string;
  currentType?: string | null;
  currentDate?: string | null;
  currentNote?: string | null;
  onSaved?: () => void;
}

const ACTION_OPTIONS: { value: NextActionType; label: string; icon: React.ReactNode }[] = [
  { value: 'ligar', label: 'Ligar', icon: <Phone className="h-3.5 w-3.5" /> },
  { value: 'whatsapp', label: 'WhatsApp', icon: <MessageCircle className="h-3.5 w-3.5" /> },
  { value: 'email', label: 'Email', icon: <Mail className="h-3.5 w-3.5" /> },
  { value: 'reuniao', label: 'Reunião', icon: <Video className="h-3.5 w-3.5" /> },
];

export const NextActionBlockCompact = ({ 
  dealId, 
  currentType, 
  currentDate, 
  currentNote,
  onSaved 
}: NextActionBlockCompactProps) => {
  const [actionType, setActionType] = useState<NextActionType | null>(
    (currentType as NextActionType) || null
  );
  const [actionDate, setActionDate] = useState<Date | undefined>(
    currentDate ? new Date(currentDate) : undefined
  );
  const [actionTime, setActionTime] = useState(
    currentDate ? format(new Date(currentDate), 'HH:mm') : '09:00'
  );
  const [actionNote, setActionNote] = useState(currentNote || '');
  
  const saveNextAction = useSaveNextAction();
  
  useEffect(() => {
    setActionType((currentType as NextActionType) || null);
    setActionDate(currentDate ? new Date(currentDate) : undefined);
    setActionTime(currentDate ? format(new Date(currentDate), 'HH:mm') : '09:00');
    setActionNote(currentNote || '');
  }, [currentType, currentDate, currentNote]);
  
  const handleSave = async () => {
    if (!actionType) return;
    
    let finalDate: Date | null = null;
    if (actionDate) {
      const [hours, minutes] = actionTime.split(':').map(Number);
      finalDate = new Date(actionDate);
      finalDate.setHours(hours, minutes, 0, 0);
    }
    
    await saveNextAction.mutateAsync({
      dealId,
      actionType,
      actionDate: finalDate,
      actionNote
    });
    
    onSaved?.();
  };
  
  const isOverdue = currentDate && new Date(currentDate) < new Date();
  const hasChanges = 
    actionType !== (currentType || null) ||
    actionNote !== (currentNote || '') ||
    (actionDate?.toISOString() || null) !== currentDate;
  
  return (
    <div className={cn(
      "rounded-lg border p-2 space-y-1.5",
      isOverdue ? "border-destructive/50 bg-destructive/5" : "border-border bg-secondary/30"
    )}>
      {/* Título compacto com indicador de atraso - na mesma linha */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">Próxima Ação</span>
        {isOverdue && (
          <span className="text-[10px] text-destructive flex items-center gap-0.5 bg-destructive/10 px-1.5 py-0.5 rounded">
            <AlertCircle className="h-2.5 w-2.5" />
            Atrasada
          </span>
        )}
      </div>
      
      {/* Linha 1: Tipo + Data + Hora + Salvar */}
      <div className="flex gap-1.5 items-center">
        {/* Tipo */}
        <Select 
          value={actionType || ''} 
          onValueChange={(v) => setActionType(v as NextActionType)}
        >
          <SelectTrigger className="w-[110px] h-9 bg-background text-xs">
            <SelectValue placeholder="Tipo..." />
          </SelectTrigger>
          <SelectContent>
            {ACTION_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                <div className="flex items-center gap-1.5">
                  {option.icon}
                  <span className="text-xs">{option.label}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        {/* Data */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "w-[100px] h-9 justify-start text-left font-normal bg-background text-xs",
                !actionDate && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-1 h-3.5 w-3.5" />
              {actionDate ? format(actionDate, "dd/MM", { locale: ptBR }) : "Data"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={actionDate}
              onSelect={setActionDate}
              initialFocus
              locale={ptBR}
              className="pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
        
        {/* Hora */}
        <Input
          type="time"
          value={actionTime}
          onChange={(e) => setActionTime(e.target.value)}
          className="w-[85px] h-9 bg-background text-xs"
        />
        
        {/* Botão salvar compacto */}
        <Button
          size="icon"
          variant={hasChanges ? "default" : "secondary"}
          className="h-9 w-9 shrink-0"
          onClick={handleSave}
          disabled={!actionType || saveNextAction.isPending}
        >
          {saveNextAction.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
        </Button>
      </div>
      
      {/* Linha 2: Observação mais compacta */}
      <Input
        placeholder="Obs. rápida..."
        value={actionNote}
        onChange={(e) => setActionNote(e.target.value)}
        className="h-7 bg-background text-xs"
      />
    </div>
  );
};
