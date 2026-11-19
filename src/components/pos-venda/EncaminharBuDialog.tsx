import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { BUProvider } from '@/contexts/BUContext';
import { QuickScheduleModal } from '@/components/crm/QuickScheduleModal';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { BusinessUnit } from '@/hooks/useMyBU';
import { format } from 'date-fns';
import { notaEncaminhamentoConsorcio, PLACEHOLDER_JUSTIFICATIVA, type TrechoConsorcio } from '@/lib/posVendaConsorcioNota';

// Encaminhamento do Pós-venda para outra BU: o banco (pos_venda_encaminhar_bu) acha ou cria o cartão
// no funil de destino e registra etiqueta/linha do tempo; o agendamento usa a agenda R1 da própria BU de destino.
export const BUS_ENCAMINHAMENTO = [
  { bu: 'consorcio', label: 'Consórcio', basePath: '/consorcio/crm' },
  { bu: 'solar', label: 'War Room', basePath: '/solar/crm' },
  { bu: 'credito', label: 'Crédito', basePath: '/credito/crm' },
] as const;
type BuDestino = typeof BUS_ENCAMINHAMENTO[number]['bu'];

export function EncaminharBuDialog({ dealId, clienteNome, onClose, onConcluido }: {
  dealId: string; clienteNome?: string | null; onClose: () => void; onConcluido?: () => void;
}) {
  const [destino, setDestino] = useState<{ bu: BuDestino; basePath: string; dealDestinoId: string; notas: string } | null>(null);

  const encaminhar = useMutation({
    mutationFn: async (opcao: typeof BUS_ENCAMINHAMENTO[number]) => {
      const { data, error } = await (supabase.rpc as any)('pos_venda_encaminhar_bu', { p_deal_id: dealId, p_bu: opcao.bu });
      if (error) throw error;
      let notas = 'Cliente licenciado encaminhado pelo gerente de relacionamento (Pós-venda).';
      if (opcao.bu === 'consorcio') {
        const { data: tr, error: e2 } = await (supabase.rpc as any)('pos_venda_trechos_consorcio', { p_deal_id: dealId });
        if (e2) console.warn('[trechos-consorcio]', e2);
        notas = notaEncaminhamentoConsorcio((tr ?? []) as TrechoConsorcio[], (iso) => format(new Date(iso), 'dd/MM/yyyy'));
      }
      return { bu: opcao.bu, basePath: opcao.basePath, dealDestinoId: data as string, notas };
    },
    onSuccess: (d) => { setDestino(d); onConcluido?.(); },
    onError: (e: any) => toast.error(e.message ?? 'Não foi possível encaminhar o cliente'),
  });

  if (destino) {
    return (
      <BUProvider bu={destino.bu as BusinessUnit} basePath={destino.basePath}>
        <QuickScheduleModal
          open
          onOpenChange={(o) => { if (!o) { onConcluido?.(); onClose(); } }}
          prefilledDealId={destino.dealDestinoId}
          exclusiveSlots
          prefilledNotes={destino.notas}
          notesPlaceholder={destino.bu === 'consorcio' ? PLACEHOLDER_JUSTIFICATIVA : undefined}
        />
      </BUProvider>
    );
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Agendar em outra BU</DialogTitle>
          <DialogDescription>
            Escolha a BU{clienteNome ? <> para <strong>{clienteNome}</strong></> : null}. O cliente continua no Pós-venda e recebe a etiqueta do encaminhamento.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          {BUS_ENCAMINHAMENTO.map((o) => (
            <Button key={o.bu} variant="outline" disabled={encaminhar.isPending} onClick={() => encaminhar.mutate(o)}>
              {encaminhar.isPending && encaminhar.variables?.bu === o.bu && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {o.label}
            </Button>
          ))}
        </div>
        <DialogFooter><Button variant="ghost" onClick={onClose}>Cancelar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
