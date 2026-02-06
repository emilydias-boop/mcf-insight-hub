import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useCreateGRAction } from '@/hooks/useGRActions';
import { GRActionType, GR_ACTION_LABELS } from '@/types/gr-types';
import { Loader2 } from 'lucide-react';

interface GRActionModalProps {
  entryId: string;
  open: boolean;
  onClose: () => void;
}

const ACTION_TYPES: GRActionType[] = [
  'reuniao_agendada',
  'reuniao_realizada',
  'diagnostico',
  'produto_sugerido',
  'nota',
  'contato_telefonico',
  'contato_whatsapp',
  'encaminhamento_bu',
];

export const GRActionModal = ({ entryId, open, onClose }: GRActionModalProps) => {
  const [actionType, setActionType] = useState<GRActionType>('nota');
  const [description, setDescription] = useState('');
  
  const createAction = useCreateGRAction();
  
  const handleSubmit = async () => {
    await createAction.mutateAsync({
      entry_id: entryId,
      action_type: actionType,
      description: description || undefined,
    });
    
    setActionType('nota');
    setDescription('');
    onClose();
  };
  
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar Ação</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Tipo de Ação</Label>
            <Select value={actionType} onValueChange={(v) => setActionType(v as GRActionType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACTION_TYPES.map(type => (
                  <SelectItem key={type} value={type}>
                    {GR_ACTION_LABELS[type].icon} {GR_ACTION_LABELS[type].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label>Descrição (opcional)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detalhes sobre a ação..."
              rows={4}
            />
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={createAction.isPending}>
            {createAction.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
