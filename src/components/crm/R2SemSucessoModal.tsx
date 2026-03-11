import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useMarkR2SemSucesso } from '@/hooks/useR2SemSucesso';

interface R2SemSucessoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  attendeeId: string;
  leadName: string;
}

export function R2SemSucessoModal({ open, onOpenChange, attendeeId, leadName }: R2SemSucessoModalProps) {
  const [tentativas, setTentativas] = useState<number>(1);
  const [observacao, setObservacao] = useState('');
  const markSemSucesso = useMarkR2SemSucesso();

  const handleSubmit = () => {
    markSemSucesso.mutate(
      { attendeeId, tentativas, observacao },
      {
        onSuccess: () => {
          onOpenChange(false);
          setTentativas(1);
          setObservacao('');
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Marcar como Sem Sucesso</DialogTitle>
          <DialogDescription>{leadName}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Tentativas de contato</Label>
            <Input
              type="number"
              min={0}
              value={tentativas}
              onChange={(e) => setTentativas(Number(e.target.value))}
            />
          </div>
          <div>
            <Label>Observação</Label>
            <Textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Descreva o motivo ou observações..."
              rows={4}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button variant="destructive" onClick={handleSubmit} disabled={markSemSucesso.isPending}>
            {markSemSucesso.isPending ? 'Salvando...' : 'Confirmar Sem Sucesso'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
