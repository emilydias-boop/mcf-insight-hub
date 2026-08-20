import { useEffect, useState } from 'react';
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
import { Loader2 } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  destinatarios: number;
  sending: boolean;
  onConfirm: () => void;
}

/** Acima de 50 alvos, o operador digita o número para liberar o botão. */
export function ConfirmarEnvioDialog({
  open,
  onOpenChange,
  destinatarios,
  sending,
  onConfirm,
}: Props) {
  const exigeDigitacao = destinatarios > 50;
  const [valor, setValor] = useState('');

  useEffect(() => {
    if (open) setValor('');
  }, [open]);

  const liberado = !exigeDigitacao || valor.trim() === String(destinatarios);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirmar disparo</DialogTitle>
          <DialogDescription>
            {destinatarios} pessoa(s) vão receber esta mensagem no WhatsApp. Disparo é irreversível —
            não existe desfazer.
          </DialogDescription>
        </DialogHeader>

        {exigeDigitacao && (
          <div className="space-y-2">
            <Label htmlFor="confirma-numero">Digite {destinatarios} para liberar o envio</Label>
            <Input
              id="confirma-numero"
              inputMode="numeric"
              value={valor}
              onChange={(e) => setValor(e.target.value.replace(/\D/g, ''))}
              placeholder={String(destinatarios)}
            />
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Voltar
          </Button>
          <Button onClick={onConfirm} disabled={!liberado || sending}>
            {sending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Disparar agora
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}