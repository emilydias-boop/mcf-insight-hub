import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Loader2, FolderOutput } from 'lucide-react';
import { useCRMOrigins, useCRMStages } from '@/hooks/useCRMData';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface BulkMovePipelineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDealIds: string[];
  onSuccess: () => void;
}

export const BulkMovePipelineDialog = ({
  open,
  onOpenChange,
  selectedDealIds,
  onSuccess,
}: BulkMovePipelineDialogProps) => {
  const [selectedOriginId, setSelectedOriginId] = useState('');
  const [selectedStageId, setSelectedStageId] = useState('');
  const [isMoving, setIsMoving] = useState(false);

  const { data: origins } = useCRMOrigins();
  const { data: stages } = useCRMStages(selectedOriginId || undefined);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!open) {
      setSelectedOriginId('');
      setSelectedStageId('');
    }
  }, [open]);

  useEffect(() => {
    setSelectedStageId('');
  }, [selectedOriginId]);

  const flatOrigins = origins?.flatMap(group => {
    if (group.children && group.children.length > 0) {
      return group.children.map((child: any) => ({
        id: child.id,
        name: `${group.name} › ${child.name}`,
      }));
    }
    return [{ id: group.id, name: group.name }];
  }) || [];

  const handleMove = async () => {
    if (!selectedOriginId || !selectedStageId || selectedDealIds.length === 0) return;

    setIsMoving(true);
    try {
      const { error } = await supabase
        .from('crm_deals')
        .update({ origin_id: selectedOriginId, stage_id: selectedStageId })
        .in('id', selectedDealIds);

      if (error) throw error;

      toast.success(`${selectedDealIds.length} lead(s) movido(s) para nova pipeline`);
      queryClient.invalidateQueries({ queryKey: ['crm-deals'] });
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
            <FolderOutput className="h-5 w-5" />
            Mover para outra Pipeline
          </DialogTitle>
          <DialogDescription>
            Mover {selectedDealIds.length} lead(s) para uma pipeline diferente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
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
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isMoving}>
            Cancelar
          </Button>
          <Button onClick={handleMove} disabled={!selectedOriginId || !selectedStageId || isMoving}>
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
