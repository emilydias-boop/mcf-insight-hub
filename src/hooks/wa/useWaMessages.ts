import { useEffect } from 'react';
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

async function extractFunctionError(error: any, data: any): Promise<WaSendError | null> {
  // supabase.functions.invoke devolve FunctionsHttpError em 4xx, com o Response em .context
  const res: Response | undefined = error?.context instanceof Response ? error.context : undefined;
  if (res) {
    let payload: any = null;
    try {
      payload = await res.clone().json();
    } catch {
      /* corpo não-JSON */
    }
    return new WaSendError(
      payload?.message ?? payload?.error ?? error.message ?? 'Erro ao enviar mensagem via WhatsApp',
      payload?.error,
      res.status,
    );
  }
  if (error) {
    return new WaSendError(error.message ?? 'Erro ao enviar mensagem via WhatsApp');
  }
  if (data?.error) {
    return new WaSendError(data.message ?? data.error, data.error);
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
  });

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
        () => {
          qc.invalidateQueries({ queryKey: ['wa-messages', conversationId] });
          qc.invalidateQueries({ queryKey: ['wa-conversations'] });
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
    onError: (err: any) => {
      toast.error(err?.message ?? 'Erro ao enviar mensagem via WhatsApp');
      if (err instanceof WaSendError && err.code === 'janela_fechada') {
        // a conversa mudou de estado no servidor: recarrega para a UI cair no modo template
        qc.invalidateQueries({ queryKey: ['wa-conversations'] });
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
      await supabase
        .from('wa_messages')
        .update({ read_at: nowIso })
        .eq('conversation_id', conversationId)
        .eq('direction', 'inbound')
        .is('read_at', null);
      await supabase.from('wa_conversations').update({ unread_count: 0 }).eq('id', conversationId);
      qc.invalidateQueries({ queryKey: ['wa-conversations'] });
    },
  });

  return { ...query, sendMessage, markRead };
}