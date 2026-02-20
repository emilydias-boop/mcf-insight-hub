import { useState } from 'react';
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
import { useAssignmentMutations } from '@/hooks/useAssetAssignments';
import { useTermMutations, generateTermContent } from '@/hooks/useAssetTerms';
import { useEmployees } from '@/hooks/useEmployees';
import { Asset, AssetAssignmentWithDetails, CHECKLIST_ITEMS } from '@/types/patrimonio';
import { Loader2 } from 'lucide-react';
import EmployeeSearchCombobox from '@/components/hr/exams/EmployeeSearchCombobox';

interface AssetTransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset: Asset;
  currentAssignment?: AssetAssignmentWithDetails | null;
}

export const AssetTransferDialog = ({ open, onOpenChange, asset, currentAssignment }: AssetTransferDialogProps) => {
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [dataTransferencia, setDataTransferencia] = useState(new Date().toISOString().split('T')[0]);
  const [dataPrevistaDevolucao, setDataPrevistaDevolucao] = useState('');
  const [selectedItems, setSelectedItems] = useState<Record<string, boolean>>({});
  const [outroDescricao, setOutroDescricao] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { transferAsset } = useAssignmentMutations();
  const { createTerm } = useTermMutations();
  const { data: employees = [] } = useEmployees();

  const toggleItem = (id: string) => {
    setSelectedItems(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSubmit = async () => {
    if (!employeeId || !currentAssignment) return;
    setIsSubmitting(true);

    try {
      const items = Object.entries(selectedItems)
        .filter(([, checked]) => checked)
        .map(([id]) => ({
          item_tipo: id,
          descricao: id === 'outro' ? outroDescricao : undefined,
        }));

      const assignment = await transferAsset.mutateAsync({
        currentAssignmentId: currentAssignment.id,
        newInput: {
          asset_id: asset.id,
          employee_id: employeeId,
          data_liberacao: dataTransferencia,
          data_prevista_devolucao: dataPrevistaDevolucao || undefined,
          items,
          observacoes: observacoes || undefined,
        },
      });

      // Generate term for the new assignment
      const employee = employees.find(e => e.id === employeeId);
      if (employee) {
        const conteudo = generateTermContent(
          asset,
          { nome_completo: employee.nome_completo, cargo: employee.cargo, departamento: employee.departamento },
          items,
          dataTransferencia
        );
        await createTerm.mutateAsync({
          assignmentId: assignment.id,
          assetId: asset.id,
          employeeId,
          conteudo,
        });
      }

      onOpenChange(false);
      resetForm();
    } catch {
      // errors handled in hooks
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setEmployeeId(null);
    setDataTransferencia(new Date().toISOString().split('T')[0]);
    setDataPrevistaDevolucao('');
    setSelectedItems({});
    setOutroDescricao('');
    setObservacoes('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Transferir Equipamento</DialogTitle>
          <DialogDescription>
            Transfira <strong>{asset.numero_patrimonio}</strong> de{' '}
            <strong>{currentAssignment?.employee?.nome_completo || 'colaborador atual'}</strong> para outro colaborador.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Novo Colaborador *</Label>
            <EmployeeSearchCombobox value={employeeId} onChange={setEmployeeId} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Data da Transferência *</Label>
              <Input type="date" value={dataTransferencia} onChange={e => setDataTransferencia(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Devolução Prevista</Label>
              <Input type="date" value={dataPrevistaDevolucao} onChange={e => setDataPrevistaDevolucao(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Itens Entregues</Label>
            <div className="grid grid-cols-2 gap-2">
              {CHECKLIST_ITEMS.map(item => (
                <div key={item.id} className="flex items-center gap-2">
                  <Checkbox
                    id={`transfer-item-${item.id}`}
                    checked={!!selectedItems[item.id]}
                    onCheckedChange={() => toggleItem(item.id)}
                  />
                  <label htmlFor={`transfer-item-${item.id}`} className="text-sm cursor-pointer">{item.label}</label>
                </div>
              ))}
            </div>
            {selectedItems['outro'] && (
              <Input
                placeholder="Descreva o item"
                value={outroDescricao}
                onChange={e => setOutroDescricao(e.target.value)}
                className="mt-2"
              />
            )}
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              placeholder="Observações sobre a transferência (opcional)"
              value={observacoes}
              onChange={e => setObservacoes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!employeeId || isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Transferir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
