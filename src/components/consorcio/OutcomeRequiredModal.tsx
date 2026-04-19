import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { CheckCircle, XCircle, Clock, ArrowLeft } from 'lucide-react';
import { ProposalModal } from './ProposalModal';
import { SemSucessoModal } from './SemSucessoModal';
import { useMarcarAguardarRetorno } from '@/hooks/useConsorcioPostMeeting';
import { cn } from '@/lib/utils';

interface OutcomeRequiredModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dealId: string;
  dealName: string;
  contactName: string;
  originId: string;
}

type View = 'choice' | 'aguardar';

export function OutcomeRequiredModal({
  open, onOpenChange, dealId, dealName, contactName, originId,
}: OutcomeRequiredModalProps) {
  const [view, setView] = useState<View>('choice');
  const [observacao, setObservacao] = useState('');
  const [showProposal, setShowProposal] = useState(false);
  const [showSemSucesso, setShowSemSucesso] = useState(false);
  const aguardar = useMarcarAguardarRetorno();

  const handleClose = (v: boolean) => {
    if (!v) {
      setView('choice');
      setObservacao('');
    }
    onOpenChange(v);
  };

  const handleAguardarSubmit = () => {
    aguardar.mutate(
      { deal_id: dealId, origin_id: originId, observacao },
      {
        onSuccess: () => {
          setView('choice');
          setObservacao('');
          onOpenChange(false);
        },
      }
    );
  };

  const openProposal = () => {
    onOpenChange(false);
    setTimeout(() => setShowProposal(true), 100);
  };
  const openSemSucesso = () => {
    onOpenChange(false);
    setTimeout(() => setShowSemSucesso(true), 100);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Qual o desfecho da reunião?</DialogTitle>
            <DialogDescription>
              {contactName} — {dealName}
              <br />
              <span className="text-xs text-amber-600 dark:text-amber-400">
                Registre agora para manter as métricas atualizadas
              </span>
            </DialogDescription>
          </DialogHeader>

          {view === 'choice' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 py-2">
              <OutcomeCard
                icon={<CheckCircle className="h-6 w-6" />}
                title="Proposta Enviada"
                description="Apresentou valores ao cliente"
                color="emerald"
                onClick={openProposal}
              />
              <OutcomeCard
                icon={<Clock className="h-6 w-6" />}
                title="Aguardar Retorno"
                description="Cliente vai pensar / responder"
                color="amber"
                onClick={() => setView('aguardar')}
              />
              <OutcomeCard
                icon={<XCircle className="h-6 w-6" />}
                title="Sem Sucesso"
                description="Recusa direta / desqualificou"
                color="destructive"
                onClick={openSemSucesso}
              />
            </div>
          )}

          {view === 'aguardar' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Button variant="ghost" size="sm" onClick={() => setView('choice')}>
                  <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
                </Button>
              </div>
              <div>
                <Label>Observação (opcional)</Label>
                <Textarea
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                  placeholder="Ex: cliente vai conversar com a esposa, retorna até quarta..."
                  rows={4}
                />
              </div>
              <div className="rounded-md bg-amber-500/10 border border-amber-500/30 p-3 text-xs text-amber-700 dark:text-amber-400">
                Será registrado um prazo de <strong>48h</strong> para o cliente retornar.
                Após esse período, esta reunião aparecerá como pendente novamente.
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setView('choice')}>Cancelar</Button>
                <Button onClick={handleAguardarSubmit} disabled={aguardar.isPending}>
                  {aguardar.isPending ? 'Salvando...' : 'Confirmar Aguardar'}
                </Button>
              </DialogFooter>
            </div>
          )}

          {view === 'choice' && (
            <DialogFooter className="border-t pt-3">
              <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
                Decidir depois
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      <ProposalModal
        open={showProposal}
        onOpenChange={setShowProposal}
        dealId={dealId}
        dealName={dealName}
        contactName={contactName}
        originId={originId}
      />
      <SemSucessoModal
        open={showSemSucesso}
        onOpenChange={setShowSemSucesso}
        dealId={dealId}
        dealName={dealName}
        contactName={contactName}
        originId={originId}
      />
    </>
  );
}

function OutcomeCard({
  icon, title, description, color, onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  color: 'emerald' | 'amber' | 'destructive';
  onClick: () => void;
}) {
  const colorClasses = {
    emerald: 'hover:bg-emerald-500/10 hover:border-emerald-500 text-emerald-600',
    amber: 'hover:bg-amber-500/10 hover:border-amber-500 text-amber-600',
    destructive: 'hover:bg-destructive/10 hover:border-destructive text-destructive',
  }[color];

  return (
    <Card
      onClick={onClick}
      className={cn(
        'p-4 cursor-pointer transition-all border-2 flex flex-col items-center text-center gap-2',
        colorClasses
      )}
    >
      <div>{icon}</div>
      <div className="font-medium text-sm text-foreground">{title}</div>
      <div className="text-xs text-muted-foreground">{description}</div>
    </Card>
  );
}
