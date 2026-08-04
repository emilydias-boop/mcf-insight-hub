import { useEffect, useState } from 'react';
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
import { toast } from 'sonner';
import { useExcluirReembolso, type ArReembolsoWithTitulo } from '@/hooks/useArReembolsos';

const MIN_LEN = 15;

const brl = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

interface Props {
  reembolso: ArReembolsoWithTitulo | null;
  onOpenChange: (v: boolean) => void;
}

export function ExcluirReembolsoDialog({ reembolso, onOpenChange }: Props) {
  const excluir = useExcluirReembolso();
  const [motivo, setMotivo] = useState('');
  const trimmed = motivo.trim();
  const canConfirm = trimmed.length >= MIN_LEN && !excluir.isPending;

  useEffect(() => {
    setMotivo('');
  }, [reembolso?.id]);

  const handleConfirm = async () => {
    if (!reembolso || !canConfirm) return;
    try {
      await excluir.mutateAsync({ reembolso, justificativa: trimmed });
      toast.success('Reembolso excluído. Registro de auditoria gravado.');
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao excluir reembolso.');
    }
  };

  return (
    <AlertDialog open={!!reembolso} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir reembolso cancelado?</AlertDialogTitle>
          <AlertDialogDescription>
            {reembolso?.titulo?.customer_name || '—'} — {brl(Number(reembolso?.valor || 0))}. Esta
            ação remove definitivamente o registro do reembolso. O snapshot completo, o autor e a
            justificativa ficam registrados em auditoria e no histórico do título.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2">
          <Label htmlFor="motivo-exclusao-reembolso">Justificativa (obrigatória)</Label>
          <Textarea
            id="motivo-exclusao-reembolso"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Descreva por que este reembolso está sendo excluído…"
            rows={3}
            maxLength={500}
          />
          <p className={`text-xs ${trimmed.length >= MIN_LEN ? 'text-muted-foreground' : 'text-destructive'}`}>
            {trimmed.length}/{MIN_LEN} caracteres mínimos
          </p>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={excluir.isPending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={!canConfirm}
            onClick={(e) => {
              e.preventDefault();
              handleConfirm();
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {excluir.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Excluir reembolso
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
