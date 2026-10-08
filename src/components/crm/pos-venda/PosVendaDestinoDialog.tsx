import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { invalidarKanban } from '@/hooks/useKanbanServidor';

interface Props {
  open: boolean;
  dealId: string | null;
  dealName?: string;
  onOpenChange: (open: boolean) => void;
}

/** Escolha obrigatória do destino ao concluir a viabilidade (BU Pós Venda). */
export function PosVendaDestinoDialog({ open, dealId, dealName, onOpenChange }: Props) {
  const qc = useQueryClient();
  const [destino, setDestino] = useState<'credito' | 'consorcio' | ''>('');
  const [salvando, setSalvando] = useState(false);

  const confirmar = async () => {
    if (!dealId || !destino) return;
    setSalvando(true);
    const { data, error } = await (supabase.rpc as any)('pos_venda_concluir_viabilidade', {
      p_deal_id: dealId, p_destino: destino,
    });
    setSalvando(false);
    if (error) { toast.error(error.message); return; }
    toast.success(
      `Enviado para ${destino === 'credito' ? 'Crédito Imobiliário' : 'Consórcio'}` +
      ((data as any)?.reaproveitado ? ' (cliente já tinha card lá)' : ''),
    );
    invalidarKanban(qc);
    qc.invalidateQueries({ queryKey: ['crm-deals'] });
    setDestino('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!salvando) { setDestino(''); onOpenChange(o); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Concluir viabilidade</DialogTitle>
          <DialogDescription>
            Para onde {dealName ? <strong>{dealName}</strong> : 'este cliente'} deve seguir? Um card novo é criado na BU escolhida.
          </DialogDescription>
        </DialogHeader>
        <RadioGroup value={destino} onValueChange={(v) => setDestino(v as any)} className="space-y-2">
          <div className="flex items-center gap-2"><RadioGroupItem value="credito" id="pv-credito" /><Label htmlFor="pv-credito">Crédito Imobiliário (etapa "Em contato")</Label></div>
          <div className="flex items-center gap-2"><RadioGroupItem value="consorcio" id="pv-consorcio" /><Label htmlFor="pv-consorcio">Consórcio (etapa "Novo Lead")</Label></div>
        </RadioGroup>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>Cancelar</Button>
          <Button onClick={confirmar} disabled={!destino || salvando}>{salvando ? 'Enviando...' : 'Confirmar envio'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
