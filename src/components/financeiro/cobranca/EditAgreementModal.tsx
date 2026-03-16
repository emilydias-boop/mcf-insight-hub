import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BillingAgreement, AGREEMENT_STATUS_LABELS } from '@/types/billing';
import { useUpdateAgreement } from '@/hooks/useBillingAgreements';
import { toast } from 'sonner';

interface EditAgreementModalProps {
  agreement: BillingAgreement | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const EditAgreementModal = ({ agreement, open, onOpenChange }: EditAgreementModalProps) => {
  const [form, setForm] = useState({ status: '', responsavel: '', observacoes: '' });
  const updateAgreement = useUpdateAgreement();

  useEffect(() => {
    if (agreement) {
      setForm({
        status: agreement.status,
        responsavel: agreement.responsavel,
        observacoes: agreement.observacoes || '',
      });
    }
  }, [agreement]);

  const handleSubmit = async () => {
    if (!agreement) return;
    try {
      await updateAgreement.mutateAsync({
        id: agreement.id,
        status: form.status as any,
        responsavel: form.responsavel,
        observacoes: form.observacoes || null,
      });
      toast.success('Acordo atualizado');
      onOpenChange(false);
    } catch {
      toast.error('Erro ao atualizar acordo');
    }
  };

  if (!agreement) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Acordo</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(val) => setForm({ ...form, status: val })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(AGREEMENT_STATUS_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Responsável</Label>
            <Input value={form.responsavel} onChange={(e) => setForm({ ...form, responsavel: e.target.value })} />
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
          </div>
          <Button onClick={handleSubmit} disabled={updateAgreement.isPending} className="w-full">
            {updateAgreement.isPending ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
