import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, MessageSquarePlus } from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';
import {
  useWaLeadsSemConversa,
  useAbrirConversa,
  type WaLeadSemConversa,
} from '@/hooks/wa/useWaLeadsSemConversa';
import { formatPhone } from './waLabels';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (conversationId: string) => void;
}

export function NovaConversaDialog({ open, onOpenChange, onCreated }: Props) {
  const [busca, setBusca] = useState('');
  const [criandoId, setCriandoId] = useState<string | null>(null);
  const buscaDebounced = useDebounce(busca, 350);

  const { data: leads = [], isLoading } = useWaLeadsSemConversa(
    buscaDebounced,
    open,
  );
  const abrir = useAbrirConversa();

  const handleSelecionar = async (lead: WaLeadSemConversa) => {
    setCriandoId(lead.deal_id);
    try {
      const conversationId = await abrir.mutateAsync(lead.deal_id);
      onOpenChange(false);
      setBusca('');
      onCreated(conversationId);
    } catch {
      // toast de erro já é emitido pelo hook; mantém o dialog aberto.
    } finally {
      setCriandoId(null);
    }
  };

  const mostraVazio = !isLoading && leads.length === 0;
  const termoVazio = buscaDebounced.trim().length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 gap-0">
        <DialogHeader className="px-4 pt-4 pb-3 border-b">
          <DialogTitle className="flex items-center gap-2 text-base">
            <MessageSquarePlus className="h-4 w-4" /> Nova conversa
          </DialogTitle>
        </DialogHeader>

        <div className="p-3 border-b">
          <Input
            autoFocus
            placeholder="Buscar por nome ou telefone"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>

        <ScrollArea className="h-[min(60vh,24rem)]">
          <ul className="divide-y">
            {isLoading && Array.from({ length: 5 }).map((_, i) => (
              <li key={i} className="px-4 py-3">
                <Skeleton className="h-4 w-2/3 mb-2" />
                <Skeleton className="h-3 w-full" />
              </li>
            ))}

            {leads.map((lead) => {
              const criando = criandoId === lead.deal_id;
              const desabilitado = criandoId !== null;
              return (
                <li key={lead.deal_id}>
                  <button
                    type="button"
                    onClick={() => handleSelecionar(lead)}
                    disabled={desabilitado}
                    className="w-full text-left px-4 py-3 hover:bg-accent transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{lead.contato}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {formatPhone(lead.phone_e164)}
                        {lead.estagio ? ` · ${lead.estagio}` : ''}
                        {lead.produto ? ` · ${lead.produto}` : ''}
                        {` · ${lead.atividades} ativ.`}
                      </p>
                    </div>
                    {criando && <Loader2 className="h-4 w-4 shrink-0 animate-spin" />}
                  </button>
                </li>
              );
            })}
          </ul>

          {mostraVazio && (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              {termoVazio
                ? 'Nenhum lead da sua carteira sem conversa aberta.'
                : 'Nenhum lead encontrado para essa busca.'}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
