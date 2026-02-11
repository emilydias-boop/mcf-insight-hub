import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useMarcarSemSucesso } from '@/hooks/useConsorcioPostMeeting';

interface SemSucessoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dealId: string;
  dealName: string;
  contactName: string;
  originId: string;
  proposalId?: string;
}

export function SemSucessoModal({ open, onOpenChange, dealId, dealName, contactName, originId, proposalId }: SemSucessoModalProps) {
  const [motivo, setMotivo] = useState('');
  const marcar = useMarcarSemSucesso();

  const handleSubmit = () => {
    if (!motivo.trim()) return;
    marcar.mutate({
      deal_id: dealId,
      origin_id: originId,
      motivo,
      proposal_id: proposalId,
    }, {
      onSuccess: () => {
        onOpenChange(false);
        setMotivo('');
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Marcar como Sem Sucesso</DialogTitle>
          <DialogDescription>
            {contactName} — {dealName}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Motivo da recusa / sem sucesso</Label>
            <Textarea value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Descreva o motivo..." rows={4} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button variant="destructive" onClick={handleSubmit} disabled={marcar.isPending || !motivo.trim()}>
            {marcar.isPending ? 'Salvando...' : 'Confirmar Sem Sucesso'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
