import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useUpdateCRMDeal } from '@/hooks/useCRMData';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, XCircle } from 'lucide-react';
import { useLossReasons } from '@/hooks/useLossReasons';
import { isSemInteresseStageName, registrarMotivoSemInteresse } from '@/lib/lossReasons';

interface MarkAsLostModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dealId: string;
  dealName: string;
  originId?: string;
  currentCustomFields?: Record<string, any>;
  onSuccess?: () => void;
}

export const MarkAsLostModal = ({
  open,
  onOpenChange,
  dealId,
  dealName,
  originId,
  currentCustomFields = {},
  onSuccess,
}: MarkAsLostModalProps) => {
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [justification, setJustification] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const updateDeal = useUpdateCRMDeal();
  const { active: lossReasons } = useLossReasons();
  const requiresNote = !!lossReasons.find(r => r.label === selectedReason)?.requires_note;

  const handleConfirm = async () => {
    if (!selectedReason) {
      toast.error('Selecione um motivo da perda');
      return;
    }

    if (requiresNote && !justification.trim()) {
      toast.error('Descreva o motivo da perda');
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Find the "lost" stage for this origin — prefer "sem interesse", fallback "perdido"
      const { data: candidates } = await supabase
        .from('crm_stages')
        .select('id, stage_name, stage_order')
        .eq('origin_id', originId)
        .or('stage_name.ilike.%sem interesse%,stage_name.ilike.%perdido%')
        .order('stage_order', { ascending: false });

      const lostStage =
        (candidates || []).find((s: any) => isSemInteresseStageName(s.stage_name)) ||
        (candidates || []).find((s: any) => (s.stage_name || '').toLowerCase().includes('perdido'));

      if (!lostStage) {
        toast.error('Estágio de perda não encontrado para esta origem');
        setIsSubmitting(false);
        return;
      }

      const reasonLabel = selectedReason;

      // 2. Registrar motivo (RPC faz merge atômico e cria atividade loss_marked)
      await registrarMotivoSemInteresse([dealId], reasonLabel, justification || null);

      // 3. Mover etapa (sem sobrescrever custom_fields)
      await updateDeal.mutateAsync({
        id: dealId,
        stage_id: lostStage.id,
      });

      toast.success('Lead marcado como perdido');
      onOpenChange(false);
      onSuccess?.();

      // Reset form
      setSelectedReason('');
      setJustification('');
    } catch (error) {
      console.error('Error marking deal as lost:', error);
      toast.error('Erro ao marcar lead como perdido');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <XCircle className="h-5 w-5" />
            Marcar Lead como Perdido
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">
            Você está marcando <strong>{dealName}</strong> como perdido. Esta ação moverá o lead para o estágio de perda.
          </p>

          <div className="space-y-2">
            <Label htmlFor="reason">Motivo da perda *</Label>
            <Select value={selectedReason} onValueChange={setSelectedReason}>
              <SelectTrigger id="reason">
                <SelectValue placeholder="Selecione o motivo..." />
              </SelectTrigger>
              <SelectContent>
                {lossReasons.map((reason) => (
                  <SelectItem key={reason.id} value={reason.label}>
                    {reason.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="justification">
              Justificativa {requiresNote ? '*' : '(opcional)'}
            </Label>
            <Textarea
              id="justification"
              placeholder="Detalhe o motivo da perda..."
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={isSubmitting || !selectedReason}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processando...
              </>
            ) : (
              'Confirmar Perda'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
