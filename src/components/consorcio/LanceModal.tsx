import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { simularChanceLance, getCorChanceLance } from '@/lib/contemplacao';
import { useRegistrarLance } from '@/hooks/useContemplacao';
import { ConsorcioCard } from '@/types/consorcio';
import type { SimulacaoLance } from '@/lib/contemplacao';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card: ConsorcioCard | null;
}

export function LanceModal({ open, onOpenChange, card }: Props) {
  const [percentual, setPercentual] = useState('');
  const [valor, setValor] = useState('');
  const [observacao, setObservacao] = useState('');
  const [simulacao, setSimulacao] = useState<SimulacaoLance | null>(null);

  const lanceMutation = useRegistrarLance();

  const credito = card ? Number(card.valor_credito) : 0;

  const handlePercentualChange = (v: string) => {
    setPercentual(v);
    setSimulacao(null);
    const p = parseFloat(v);
    if (!isNaN(p) && credito > 0) {
      setValor(((credito * p) / 100).toFixed(2));
    } else {
      setValor('');
    }
  };

  const handleValorChange = (v: string) => {
    setValor(v);
    setSimulacao(null);
    const val = parseFloat(v);
    if (!isNaN(val) && credito > 0) {
      setPercentual(((val / credito) * 100).toFixed(2));
    } else {
      setPercentual('');
    }
  };

  const handleSimular = () => {
    const p = parseFloat(percentual);
    if (isNaN(p) || !credito) return;
    setSimulacao(simularChanceLance(credito, p));
  };

  const handleSalvar = async (registrarContemplacao: boolean) => {
    if (!card || !simulacao) return;
    await lanceMutation.mutateAsync({
      cardId: card.id,
      percentualLance: parseFloat(percentual),
      valorLance: parseFloat(valor),
      chanceClassificacao: simulacao.chanceContemplacao,
      posicaoEstimada: simulacao.posicaoEstimada,
      observacao: observacao || undefined,
      salvo: true,
      registrarContemplacao,
    });
    handleClose();
  };

  const handleClose = () => {
    setPercentual('');
    setValor('');
    setObservacao('');
    setSimulacao(null);
    onOpenChange(false);
  };

  if (!card) return null;

  const displayName = card.tipo_pessoa === 'pf' ? card.nome_completo : card.razao_social;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Simular / Registrar Lance</DialogTitle>
        </DialogHeader>

        <div className="space-y-1 text-sm text-muted-foreground border-b pb-3">
          <p><strong>{displayName}</strong></p>
          <p>Grupo {card.grupo} • Cota {card.cota} • Crédito R$ {credito.toLocaleString('pt-BR')}</p>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Percentual (%)</Label>
              <Input
                type="number"
                value={percentual}
                onChange={(e) => handlePercentualChange(e.target.value)}
                placeholder="25"
                step="0.1"
              />
            </div>
            <div className="space-y-2">
              <Label>Valor (R$)</Label>
              <Input
                type="number"
                value={valor}
                onChange={(e) => handleValorChange(e.target.value)}
                placeholder="50000"
                step="0.01"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Observação (opcional)</Label>
            <Textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              rows={2}
            />
          </div>

          <Button onClick={handleSimular} disabled={!percentual} className="w-full">
            Simular
          </Button>

          {simulacao && (
            <div className="p-4 rounded-lg border bg-muted/50 space-y-2">
              <div className="flex items-center gap-2">
                <Badge className={getCorChanceLance(simulacao.chanceContemplacao)}>
                  {simulacao.chanceContemplacao.replace('_', ' ').toUpperCase()}
                </Badge>
                <span className="text-xs text-muted-foreground">Posição estimada: #{simulacao.posicaoEstimada}</span>
              </div>
              <p className="text-sm">{simulacao.mensagem}</p>

              <div className="flex gap-2 mt-3">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleSalvar(false)}
                  disabled={lanceMutation.isPending}
                >
                  Salvar Lance
                </Button>
                {(simulacao.chanceContemplacao === 'alta' || simulacao.chanceContemplacao === 'muito_alta') && (
                  <Button
                    size="sm"
                    onClick={() => handleSalvar(true)}
                    disabled={lanceMutation.isPending}
                  >
                    Registrar Contemplação
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
