import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { BU_OPTIONS, type BusinessUnit } from '@/hooks/useMyBU';
import { useBUPipelineMap } from '@/hooks/useBUPipelineMap';
import { useCRMStages } from '@/hooks/useCRMData';
import { useBulkCreateDeals } from '@/hooks/useBulkCreateDeals';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface SendToPipelineModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedContactIds: string[];
  onSuccess: () => void;
}

export const SendToPipelineModal = ({ open, onOpenChange, selectedContactIds, onSuccess }: SendToPipelineModalProps) => {
  const [selectedBU, setSelectedBU] = useState<BusinessUnit | ''>('');
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [selectedOriginId, setSelectedOriginId] = useState('');
  const [selectedStageId, setSelectedStageId] = useState('');

  const bulkMutation = useBulkCreateDeals();

  const { data: buMapping } = useBUPipelineMap(selectedBU || null);

  // Fetch groups (funis) for selected BU
  const { data: groups } = useQuery({
    queryKey: ['groups-for-bu', selectedBU, buMapping?.groups],
    queryFn: async () => {
      if (!buMapping?.groups?.length) return [];
      const { data } = await supabase
        .from('crm_groups')
        .select('id, name')
        .in('id', buMapping.groups)
        .order('name');
      return data || [];
    },
    enabled: !!selectedBU && !!buMapping && (buMapping.groups?.length ?? 0) > 0,
  });

  // Fetch origins (pipelines) for selected group
  const { data: origins } = useQuery({
    queryKey: ['origins-for-group', selectedGroupId],
    queryFn: async () => {
      if (!selectedGroupId) return [];
      const { data } = await supabase
        .from('crm_origins')
        .select('id, name, display_name')
        .eq('group_id', selectedGroupId)
        .order('name');
      return data || [];
    },
    enabled: !!selectedGroupId,
  });

  // Fetch direct origins when BU has no groups mapped
  const hasGroups = (buMapping?.groups?.length ?? 0) > 0;
  const { data: directOrigins } = useQuery({
    queryKey: ['direct-origins-for-bu', selectedBU, buMapping?.origins],
    queryFn: async () => {
      if (!buMapping?.origins?.length) return [];
      const { data } = await supabase
        .from('crm_origins')
        .select('id, name, display_name')
        .in('id', buMapping.origins)
        .order('name');
      return data || [];
    },
    enabled: !!selectedBU && !!buMapping && !hasGroups && (buMapping?.origins?.length ?? 0) > 0,
  });

  const availableOrigins = hasGroups ? origins : directOrigins;
  const showOrigins = hasGroups ? !!selectedGroupId && !!origins && origins.length > 0 : !!selectedBU && !!directOrigins && directOrigins.length > 0;

  // Fetch stages for selected origin
  const { data: stages } = useCRMStages(selectedOriginId || undefined);

  const buOptions = useMemo(() => BU_OPTIONS.filter(b => b.value !== ''), []);

  const handleBUChange = (v: string) => {
    setSelectedBU(v as BusinessUnit);
    setSelectedGroupId('');
    setSelectedOriginId('');
    setSelectedStageId('');
  };

  const handleGroupChange = (v: string) => {
    setSelectedGroupId(v);
    setSelectedOriginId('');
    setSelectedStageId('');
  };

  const handleOriginChange = (v: string) => {
    setSelectedOriginId(v);
    setSelectedStageId('');
  };

  const handleConfirm = () => {
    if (!selectedOriginId || !selectedStageId) return;
    bulkMutation.mutate(
      { contactIds: selectedContactIds, originId: selectedOriginId, stageId: selectedStageId },
      {
        onSuccess: () => {
          onSuccess();
          onOpenChange(false);
          setSelectedBU('');
          setSelectedGroupId('');
          setSelectedOriginId('');
          setSelectedStageId('');
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Enviar para Pipeline</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">
            {selectedContactIds.length} contato(s) selecionado(s). Os deals serão criados <strong>sem dono</strong>, visíveis para todos.
          </p>

          {/* BU */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Business Unit</label>
            <Select value={selectedBU} onValueChange={handleBUChange}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a BU" />
              </SelectTrigger>
              <SelectContent>
                {buOptions.map(b => (
                  <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Funil (Group) */}
          {selectedBU && groups && groups.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Funil</label>
              <Select value={selectedGroupId} onValueChange={handleGroupChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o funil" />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((g: any) => (
                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Pipeline (Origin) */}
          {showOrigins && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Pipeline</label>
              <Select value={selectedOriginId} onValueChange={handleOriginChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a pipeline" />
                </SelectTrigger>
                <SelectContent>
                  {availableOrigins?.map((o: any) => (
                    <SelectItem key={o.id} value={o.id}>{o.display_name || o.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Etapa (Stage) */}
          {selectedOriginId && stages && stages.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Etapa</label>
              <Select value={selectedStageId} onValueChange={setSelectedStageId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a etapa" />
                </SelectTrigger>
                <SelectContent>
                  {stages.map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>{s.stage_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedOriginId || !selectedStageId || bulkMutation.isPending}
          >
            {bulkMutation.isPending ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Criando...</>
            ) : (
              `Criar ${selectedContactIds.length} deal(s)`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
