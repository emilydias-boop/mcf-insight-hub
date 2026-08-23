import { useEffect, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PRAZO_OPTIONS } from '@/types/consorcioProdutos';
import { useEditarProposta } from '@/hooks/useConsorcioPostMeeting';
import { useConsorcioTipoOptions } from '@/hooks/useConsorcioConfigOptions';
import { numberToBRLInput } from '@/lib/brlMask';
import { CartasProposalEditor } from './CartasProposalEditor';
import {
  PropostaCarta, PropostaCartaDraft, cartaDraftValida, draftsParaInput, novaCartaDraft,
  normalizarParcelasMcf,
} from '@/types/consorcioCartas';


interface EditProposalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proposalId: string;
  contactName: string;
  dealName: string;
  /** Cartas atuais da proposta. Propostas legadas têm a carta espelho do backfill. */
  initialCartas?: PropostaCarta[];
  /** Fallback quando a proposta ainda não tem cartas. */
  initialValorCredito: number;
  initialPrazoMeses: number;
  initialTipoProduto: string;
  initialDetails: string;
  initialOrigemLead?: string;
}

function cartasParaDrafts(
  cartas: PropostaCarta[] | undefined,
  fallback: { valor: number; prazo: number; tipo: string },
): PropostaCartaDraft[] {
  const base = (cartas && cartas.length > 0)
    ? cartas
    : [{
        id: undefined as any, proposal_id: '', ordem: 1,
        valor_credito: fallback.valor, prazo_meses: fallback.prazo, tipo_produto: fallback.tipo,
        parcelas_mcf: null, categoria: null,
        pending_registration_id: null, consortium_card_id: null,
      } as PropostaCarta];

  return base.map((c, i) => ({
    key: c.id || `fallback-${i}`,
    id: c.id || undefined,
    valorStr: c.valor_credito ? numberToBRLInput(c.valor_credito) : '',
    prazoMeses: c.prazo_meses ? String(c.prazo_meses) : '',
    prazoOutro: !!c.prazo_meses && !PRAZO_OPTIONS.some(o => o.value === Number(c.prazo_meses)),
    tipoProduto: c.tipo_produto || '',
    parcelasMcf: normalizarParcelasMcf(c.parcelas_mcf),
    parcela1a12Str: c.parcela_1a_12a ? numberToBRLInput(Number(c.parcela_1a_12a)) : '',
    parcelaDemaisStr: c.parcela_demais ? numberToBRLInput(Number(c.parcela_demais)) : '',
    condicaoPagamento: c.condicao_pagamento || '',
    objetivo: c.objetivo || '',
    categoria: c.categoria || '',
    travada: !!(c.pending_registration_id || c.consortium_card_id),
  }));
}

export function EditProposalModal({
  open, onOpenChange, proposalId, contactName, dealName,
  initialCartas, initialValorCredito, initialPrazoMeses, initialTipoProduto,
  initialDetails, initialOrigemLead,
}: EditProposalModalProps) {
  const [cartas, setCartas] = useState<PropostaCartaDraft[]>([novaCartaDraft()]);
  const [details, setDetails] = useState('');
  const [origemLead, setOrigemLead] = useState('');
  const [mostrarErros, setMostrarErros] = useState(false);
  const editar = useEditarProposta();
  const { data: tipoOptions = [] } = useConsorcioTipoOptions();

  useEffect(() => {
    if (open) {
      setCartas(cartasParaDrafts(initialCartas, {
        valor: initialValorCredito, prazo: initialPrazoMeses, tipo: initialTipoProduto,
      }));
      setDetails(initialDetails || '');
      setOrigemLead(initialOrigemLead || '');
      setMostrarErros(false);
    }
  }, [open, initialCartas, initialValorCredito, initialPrazoMeses, initialTipoProduto, initialDetails, initialOrigemLead]);

  const tudoValido = cartas.length > 0 && cartas.every(cartaDraftValida);

  const handleSubmit = () => {
    if (!tudoValido) { setMostrarErros(true); return; }
    editar.mutate({
      proposal_id: proposalId,
      cartas: draftsParaInput(cartas),
      proposal_details: details,
      origem_lead: origemLead.trim() || undefined,
    }, {
      onSuccess: () => onOpenChange(false),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Proposta</DialogTitle>
          <DialogDescription>
            {contactName} — {dealName}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <CartasProposalEditor
            cartas={cartas}
            onChange={setCartas}
            tipoOptions={tipoOptions.map(o => ({ name: o.name, label: o.label }))}
            mostrarErros={mostrarErros}
          />
          <div>
            <Label>Detalhes da Proposta</Label>
            <Textarea value={details} onChange={e => setDetails(e.target.value)} rows={3} />
          </div>
          <div>
            <Label>Origem do Lead</Label>
            <Input
              type="text"
              value={origemLead}
              onChange={e => setOrigemLead(e.target.value)}
              placeholder="Ex: Indicação, Instagram, Parceiro João..."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={editar.isPending}>
            {editar.isPending ? 'Salvando...' : 'Salvar alterações'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
