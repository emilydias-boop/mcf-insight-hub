import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useEnviarProposta } from '@/hooks/useConsorcioPostMeeting';
import { useConsorcioTipoOptions, useConsorcioOrigemOptions } from '@/hooks/useConsorcioConfigOptions';
import { CartasProposalEditor } from './CartasProposalEditor';
import {
  PropostaCartaDraft, cartaDraftValida, draftsParaInput, novaCartaDraft,
} from '@/types/consorcioCartas';

interface ProposalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dealId: string;
  dealName: string;
  contactName: string;
  originId: string;
}

export function ProposalModal({ open, onOpenChange, dealId, dealName, contactName, originId }: ProposalModalProps) {
  const [details, setDetails] = useState('');
  const [origemLead, setOrigemLead] = useState('');
  const [cartas, setCartas] = useState<PropostaCartaDraft[]>([novaCartaDraft()]);
  const [mostrarErros, setMostrarErros] = useState(false);
  const enviarProposta = useEnviarProposta();
  const { data: tipoOptions = [] } = useConsorcioTipoOptions();
  const { data: origemOptions = [] } = useConsorcioOrigemOptions();

  const origemList = origemLead && !origemOptions.some(o => o.name === origemLead)
    ? [...origemOptions.map(o => ({ name: o.name, label: o.label })), { name: origemLead, label: `${origemLead} (legado)` }]
    : origemOptions.map(o => ({ name: o.name, label: o.label }));

  const tudoValido = cartas.length > 0 && cartas.every(cartaDraftValida);

  const handleSubmit = () => {
    if (!tudoValido) { setMostrarErros(true); return; }
    enviarProposta.mutate({
      deal_id: dealId,
      origin_id: originId,
      proposal_details: details,
      cartas: draftsParaInput(cartas),
      origem_lead: origemLead || undefined,
    }, {
      onSuccess: () => {
        onOpenChange(false);
        setDetails(''); setOrigemLead(''); setCartas([novaCartaDraft()]); setMostrarErros(false);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Enviar Proposta</DialogTitle>
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
            <Textarea value={details} onChange={e => setDetails(e.target.value)} placeholder="Descrição da proposta..." rows={3} />
          </div>
          <div>
            <Label>Origem do Lead</Label>
            <Select value={origemLead} onValueChange={setOrigemLead}>
              <SelectTrigger><SelectValue placeholder="Selecione a origem" /></SelectTrigger>
              <SelectContent>
                {origemList.map(o => (
                  <SelectItem key={o.name} value={o.name}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={enviarProposta.isPending}>
            {enviarProposta.isPending ? 'Enviando...' : 'Registrar Proposta'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
