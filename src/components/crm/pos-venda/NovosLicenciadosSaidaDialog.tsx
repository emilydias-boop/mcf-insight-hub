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
  dealId: string | null;
  dealName?: string;
  targetStageName?: string;
  onOpenChange: (open: boolean) => void;
  /** Chamado após registrar a nota, quando o destino é a etapa arrastada. */
  onNotaRegistrada: () => void;
}

/** Saída da etapa "Novos licenciados": nota obrigatória + destino. */
export function NovosLicenciadosSaidaDialog({ open, dealId, dealName, targetStageName, onOpenChange, onNotaRegistrada }: Props) {
  const qc = useQueryClient();
  const [nota, setNota] = useState('');
  const [destino, setDestino] = useState<'etapa' | 'consorcio' | 'credito'>('etapa');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => { if (open) { setNota(''); setDestino('etapa'); } }, [open]);

  const confirmar = async () => {
    if (!dealId || nota.trim().length < 3) return;
    setSalvando(true);
    try {
      if (destino === 'etapa') {
        const { error } = await (supabase.rpc as any)('pos_venda_registrar_nota', { p_deal_id: dealId, p_nota: nota });
        if (error) throw error;
        onNotaRegistrada();
      } else {
        const { error } = await (supabase.rpc as any)('pos_venda_encaminhar_bu', { p_deal_id: dealId, p_bu: destino, p_nota: nota });
        if (error) throw error;
        toast.success(`Encaminhado para ${destino === 'credito' ? 'Crédito Imobiliário' : 'Consórcio'}`);
        invalidarKanban(qc);
        qc.invalidateQueries({ queryKey: ['crm-deals'] });
      }
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao salvar');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!salvando) onOpenChange(o); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Saída de Novos licenciados</DialogTitle>
          <DialogDescription>
            Registre como foi o contato com {dealName ? <strong>{dealName}</strong> : 'o cliente'} e escolha o destino.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="nl-nota">Nota do contato (obrigatória)</Label>
          <Textarea id="nl-nota" rows={4} value={nota} onChange={(e) => setNota(e.target.value)} placeholder="O que foi conversado com o cliente" />
        </div>
        <RadioGroup value={destino} onValueChange={(v) => setDestino(v as any)} className="space-y-2">
          <div className="flex items-center gap-2"><RadioGroupItem value="etapa" id="nl-etapa" /><Label htmlFor="nl-etapa">Seguir no Pós Venda{targetStageName ? ` (${targetStageName})` : ''}</Label></div>
          <div className="flex items-center gap-2"><RadioGroupItem value="consorcio" id="nl-cons" /><Label htmlFor="nl-cons">Encaminhar para BU Consórcio</Label></div>
          <div className="flex items-center gap-2"><RadioGroupItem value="credito" id="nl-cred" /><Label htmlFor="nl-cred">Encaminhar para BU Crédito Imobiliário</Label></div>
        </RadioGroup>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>Cancelar</Button>
          <Button onClick={confirmar} disabled={nota.trim().length < 3 || salvando}>{salvando ? 'Salvando...' : 'Confirmar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
