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

interface AssetWriteOffDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset: Asset;
}

export const AssetWriteOffDialog = ({ open, onOpenChange, asset }: AssetWriteOffDialogProps) => {
  const [motivo, setMotivo] = useState('');
  const { updateAsset } = useAssetMutations();

  const handleConfirm = async () => {
    if (!motivo.trim()) return;
    await updateAsset.mutateAsync({
      id: asset.id,
      status: 'baixado',
      observacoes: asset.observacoes
        ? `${asset.observacoes}\n[Baixa] ${motivo}`
        : `[Baixa] ${motivo}`,
    });
    setMotivo('');
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Dar Baixa no Equipamento</AlertDialogTitle>
          <AlertDialogDescription>
            Esta ação é irreversível. O equipamento <strong>{asset.numero_patrimonio}</strong> será permanentemente baixado.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2">
          <Label>Motivo da Baixa *</Label>
          <Textarea
            value={motivo}
            onChange={e => setMotivo(e.target.value)}
            placeholder="Motivo obrigatório para dar baixa"
            rows={3}
          />
        </div>
        <AlertDialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={!motivo.trim() || updateAsset.isPending}>
            {updateAsset.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar Baixa
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
