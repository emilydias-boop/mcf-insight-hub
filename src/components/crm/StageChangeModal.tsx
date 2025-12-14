import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useSaveNextAction } from '@/hooks/useNextAction';
import { CheckCircle2 } from 'lucide-react';

interface StageChangeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dealId: string;
  dealName: string;
  newStageName: string;
}

const ACTION_TYPES = [
  { value: 'ligar', label: '📞 Ligar' },
  { value: 'whatsapp', label: '💬 WhatsApp' },
  { value: 'email', label: '📧 Email' },
  { value: 'reuniao', label: '📅 Reunião' },
];

export const StageChangeModal = ({
  open,
  onOpenChange,
  dealId,
  dealName,
  newStageName,
}: StageChangeModalProps) => {
  const [actionType, setActionType] = useState('');
  const [actionDate, setActionDate] = useState('');
  const [actionTime, setActionTime] = useState('');
  const [actionNote, setActionNote] = useState('');
  
  const saveNextAction = useSaveNextAction();

  const handleSave = () => {
    if (!actionType || !actionDate) {
      onOpenChange(false);
      return;
    }

    const dateTime = actionTime 
      ? new Date(`${actionDate}T${actionTime}:00`) 
      : new Date(`${actionDate}T09:00:00`);

    saveNextAction.mutate({
      dealId,
      actionType: actionType as 'ligar' | 'whatsapp' | 'email' | 'reuniao',
      actionDate: dateTime,
      actionNote: actionNote || '',
    }, {
      onSuccess: () => {
        resetForm();
        onOpenChange(false);
      },
    });
  };

  const handleSkip = () => {
    resetForm();
    onOpenChange(false);
  };

  const resetForm = () => {
    setActionType('');
    setActionDate('');
    setActionTime('');
    setActionNote('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            Negócio movido para "{newStageName}"
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">
            Deseja definir a próxima ação para <strong>{dealName}</strong>?
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={actionType} onValueChange={setActionType}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar..." />
                </SelectTrigger>
                <SelectContent>
                  {ACTION_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Data</Label>
              <Input
                type="date"
                value={actionDate}
                onChange={(e) => setActionDate(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Hora</Label>
              <Input
                type="time"
                value={actionTime}
                onChange={(e) => setActionTime(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Observação</Label>
              <Input
                placeholder="Nota rápida..."
                value={actionNote}
                onChange={(e) => setActionNote(e.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleSkip}>
            Pular
          </Button>
          <Button onClick={handleSave} disabled={saveNextAction.isPending}>
            Salvar Próxima Ação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
