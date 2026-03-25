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
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';

interface DeleteDealsConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  count: number;
  onConfirm: () => void;
  isDeleting: boolean;
}

export const DeleteDealsConfirmDialog = ({
  open,
  onOpenChange,
  count,
  onConfirm,
  isDeleting,
}: DeleteDealsConfirmDialogProps) => {
  const [confirmText, setConfirmText] = useState('');
  const requireTyping = count > 5;
  const canConfirm = requireTyping ? confirmText === 'EXCLUIR' : true;

  const handleOpenChange = (value: boolean) => {
    if (!value) setConfirmText('');
    onOpenChange(value);
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Excluir {count} lead{count > 1 ? 's' : ''}
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <span className="block">
              Tem certeza que deseja excluir <strong>{count} lead{count > 1 ? 's' : ''}</strong>? 
              Esta ação não pode ser desfeita. Todos os dados associados (atividades, tarefas, reuniões, ligações) também serão removidos.
            </span>
            {requireTyping && (
              <span className="block">
                Digite <strong>EXCLUIR</strong> para confirmar:
              </span>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {requireTyping && (
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="Digite EXCLUIR"
            className="mt-2"
          />
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={!canConfirm || isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Excluir {count} lead{count > 1 ? 's' : ''}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
