import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { useCRMOrigins, useCRMStages, useUpdateCRMDeal } from '@/hooks/useCRMData';
import { useCreateDealActivity } from '@/hooks/useDealActivities';
import { toast } from 'sonner';

interface MoveToPipelineModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dealId: string;
  dealName: string;
  currentOriginId?: string;
  currentStageName?: string;
  onSuccess?: () => void;
}

export const MoveToPipelineModal = ({
  open,
  onOpenChange,
  dealId,
  dealName,
  currentOriginId,
  currentStageName,
  onSuccess,
}: MoveToPipelineModalProps) => {
  const [selectedOriginId, setSelectedOriginId] = useState('');
  const [selectedStageId, setSelectedStageId] = useState('');

  const { data: origins } = useCRMOrigins();
  const { data: stages } = useCRMStages(selectedOriginId || undefined);
  const updateDeal = useUpdateCRMDeal();
  const createActivity = useCreateDealActivity();

  // Reset when modal opens/closes
  useEffect(() => {
    if (!open) {
      setSelectedOriginId('');
      setSelectedStageId('');
    }
  }, [open]);

  // Reset stage when origin changes
  useEffect(() => {
    setSelectedStageId('');
  }, [selectedOriginId]);

  // Flatten origins tree for the select
  const flatOrigins = origins?.flatMap(group => {
    if (group.children && group.children.length > 0) {
      return group.children.map((child: any) => ({
        id: child.id,
        name: `${group.name} › ${child.name}`,
      }));
    }
    return [{ id: group.id, name: group.name }];
  })?.filter((o: any) => o.id !== currentOriginId) || [];

  const handleConfirm = async () => {
    if (!selectedOriginId || !selectedStageId) {
      toast.error('Selecione a pipeline e o estágio destino');
      return;
    }

    const targetOriginName = flatOrigins.find((o: any) => o.id === selectedOriginId)?.name || '';
    const targetStageName = stages?.find((s: any) => s.id === selectedStageId)?.stage_name || '';

    try {
      await updateDeal.mutateAsync({
        id: dealId,
        origin_id: selectedOriginId,
        stage_id: selectedStageId,
      });

      await createActivity.mutateAsync({
        deal_id: dealId,
        activity_type: 'pipeline_change',
        description: `Pipeline alterada para ${targetOriginName} → ${targetStageName}`,
        from_stage: currentStageName || '',
        to_stage: targetStageName,
      });

      toast.success('Lead movido para nova pipeline!');
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      // Errors handled by hooks
    }
  };

  const isPending = updateDeal.isPending || createActivity.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mover para outra Pipeline</DialogTitle>
          <DialogDescription>
            Mover <strong>{dealName}</strong> para uma pipeline diferente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Pipeline destino</Label>
            <Select value={selectedOriginId} onValueChange={setSelectedOriginId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a pipeline..." />
              </SelectTrigger>
              <SelectContent>
                {flatOrigins.map((origin: any) => (
                  <SelectItem key={origin.id} value={origin.id}>
                    {origin.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedOriginId && (
            <div className="space-y-2">
              <Label>Estágio destino</Label>
              <Select value={selectedStageId} onValueChange={setSelectedStageId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o estágio..." />
                </SelectTrigger>
                <SelectContent>
                  {stages?.map((stage: any) => (
                    <SelectItem key={stage.id} value={stage.id}>
                      {stage.stage_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!selectedOriginId || !selectedStageId || isPending}>
            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Mover
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
