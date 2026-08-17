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
import { useConsorcioTipoOptions, useConsorcioOrigemOptions } from '@/hooks/useConsorcioConfigOptions';

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
  const [origemLead, setOrigemLead] = useState('');
  const enviarProposta = useEnviarProposta();
  const { data: tipoOptions = [] } = useConsorcioTipoOptions();
  const { data: origemOptions = [] } = useConsorcioOrigemOptions();

  // Se o valor atual não existir no catálogo, exibe como "legado" para não esvaziar o campo.
  const tipoList = tipoProduto && !tipoOptions.some(o => o.name === tipoProduto)
    ? [...tipoOptions.map(o => ({ name: o.name, label: o.label })), { name: tipoProduto, label: `${tipoProduto} (legado)` }]
    : tipoOptions.map(o => ({ name: o.name, label: o.label }));
  const origemList = origemLead && !origemOptions.some(o => o.name === origemLead)
    ? [...origemOptions.map(o => ({ name: o.name, label: o.label })), { name: origemLead, label: `${origemLead} (legado)` }]
    : origemOptions.map(o => ({ name: o.name, label: o.label }));

  // Formata valor em BRL (1.000.000,00) enquanto o usuário digita.
  // Armazena internamente como string com centavos preservados.
  const formatBRL = (raw: string) => {
    const digits = raw.replace(/\D/g, '');
    if (!digits) return '';
    const cents = Number(digits) / 100;
    return cents.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const parseBRL = (formatted: string): number => {
    const digits = formatted.replace(/\D/g, '');
    if (!digits) return 0;
    return Number(digits) / 100;
  };

  const valorNumerico = parseBRL(valorCredito);

  const handleSubmit = () => {
    if (!valorNumerico || !prazoMeses || !tipoProduto) return;
    enviarProposta.mutate({
      deal_id: dealId,
      origin_id: originId,
      proposal_details: details,
      valor_credito: valorNumerico,
      prazo_meses: Number(prazoMeses),
      tipo_produto: tipoProduto,
      origem_lead: origemLead || undefined,
    }, {
      onSuccess: () => {
        onOpenChange(false);
        setDetails(''); setValorCredito(''); setPrazoMeses(''); setTipoProduto(''); setOrigemLead('');
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
                {tipoList.map(o => (
                  <SelectItem key={o.name} value={o.name}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
          <Button onClick={handleSubmit} disabled={enviarProposta.isPending || !valorNumerico || !prazoMeses || !tipoProduto}>
            {enviarProposta.isPending ? 'Enviando...' : 'Registrar Proposta'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
