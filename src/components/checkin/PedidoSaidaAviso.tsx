import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BellOff } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import type { WaConversation } from '@/hooks/wa/useWaConversations';

/**
 * Aviso de pedido de saída. O webhook só sinaliza; quem decide é o SDR.
 * Registrar o opt-out tira a pessoa dos DISPAROS, mas não impede conversa 1:1.
 */
export function PedidoSaidaAviso({ conversation }: { conversation: WaConversation }) {
  const qc = useQueryClient();
  const [confirmarOpen, setConfirmarOpen] = useState(false);
  const [salvando, setSalvando] = useState(false);

  if (!conversation.pedido_saida_em) return null;

  const dataPedido = format(new Date(conversation.pedido_saida_em), "dd/MM/yyyy 'às' HH:mm", {
    locale: ptBR,
  });

  const invalidar = () => qc.invalidateQueries({ queryKey: ['wa-conversations'] });

  const registrarOptOut = async () => {
    setSalvando(true);
    try {
      const { error } = await supabase.rpc('wa_register_opt_out', {
        _phone: conversation.phone_e164,
        _motivo: 'pedido do contato via WhatsApp',
      });
      if (error) throw error;
      // Com o opt-out registrado, o aviso não precisa mais ficar na tela.
      await supabase
        .from('wa_conversations')
        .update({ pedido_saida_em: null })
        .eq('id', conversation.id);
      toast.success('Opt-out registrado. O contato não entra mais nos disparos.');
      invalidar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao registrar opt-out');
    } finally {
      setSalvando(false);
      setConfirmarOpen(false);
    }
  };

  const descartarSinal = async () => {
    setSalvando(true);
    try {
      const { error } = await supabase
        .from('wa_conversations')
        .update({ pedido_saida_em: null })
        .eq('id', conversation.id);
      if (error) throw error;
      toast.success('Aviso removido.');
      invalidar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao remover o aviso');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="rounded-md border border-warning/50 bg-warning/10 p-3 space-y-2">
      <div className="flex items-start gap-2">
        <BellOff className="h-4 w-4 mt-0.5 text-warning shrink-0" />
        <div className="text-xs space-y-1">
          <div className="font-semibold text-foreground">
            O contato pediu para não receber mais mensagens
          </div>
          <div className="text-muted-foreground">
            Detectado em {dataPedido}. Registrar o opt-out tira a pessoa dos <b>disparos</b>, mas
            não impede a conversa 1:1 aqui no atendimento.
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={salvando} onClick={() => setConfirmarOpen(true)}>
          Registrar opt-out
        </Button>
        <Button size="sm" variant="ghost" disabled={salvando} onClick={descartarSinal}>
          Não era pedido de saída
        </Button>
      </div>

      <AlertDialog open={confirmarOpen} onOpenChange={setConfirmarOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Registrar opt-out deste contato?</AlertDialogTitle>
            <AlertDialogDescription>
              O contato deixa de entrar nos próximos disparos de WhatsApp. É difícil de desfazer —
              a remoção da lista precisa ser feita manualmente. A conversa 1:1 continua permitida.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={salvando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={salvando} onClick={registrarOptOut}>
              Registrar opt-out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
