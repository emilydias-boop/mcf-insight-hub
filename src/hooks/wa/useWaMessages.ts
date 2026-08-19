import { useCallback, useEffect, useRef } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type WaMessageStatus = 'sent' | 'delivered' | 'read' | 'failed' | 'received';

export interface WaMessage {
  id: string;
  conversation_id: string;
  direction: 'inbound' | 'outbound';
  body: string | null;
  twilio_message_sid: string | null;
  sent_by_user_id: string | null;
  sent_by_name: string | null;
  status: WaMessageStatus | null;
  error_message: string | null;
  delivered_at: string | null;
  read_at: string | null;
  external_status: string | null;
  created_at: string;
}

/** Erro de envio já traduzido a partir do corpo da resposta da edge function. */
export class WaSendError extends Error {
  code?: string;
  status?: number;
  constructor(message: string, code?: string, status?: number) {
    super(message);
    this.name = 'WaSendError';
    this.code = code;
    this.status = status;
  }
}

function errMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

async function extractFunctionError(error: unknown, data: unknown): Promise<WaSendError | null> {
  const FALLBACK = 'Erro ao enviar mensagem via WhatsApp';
  // supabase.functions.invoke devolve FunctionsHttpError em 4xx, com o Response em .context
  const context = (error as { context?: unknown } | null)?.context;
  const res: Response | undefined = context instanceof Response ? context : undefined;
  if (res) {
    let payload: { error?: string; message?: string } | null = null;
    try {
      payload = (await res.clone().json()) as { error?: string; message?: string };
    } catch {
      /* corpo não-JSON */
    }
    return new WaSendError(
      payload?.message ?? payload?.error ?? errMessage(error, FALLBACK),
      payload?.error,
      res.status,
    );
  }
  if (error) {
    return new WaSendError(errMessage(error, FALLBACK));
  }
  const payload = data as { error?: string; message?: string } | null;
  if (payload?.error) {
    return new WaSendError(payload.message ?? payload.error, payload.error);
  }
  return null;
}

export function useWaMessages(conversationId: string | null) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['wa-messages', conversationId],
    queryFn: async () => {
      if (!conversationId) return [] as WaMessage[];
      const { data, error } = await supabase
        .from('wa_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as WaMessage[];
    },
    enabled: !!conversationId,
    staleTime: 10_000,
  });

  const markReadRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase
      .channel(`wa-conversation-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'wa_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          qc.invalidateQueries({ queryKey: ['wa-messages', conversationId] });
          qc.invalidateQueries({ queryKey: ['wa-conversations'] });
          // conversa aberta: mensagem nova do cliente já entra como lida
          const row = payload.new as { direction?: string; read_at?: string | null } | null;
          if (payload.eventType !== 'DELETE' && row?.direction === 'inbound' && !row.read_at) {
            markReadRef.current();
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, qc]);

  const sendMessage = useMutation({
    mutationFn: async (input: {
      body?: string;
      template_sid?: string;
      template_variables?: Record<string, string>;
    }) => {
      if (!conversationId) throw new WaSendError('Conversa não selecionada');
      const payload: Record<string, unknown> = { conversation_id: conversationId };
      if (input.template_sid) {
        payload.template_sid = input.template_sid;
        if (input.template_variables) payload.template_variables = input.template_variables;
      } else if (input.body) {
        payload.body = input.body.trim();
      } else {
        throw new WaSendError('Informe body ou template_sid');
      }

      const { data, error } = await supabase.functions.invoke('twilio-wa-send', { body: payload });
      const failure = await extractFunctionError(error, data);
      if (failure) throw failure;
      return data;
    },
    onError: (err: unknown) => {
      toast.error(errMessage(err, 'Erro ao enviar mensagem via WhatsApp'));
      if (err instanceof WaSendError && err.code === 'janela_fechada') {
        // a conversa mudou de estado no servidor: recarrega para a UI cair no modo template
        qc.invalidateQueries({ queryKey: ['wa-conversations'] });
      }
      if (err instanceof WaSendError && err.code === 'template_nao_aprovado') {
        // o template pode ter sido desaprovado desde o carregamento da lista
        qc.invalidateQueries({ queryKey: ['checkin_templates', 'whatsapp_approved'] });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wa-messages', conversationId] });
      qc.invalidateQueries({ queryKey: ['wa-conversations'] });
    },
  });

  const markRead = useMutation({
    mutationFn: async () => {
      if (!conversationId) return;
      const nowIso = new Date().toISOString();
      const { data: updated, error: updateError } = await supabase
        .from('wa_messages')
        .update({ read_at: nowIso })
        .eq('conversation_id', conversationId)
        .eq('direction', 'inbound')
        .is('read_at', null)
        .select('id');
      if (updateError) throw updateError;
      // unread_count é recalculado por trigger no banco a partir de read_at
      return updated ?? [];
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wa-messages', conversationId] });
      qc.invalidateQueries({ queryKey: ['wa-conversations'] });
    },
    onError: (err: unknown) =>
      toast.error(errMessage(err, 'Não foi possível marcar as mensagens como lidas')),
  });

  const markReadNow = useCallback(() => {
    if (!markRead.isPending) markRead.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, markRead.isPending]);

  useEffect(() => {
    markReadRef.current = markReadNow;
  }, [markReadNow]);

  return { ...query, sendMessage, markRead };
}