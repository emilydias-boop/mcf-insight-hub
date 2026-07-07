import { useEffect, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useEditarProposta } from '@/hooks/useConsorcioPostMeeting';

interface EditProposalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proposalId: string;
  contactName: string;
  dealName: string;
  initialValorCredito: number;
  initialPrazoMeses: number;
  initialTipoProduto: string;
  initialDetails: string;
}

const formatBRL = (raw: string) => {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  const cents = Number(digits) / 100;
  return cents.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const numberToBRL = (n: number) =>
  n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const parseBRL = (formatted: string): number => {
  const digits = formatted.replace(/\D/g, '');
  if (!digits) return 0;
  return Number(digits) / 100;
};

export function EditProposalModal({
  open, onOpenChange, proposalId, contactName, dealName,
  initialValorCredito, initialPrazoMeses, initialTipoProduto, initialDetails,
}: EditProposalModalProps) {
  const [valorCredito, setValorCredito] = useState('');
  const [prazoMeses, setPrazoMeses] = useState('');
  const [tipoProduto, setTipoProduto] = useState('');
  const [details, setDetails] = useState('');
  const editar = useEditarProposta();

  useEffect(() => {
    if (open) {
      setValorCredito(initialValorCredito ? numberToBRL(initialValorCredito) : '');
      setPrazoMeses(initialPrazoMeses ? String(initialPrazoMeses) : '');
      setTipoProduto(initialTipoProduto || '');
      setDetails(initialDetails || '');
    }
  }, [open, initialValorCredito, initialPrazoMeses, initialTipoProduto, initialDetails]);

  const valorNumerico = parseBRL(valorCredito);

  const handleSubmit = () => {
    if (!valorNumerico || !prazoMeses || !tipoProduto) return;
    editar.mutate({
      proposal_id: proposalId,
      valor_credito: valorNumerico,
      prazo_meses: Number(prazoMeses),
      tipo_produto: tipoProduto,
      proposal_details: details,
    }, {
      onSuccess: () => onOpenChange(false),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Proposta</DialogTitle>
          <DialogDescription>
            {contactName} — {dealName}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Valor do Crédito (R$)</Label>
            <Input
              type="text"
              inputMode="numeric"
              value={valorCredito}
              onChange={e => setValorCredito(formatBRL(e.target.value))}
              placeholder="Ex: 150.000,00"
            />
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
            <Textarea value={details} onChange={e => setDetails(e.target.value)} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={editar.isPending || !valorNumerico || !prazoMeses || !tipoProduto}>
            {editar.isPending ? 'Salvando...' : 'Salvar alterações'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}