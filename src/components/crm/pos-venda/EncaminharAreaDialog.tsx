import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { invalidarKanban } from '@/hooks/useKanbanServidor';

interface Props {
  open: boolean;
  dealId: string;
  dealName?: string;
  onOpenChange: (open: boolean) => void;
  onDone?: () => void;
}

/** Encaminhar card de "Novos licenciados" para outra área (grava nota + linha do tempo). */
export function EncaminharAreaDialog({ open, dealId, dealName, onOpenChange, onDone }: Props) {
  const qc = useQueryClient();
  const [nota, setNota] = useState('');
  const [area, setArea] = useState<'credito' | 'consorcio' | ''>('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => { if (open) { setNota(''); setArea(''); } }, [open]);

  const confirmar = async () => {
    if (!area || nota.trim().length < 3) return;
    setSalvando(true);
    const { error } = await (supabase.rpc as any)('pos_venda_encaminhar_bu', { p_deal_id: dealId, p_bu: area, p_nota: nota });
    setSalvando(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Encaminhado para ${area === 'credito' ? 'Crédito Imobiliário' : 'Consórcio'}`);
    invalidarKanban(qc);
    qc.invalidateQueries({ queryKey: ['crm-deals'] });
    onOpenChange(false);
    onDone?.();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!salvando) onOpenChange(o); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Encaminhar para área</DialogTitle>
          <DialogDescription>
            Escolha para onde {dealName ? <strong>{dealName}</strong> : 'o cliente'} segue e registre a nota do atendimento.
          </DialogDescription>
        </DialogHeader>
        <RadioGroup value={area} onValueChange={(v) => setArea(v as any)} className="space-y-2">
          <div className="flex items-center gap-2"><RadioGroupItem value="credito" id="ea-cred" /><Label htmlFor="ea-cred">Crédito Imobiliário (etapa "Em contato")</Label></div>
          <div className="flex items-center gap-2"><RadioGroupItem value="consorcio" id="ea-cons" /><Label htmlFor="ea-cons">Consórcio (etapa "Novo Lead")</Label></div>
        </RadioGroup>
        <div className="space-y-2">
          <Label htmlFor="ea-nota">Nota do atendimento (obrigatória)</Label>
          <Textarea id="ea-nota" rows={4} value={nota} onChange={(e) => setNota(e.target.value)} placeholder="O que foi conversado com o cliente" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>Cancelar</Button>
          <Button onClick={confirmar} disabled={!area || nota.trim().length < 3 || salvando}>{salvando ? 'Enviando...' : 'Encaminhar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
