import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Loader2, ArrowRightLeft } from 'lucide-react';
import { useCRMStages, useUpdateCRMDeal } from '@/hooks/useCRMData';
import { useCreateDealActivity } from '@/hooks/useDealActivities';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface BulkMoveStageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDealIds: string[];
  originId: string | undefined;
  onSuccess: () => void;
}

export const BulkMoveStageDialog = ({
  open,
  onOpenChange,
  selectedDealIds,
  originId,
  onSuccess,
}: BulkMoveStageDialogProps) => {
  const [targetStageId, setTargetStageId] = useState<string>('');
  const [isMoving, setIsMoving] = useState(false);
  const { data: stages } = useCRMStages(originId);
  const queryClient = useQueryClient();

  const handleMove = async () => {
    if (!targetStageId || selectedDealIds.length === 0) return;

    setIsMoving(true);
    try {
      const { error } = await supabase
        .from('crm_deals')
        .update({ stage_id: targetStageId })
        .in('id', selectedDealIds);

      if (error) throw error;

      toast.success(`${selectedDealIds.length} lead(s) movido(s) com sucesso`);
      queryClient.invalidateQueries({ queryKey: ['crm-deals'] });
      queryClient.invalidateQueries({ queryKey: ['deal-activities'] });
      setTargetStageId('');
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      console.error('Erro ao mover deals:', err);
      toast.error('Erro ao mover leads. Tente novamente.');
    } finally {
      setIsMoving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5" />
            Mover Estágio em Massa
          </DialogTitle>
          <DialogDescription>
            Mover {selectedDealIds.length} lead(s) para o estágio selecionado.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Estágio destino</Label>
            <Select value={targetStageId} onValueChange={setTargetStageId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o estágio" />
              </SelectTrigger>
              <SelectContent>
                {(stages || []).map((stage: any) => (
                  <SelectItem key={stage.id} value={stage.id}>
                    {stage.stage_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isMoving}>
            Cancelar
          </Button>
          <Button onClick={handleMove} disabled={!targetStageId || isMoving}>
            {isMoving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Movendo...
              </>
            ) : (
              `Mover ${selectedDealIds.length} lead(s)`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
