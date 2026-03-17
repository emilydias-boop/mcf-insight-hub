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

  // Fetch profiles with roles via join
  const { data: sdrs = [] } = useQuery({
    queryKey: ['sdr-profiles-for-duplicate'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('user_id, role, profiles!user_roles_user_id_profiles_fkey(id, full_name, email)')
        .in('role', ['sdr', 'closer', 'admin', 'manager']);
      if (error) throw error;
      return (data || [])
        .filter((r: any) => r.profiles?.full_name)
        .map((r: any) => ({
          id: r.profiles.id as string,
          name: r.profiles.full_name as string,
          email: r.profiles.email as string,
          role: r.role as string,
        }))
        .sort((a: any, b: any) => a.name.localeCompare(b.name));
    },
    enabled: open,
  });

  // Fetch Inside Sales stages
  const { data: stages = [] } = useQuery({
    queryKey: ['inside-sales-stages-for-duplicate'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_stages')
        .select('id, stage_name, stage_order')
        .eq('origin_id', INSIDE_SALES_ORIGIN_ID)
        .order('stage_order');
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
    const sdr = sdrs.find((s: any) => s.id === selectedSdr);
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
                {sdrs.map((sdr: any) => (
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
                    {stage.stage_name}
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
