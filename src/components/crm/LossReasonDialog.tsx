import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useLossReasons } from '@/hooks/useLossReasons';

interface LossReasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dealCount: number;
  dealName?: string;
  onConfirm: (motivo: string, justificativa: string | null) => Promise<void>;
}

export const LossReasonDialog = ({ open, onOpenChange, dealCount, dealName, onConfirm }: LossReasonDialogProps) => {
  const { active } = useLossReasons();
  const [motivo, setMotivo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const requiresNote = !!active.find((r) => r.label === motivo)?.requires_note;
  const canConfirm = !!motivo && (!requiresNote || descricao.trim().length > 0) && !submitting;

  const reset = () => {
    setMotivo('');
    setDescricao('');
  };

  const handleOpenChange = (o: boolean) => {
    if (submitting) return;
    if (!o) reset();
    onOpenChange(o);
  };

  const handleConfirm = async () => {
    if (!canConfirm) return;
    setSubmitting(true);
    try {
      await onConfirm(motivo, descricao.trim() ? descricao.trim() : null);
      reset();
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao registrar motivo');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Motivo do Sem Interesse</DialogTitle>
          <DialogDescription>
            {dealCount === 1
              ? `Por que ${dealName ?? 'este negócio'} não tem interesse?`
              : `O motivo abaixo será aplicado aos ${dealCount} negócios selecionados.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Motivo *</Label>
            <Select value={motivo} onValueChange={setMotivo}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o motivo..." />
              </SelectTrigger>
              <SelectContent>
                {active.map((r) => (
                  <SelectItem key={r.id} value={r.label}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Descrição {requiresNote ? '*' : '(opcional)'}</Label>
            <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!canConfirm}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
