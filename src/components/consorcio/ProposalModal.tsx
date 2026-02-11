import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useEnviarProposta } from '@/hooks/useConsorcioPostMeeting';

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
  const [valorCredito, setValorCredito] = useState('');
  const [prazoMeses, setPrazoMeses] = useState('');
  const [tipoProduto, setTipoProduto] = useState('');
  const enviarProposta = useEnviarProposta();

  const handleSubmit = () => {
    if (!valorCredito || !prazoMeses || !tipoProduto) return;
    enviarProposta.mutate({
      deal_id: dealId,
      origin_id: originId,
      proposal_details: details,
      valor_credito: Number(valorCredito),
      prazo_meses: Number(prazoMeses),
      tipo_produto: tipoProduto,
    }, {
      onSuccess: () => {
        onOpenChange(false);
        setDetails(''); setValorCredito(''); setPrazoMeses(''); setTipoProduto('');
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Enviar Proposta</DialogTitle>
          <DialogDescription>
            {contactName} — {dealName}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Valor do Crédito (R$)</Label>
            <Input type="number" value={valorCredito} onChange={e => setValorCredito(e.target.value)} placeholder="Ex: 150000" />
          </div>
          <div>
            <Label>Prazo (meses)</Label>
            <Input type="number" value={prazoMeses} onChange={e => setPrazoMeses(e.target.value)} placeholder="Ex: 200" />
          </div>
          <div>
            <Label>Tipo de Produto</Label>
            <Select value={tipoProduto} onValueChange={setTipoProduto}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="select">Select</SelectItem>
                <SelectItem value="parcelinha">Parcelinha</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Detalhes da Proposta</Label>
            <Textarea value={details} onChange={e => setDetails(e.target.value)} placeholder="Descrição da proposta..." rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={enviarProposta.isPending || !valorCredito || !prazoMeses || !tipoProduto}>
            {enviarProposta.isPending ? 'Enviando...' : 'Registrar Proposta'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
