import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info, Loader2, Megaphone } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useCriarDisparoDeSelecao } from '@/hooks/wa/useWaBroadcasts';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDealIds: string[];
  originId?: string | null;
  onSuccess: () => void;
}

export const BulkBroadcastDialog = ({
  open,
  onOpenChange,
  selectedDealIds,
  onSuccess,
}: Props) => {
  const navigate = useNavigate();
  const criar = useCriarDisparoDeSelecao();
  const [nome, setNome] = useState('');

  // nome sugerido a cada abertura, editável
  useEffect(() => {
    if (open) {
      setNome(`Seleção CRM — ${format(new Date(), "dd/MM", { locale: ptBR })}`);
    }
  }, [open]);

  const handleConfirmar = async () => {
    if (!nome.trim() || selectedDealIds.length === 0) return;
    try {
      const id = await criar.mutateAsync({ nome: nome.trim(), dealIds: selectedDealIds });
      onOpenChange(false);
      onSuccess();
      navigate(`/checkin/disparos/${id}`);
    } catch {
      // o toast vem do hook com a mensagem do banco; o diálogo fica aberto
      // para o usuário ajustar a seleção
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5" /> Disparar por template
          </DialogTitle>
          <DialogDescription>
            {selectedDealIds.length} negócio(s) selecionado(s) vão compor o público deste disparo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-2">
            <Label htmlFor="nome-disparo">Nome do disparo</Label>
            <Input
              id="nome-disparo"
              autoFocus
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: Seleção CRM — reativação"
            />
          </div>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Isso cria um <strong>rascunho</strong> com esses leads e abre a tela do disparo para
              você escolher o template e revisar. <strong>Nada é enviado agora</strong> — ainda há a
              etapa de confirmação antes de qualquer mensagem sair.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={criar.isPending}>
            Cancelar
          </Button>
          <Button onClick={handleConfirmar} disabled={!nome.trim() || criar.isPending}>
            {criar.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Criando rascunho...
              </>
            ) : (
              `Criar rascunho com ${selectedDealIds.length} lead(s)`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
