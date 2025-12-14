import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, Clock, Save, Phone, MessageCircle, Mail, Video, AlertCircle } from 'lucide-react';
import { useSaveNextAction, NextActionType } from '@/hooks/useNextAction';

interface NextActionBlockProps {
  dealId: string;
  currentType?: string | null;
  currentDate?: string | null;
  currentNote?: string | null;
  onSaved?: () => void;
}

const ACTION_OPTIONS: { value: NextActionType; label: string; icon: React.ReactNode }[] = [
  { value: 'ligar', label: 'Ligar', icon: <Phone className="h-4 w-4" /> },
  { value: 'whatsapp', label: 'WhatsApp', icon: <MessageCircle className="h-4 w-4" /> },
  { value: 'email', label: 'Email', icon: <Mail className="h-4 w-4" /> },
  { value: 'reuniao', label: 'Reunião', icon: <Video className="h-4 w-4" /> },
];

export const NextActionBlock = ({ 
  dealId, 
  currentType, 
  currentDate, 
  currentNote,
  onSaved 
}: NextActionBlockProps) => {
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
    if (!actionType) {
      return;
    }
    
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
      "rounded-lg border p-4 space-y-4",
      isOverdue ? "border-destructive/50 bg-destructive/5" : "border-border bg-secondary/30"
    )}>
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          Próxima Ação
        </h3>
        {isOverdue && (
          <span className="text-xs text-destructive flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            Atrasada
          </span>
        )}
      </div>
      
      <div className="grid gap-3">
        {/* Tipo de ação */}
        <div>
          <Label className="text-xs text-muted-foreground">Tipo</Label>
          <Select 
            value={actionType || ''} 
            onValueChange={(v) => setActionType(v as NextActionType)}
          >
            <SelectTrigger className="bg-background">
              <SelectValue placeholder="Selecione o tipo..." />
            </SelectTrigger>
            <SelectContent>
              {ACTION_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  <div className="flex items-center gap-2">
                    {option.icon}
                    {option.label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        {/* Data e Hora */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs text-muted-foreground">Data</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal bg-background",
                    !actionDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {actionDate ? format(actionDate, "dd/MM/yy", { locale: ptBR }) : "Escolher"}
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
          </div>
          
          <div>
            <Label className="text-xs text-muted-foreground">Hora</Label>
            <Input
              type="time"
              value={actionTime}
              onChange={(e) => setActionTime(e.target.value)}
              className="bg-background"
            />
          </div>
        </div>
        
        {/* Observação */}
        <div>
          <Label className="text-xs text-muted-foreground">Observação rápida</Label>
          <Input
            placeholder="Ex: Retornar sobre proposta..."
            value={actionNote}
            onChange={(e) => setActionNote(e.target.value)}
            className="bg-background"
          />
        </div>
        
        {/* Botão salvar */}
        <Button
          onClick={handleSave}
          disabled={!actionType || saveNextAction.isPending}
          className="w-full"
          variant={hasChanges ? "default" : "secondary"}
        >
          <Save className="h-4 w-4 mr-2" />
          {saveNextAction.isPending ? 'Salvando...' : 'Salvar Próxima Ação'}
        </Button>
      </div>
    </div>
  );
};
