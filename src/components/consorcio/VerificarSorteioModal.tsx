import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { verificarContemplacao } from '@/lib/contemplacao';
import { useVerificarSorteio } from '@/hooks/useContemplacao';
import { ConsorcioCard } from '@/types/consorcio';
import { CheckCircle, XCircle } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card: ConsorcioCard | null;
}

export function VerificarSorteioModal({ open, onOpenChange, card }: Props) {
  const [numeroSorteado, setNumeroSorteado] = useState('');
  const [dataAssembleia, setDataAssembleia] = useState('');
  const [observacao, setObservacao] = useState('');
  const [resultado, setResultado] = useState<ReturnType<typeof verificarContemplacao> | null>(null);

  const verificarMutation = useVerificarSorteio();

  const handleVerificar = () => {
    if (!card || !numeroSorteado) return;
    const res = verificarContemplacao(card.cota, numeroSorteado);
    setResultado(res);
  };

  const handleRegistrar = async (confirmarContemplacao: boolean) => {
    if (!card || !resultado) return;
    await verificarMutation.mutateAsync({
      cardId: card.id,
      numeroSorteado,
      contemplado: confirmarContemplacao && resultado.contemplado,
      distancia: resultado.distancia,
      dataAssembleia: dataAssembleia || new Date().toISOString().split('T')[0],
      observacao: observacao || undefined,
    });
    handleClose();
  };

  const handleClose = () => {
    setNumeroSorteado('');
    setDataAssembleia('');
    setObservacao('');
    setResultado(null);
    onOpenChange(false);
  };

  if (!card) return null;

  const displayName = card.tipo_pessoa === 'pf' ? card.nome_completo : card.razao_social;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Verificar Sorteio</DialogTitle>
        </DialogHeader>

        <div className="space-y-1 text-sm text-muted-foreground border-b pb-3">
          <p><strong>{displayName}</strong></p>
          <p>Grupo {card.grupo} • Cota {card.cota} • Crédito R$ {Number(card.valor_credito).toLocaleString('pt-BR')}</p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Número Sorteado</Label>
            <Input
              value={numeroSorteado}
              onChange={(e) => { setNumeroSorteado(e.target.value); setResultado(null); }}
              placeholder="Ex: 1234"
            />
          </div>

          <div className="space-y-2">
            <Label>Data da Assembleia</Label>
            <Input
              type="date"
              value={dataAssembleia}
              onChange={(e) => setDataAssembleia(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Observação (opcional)</Label>
            <Textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              rows={2}
            />
          </div>

          <Button onClick={handleVerificar} disabled={!numeroSorteado} className="w-full">
            Verificar
          </Button>

          {resultado && (
            <div className={`p-4 rounded-lg border ${resultado.contemplado ? 'bg-green-50 border-green-200' : 'bg-muted border-border'}`}>
              <div className="flex items-center gap-2 mb-2">
                {resultado.contemplado ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <XCircle className="h-5 w-5 text-muted-foreground" />
                )}
                <Badge className={resultado.contemplado ? 'bg-green-600' : 'bg-muted-foreground'}>
                  {resultado.contemplado ? 'Contemplado' : 'Não Contemplado'}
                </Badge>
              </div>
              <p className="text-sm">{resultado.mensagem}</p>
              <p className="text-xs text-muted-foreground mt-1">Distância: {resultado.distancia}</p>

              <div className="flex gap-2 mt-3">
                {resultado.contemplado && (
                  <Button
                    size="sm"
                    onClick={() => handleRegistrar(true)}
                    disabled={verificarMutation.isPending}
                  >
                    Confirmar Contemplação
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleRegistrar(false)}
                  disabled={verificarMutation.isPending}
                >
                  Salvar Verificação
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
