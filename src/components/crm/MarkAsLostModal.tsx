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
import { useCreateDealActivity } from '@/hooks/useDealActivities';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, XCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const LOSS_REASONS = [
  { value: 'sem_interesse', label: 'Sem interesse' },
  { value: 'sem_condicoes', label: 'Sem condições financeiras' },
  { value: 'comprou_concorrente', label: 'Comprou com concorrente' },
  { value: 'telefone_invalido', label: 'Telefone inválido/inexistente' },
  { value: 'nao_responde', label: 'Não responde contato' },
  { value: 'nao_perfil', label: 'Não é o perfil' },
  { value: 'momento_inadequado', label: 'Momento inadequado' },
  { value: 'outro', label: 'Outro' },
];

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
  const createActivity = useCreateDealActivity();
  const { user } = useAuth();

  const handleConfirm = async () => {
    if (!selectedReason) {
      toast.error('Selecione um motivo da perda');
      return;
    }

    if (selectedReason === 'outro' && !justification.trim()) {
      toast.error('Descreva o motivo da perda');
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Find the "lost" stage for this origin
      const { data: lostStage } = await supabase
        .from('crm_stages')
        .select('id, stage_name')
        .eq('origin_id', originId)
        .or('stage_name.ilike.%sem interesse%,stage_name.ilike.%perdido%')
        .order('stage_order', { ascending: false })
        .limit(1)
        .single();

      if (!lostStage) {
        toast.error('Estágio de perda não encontrado para esta origem');
        setIsSubmitting(false);
        return;
      }

      const reasonLabel = LOSS_REASONS.find(r => r.value === selectedReason)?.label || selectedReason;

      // 2. Update deal with new stage and loss info in custom_fields
      await updateDeal.mutateAsync({
        id: dealId,
        stage_id: lostStage.id,
        custom_fields: {
          ...currentCustomFields,
          motivo_sem_interesse: reasonLabel,
          justificativa_perda: justification || null,
          perdido_em: new Date().toISOString(),
          perdido_por: user?.email || null,
        },
      });

      // 3. Log activity
      await createActivity.mutateAsync({
        deal_id: dealId,
        activity_type: 'loss_marked',
        description: `Lead marcado como perdido: ${reasonLabel}${justification ? ` - ${justification}` : ''}`,
        metadata: {
          reason: selectedReason,
          reason_label: reasonLabel,
          justification: justification || null,
          stage_name: lostStage.stage_name,
        },
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
                {LOSS_REASONS.map((reason) => (
                  <SelectItem key={reason.value} value={reason.value}>
                    {reason.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="justification">
              Justificativa {selectedReason === 'outro' ? '*' : '(opcional)'}
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
