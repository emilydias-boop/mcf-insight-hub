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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAssignmentMutations, useAssetAssignments } from '@/hooks/useAssetAssignments';
import { Asset, AssetAssignmentWithDetails } from '@/types/patrimonio';
import { Loader2 } from 'lucide-react';

interface AssetReturnDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset: Asset;
  assignment?: AssetAssignmentWithDetails | null;
}

export const AssetReturnDialog = ({ open, onOpenChange, asset, assignment }: AssetReturnDialogProps) => {
  const [novoStatus, setNovoStatus] = useState<'em_estoque' | 'em_manutencao'>('em_estoque');
  const [itemChecks, setItemChecks] = useState<Record<string, { conferido: boolean; observacao: string }>>({});
  const [observacoes, setObservacoes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { returnAsset } = useAssignmentMutations();
  const { data: assignments } = useAssetAssignments(asset.id);

  const activeAssignment = assignment || assignments?.find(a => a.status === 'ativo');

  useEffect(() => {
    if (activeAssignment?.items) {
      const checks: Record<string, { conferido: boolean; observacao: string }> = {};
      activeAssignment.items.forEach(item => {
        checks[item.id] = { conferido: false, observacao: '' };
      });
      setItemChecks(checks);
    }
  }, [activeAssignment]);

  const handleSubmit = async () => {
    if (!activeAssignment) return;
    setIsSubmitting(true);

    try {
      await returnAsset.mutateAsync({
        assignment_id: activeAssignment.id,
        items_conferidos: Object.entries(itemChecks).map(([item_id, data]) => ({
          item_id,
          conferido: data.conferido,
          observacao: data.observacao || undefined,
        })),
        novo_status: novoStatus,
        observacoes: observacoes || undefined,
      });
      onOpenChange(false);
    } catch {
      // handled in hook
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Devolver Equipamento</DialogTitle>
          <DialogDescription>
            Confira os itens e registre a devolução de <strong>{asset.numero_patrimonio}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {activeAssignment?.items && activeAssignment.items.length > 0 ? (
            <div className="space-y-3">
              <Label>Conferência de Itens</Label>
              {activeAssignment.items.map(item => (
                <div key={item.id} className="p-3 rounded-lg border space-y-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={itemChecks[item.id]?.conferido || false}
                      onCheckedChange={(checked) =>
                        setItemChecks(prev => ({
                          ...prev,
                          [item.id]: { ...prev[item.id], conferido: !!checked },
                        }))
                      }
                    />
                    <span className="text-sm font-medium capitalize">{item.item_tipo}</span>
                    {item.descricao && <span className="text-xs text-muted-foreground">({item.descricao})</span>}
                  </div>
                  <Input
                    placeholder="Observação (opcional)"
                    value={itemChecks[item.id]?.observacao || ''}
                    onChange={e =>
                      setItemChecks(prev => ({
                        ...prev,
                        [item.id]: { ...prev[item.id], observacao: e.target.value },
                      }))
                    }
                    className="text-sm"
                  />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum item registrado nesta liberação.</p>
          )}

          <div className="space-y-2">
            <Label>Observações da Devolução</Label>
            <Textarea
              placeholder="Observações gerais sobre a devolução (opcional)"
              value={observacoes}
              onChange={e => setObservacoes(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Novo Status do Equipamento</Label>
            <Select value={novoStatus} onValueChange={v => setNovoStatus(v as 'em_estoque' | 'em_manutencao')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="em_estoque">Em Estoque</SelectItem>
                <SelectItem value="em_manutencao">Em Manutenção</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar Devolução
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
