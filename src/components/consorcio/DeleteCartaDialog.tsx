import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

interface DeleteCartaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (motivo: string) => void | Promise<void>;
  isDeleting?: boolean;
}

const MIN_LEN = 15;

export function DeleteCartaDialog({ open, onOpenChange, onConfirm, isDeleting }: DeleteCartaDialogProps) {
  const [motivo, setMotivo] = useState('');
  const trimmed = motivo.trim();
  const canConfirm = trimmed.length >= MIN_LEN && !isDeleting;

  const handleOpenChange = (v: boolean) => {
    if (!v) setMotivo('');
    onOpenChange(v);
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent onClick={(e) => e.stopPropagation()}>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir carta?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta ação não pode ser desfeita. A carta e suas parcelas serão excluídas permanentemente e o
            vínculo com a proposta negociada será desfeito — a proposta ficará sinalizada como
            "carta excluída" com a justificativa abaixo.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2">
          <Label htmlFor="motivo-exclusao">Justificativa (obrigatória)</Label>
          <Textarea
            id="motivo-exclusao"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Descreva o motivo da exclusão desta carta..."
            rows={3}
            maxLength={500}
          />
          <p className={`text-xs ${trimmed.length >= MIN_LEN ? 'text-muted-foreground' : 'text-destructive'}`}>
            {trimmed.length}/{MIN_LEN} caracteres mínimos
          </p>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={!canConfirm}
            onClick={(e) => {
              e.preventDefault();
              if (!canConfirm) return;
              onConfirm(trimmed);
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Excluir carta
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
