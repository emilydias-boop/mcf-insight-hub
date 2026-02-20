import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useAssetMutations } from '@/hooks/useAssets';
import { Asset } from '@/types/patrimonio';
import { Loader2 } from 'lucide-react';

interface AssetMaintenanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset: Asset;
}

export const AssetMaintenanceDialog = ({ open, onOpenChange, asset }: AssetMaintenanceDialogProps) => {
  const [observacao, setObservacao] = useState('');
  const { updateAsset } = useAssetMutations();

  const handleConfirm = async () => {
    await updateAsset.mutateAsync({
      id: asset.id,
      status: 'em_manutencao',
      observacoes: asset.observacoes
        ? `${asset.observacoes}\n[Manutenção] ${observacao}`
        : `[Manutenção] ${observacao}`,
    });
    setObservacao('');
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Enviar para Manutenção</AlertDialogTitle>
          <AlertDialogDescription>
            O equipamento <strong>{asset.numero_patrimonio}</strong> será marcado como "Em Manutenção".
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2">
          <Label>Motivo / Observação</Label>
          <Textarea
            value={observacao}
            onChange={e => setObservacao(e.target.value)}
            placeholder="Descreva o problema ou motivo da manutenção"
            rows={3}
          />
        </div>
        <AlertDialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={updateAsset.isPending}>
            {updateAsset.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
