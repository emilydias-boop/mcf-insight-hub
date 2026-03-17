import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { INSIDE_SALES_ORIGIN_ID } from '@/constants/team';

interface DuplicateToInsideDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  onConfirm: (ownerEmail: string, ownerProfileId: string, stageId: string) => void;
  isLoading: boolean;
}

export const DuplicateToInsideDialog = ({
  open,
  onOpenChange,
  selectedCount,
  onConfirm,
  isLoading,
}: DuplicateToInsideDialogProps) => {
  const [selectedSdr, setSelectedSdr] = useState('');
  const [selectedStage, setSelectedStage] = useState('');

  // Fetch SDR profiles
  const { data: sdrs = [] } = useQuery({
    queryKey: ['sdr-profiles-for-duplicate'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, email, role')
        .in('role', ['sdr', 'closer', 'admin', 'manager'])
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  // Fetch Inside Sales stages
  const { data: stages = [] } = useQuery({
    queryKey: ['inside-sales-stages-for-duplicate'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_stages')
        .select('id, name, order_index')
        .eq('origin_id', INSIDE_SALES_ORIGIN_ID)
        .order('order_index');
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  // Auto-select first stage (Novo Lead)
  useEffect(() => {
    if (stages.length > 0 && !selectedStage) {
      setSelectedStage(stages[0].id);
    }
  }, [stages, selectedStage]);

  const handleConfirm = () => {
    const sdr = sdrs.find(s => s.id === selectedSdr);
    if (!sdr || !selectedStage) return;
    onConfirm(sdr.email, sdr.id, selectedStage);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Duplicar para Inside Sales</DialogTitle>
          <DialogDescription>
            {selectedCount} contato{selectedCount > 1 ? 's' : ''} será(ão) duplicado(s) como novos deals na pipeline Inside Sales.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-4">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-foreground">SDR responsável</label>
            <Select value={selectedSdr} onValueChange={setSelectedSdr}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o SDR..." />
              </SelectTrigger>
              <SelectContent>
                {sdrs.map(sdr => (
                  <SelectItem key={sdr.id} value={sdr.id}>
                    {sdr.name} ({sdr.role})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-foreground">Estágio</label>
            <Select value={selectedStage} onValueChange={setSelectedStage}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o estágio..." />
              </SelectTrigger>
              <SelectContent>
                {stages.map(stage => (
                  <SelectItem key={stage.id} value={stage.id}>
                    {stage.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!selectedSdr || !selectedStage || isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Duplicando...
              </>
            ) : (
              `Duplicar ${selectedCount} contato${selectedCount > 1 ? 's' : ''}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
