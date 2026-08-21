import { useCallback, useEffect, useRef } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { resolveMediaType, safeFileName, validateWaMedia } from '@/lib/waMedia';

export const WA_MEDIA_BUCKET = 'wa-media';

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
  media_path: string | null;
  media_type: string | null;
  media_size_bytes: number | null;
  media_filename: string | null;
  media_duration_seconds: number | null;
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

/** Códigos que o backend só devolve ANTES de entregar a mídia ao Twilio. */
const PRE_SEND_ERROR_CODES = new Set([
  'midia_invalida',
  'midia_com_template',
  'janela_fechada',
  'conversa_nao_encontrada',
  'template_nao_aprovado',
  'parametros_invalidos',
  'midia_nao_encontrada',
  // teto diario: o backend bloqueia antes de chamar a Twilio, entao a midia ja
  // enviada ao bucket pode ser limpa.
  'teto_diario_atingido',
]);

/**
 * true quando a falha aconteceu antes do envio — aí o arquivo pode ser apagado.
 * 5xx / timeout / erro sem status ficam de fora: o Twilio ainda pode buscar a mídia.
 */
function isPreSendFailure(failure: WaSendError): boolean {
  if (failure.code && PRE_SEND_ERROR_CODES.has(failure.code)) return true;
  return typeof failure.status === 'number' && failure.status >= 400 && failure.status < 500;
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

  /** Sufixo por instância: dois montes não podem disputar o mesmo canal. */
  const sufixoCanal = useRef(Math.random().toString(36).slice(2, 8));

  useEffect(() => {
    if (!conversationId) return;
    const nomeCanal = `wa-conversation-${conversationId}-${sufixoCanal.current}`;
    const channel = supabase
      .channel(nomeCanal)
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
          // conversa aberta: mensagem nova do cliente só vira lida se a aba estiver
          // visível — caso contrário o badge precisa sobreviver até o SDR voltar.
          const row = payload.new as { direction?: string; read_at?: string | null } | null;
          if (
            payload.eventType !== 'DELETE' &&
            row?.direction === 'inbound' &&
            !row.read_at &&
            document.visibilityState === 'visible'
          ) {
            markReadRef.current();
          }
        },
      )
      .subscribe((status) => {
        if (status !== 'SUBSCRIBED') {
          console.warn(`[wa-realtime] canal ${nomeCanal}: ${status}`);
        } else {
          console.info(`[wa-realtime] canal ${nomeCanal}: SUBSCRIBED`);
        }
      });
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

  // Quando a aba volta ao foco com a conversa aberta, marca as mensagens
  // recebidas enquanto estava em background como lidas.
  useEffect(() => {
    if (!conversationId) return;
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') markReadRef.current();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [conversationId]);

  const sendMedia = useMutation({
    mutationFn: async (input: {
      file: File | Blob;
      /** nome do arquivo (obrigatório quando `file` é Blob de gravação) */
      filename?: string;
      /** MIME já resolvido (gravação de áudio); se ausente, deduzimos do File */
      mediaType?: string;
      caption?: string;
      durationSeconds?: number;
    }) => {
      if (!conversationId) throw new WaSendError('Conversa não selecionada');

      const filename = safeFileName(
        input.filename ?? (input.file instanceof File ? input.file.name : 'arquivo'),
      );
      const asFile =
        input.file instanceof File
          ? input.file
          : new File([input.file], filename, { type: input.mediaType ?? input.file.type });
      const mediaType = input.mediaType ?? resolveMediaType(asFile);

      const invalid = validateWaMedia(
        new File([asFile], filename, { type: mediaType }),
      );
      if (invalid) throw new WaSendError(invalid, 'midia_invalida');

      const path = `${conversationId}/${Date.now()}-${filename}`;
      const { error: uploadError } = await supabase.storage
        .from(WA_MEDIA_BUCKET)
        .upload(path, asFile, { contentType: mediaType, upsert: false });
      if (uploadError) {
        throw new WaSendError(uploadError.message || 'Falha ao enviar o arquivo ao storage');
      }

      const payload: Record<string, unknown> = {
        conversation_id: conversationId,
        media_path: path,
        media_type: mediaType,
        media_filename: filename,
      };
      if (input.durationSeconds) payload.media_duration_seconds = input.durationSeconds;
      if (input.caption?.trim()) payload.body = input.caption.trim();

      const { data, error } = await supabase.functions.invoke('twilio-wa-send', { body: payload });
      const failure = await extractFunctionError(error, data);
      if (failure) {
        // O Twilio busca a signed URL DEPOIS da resposta da função: só apagamos o arquivo
        // quando a falha é comprovadamente anterior ao envio (validação / 4xx).
        // Em 5xx, timeout ou erro desconhecido, mantemos o arquivo — órfão custa storage,
        // mídia quebrada custa o cliente.
        if (isPreSendFailure(failure)) {
          const { error: removeError } = await supabase.storage
            .from(WA_MEDIA_BUCKET)
            .remove([path]);
          if (removeError) {
            console.warn('[wa] falha ao remover mídia não enviada', path, removeError.message);
          }
        }
        throw failure;
      }
      return data;
    },
    onError: (err: unknown) => {
      toast.error(errMessage(err, 'Erro ao enviar arquivo via WhatsApp'));
      if (err instanceof WaSendError && err.code === 'janela_fechada') {
        qc.invalidateQueries({ queryKey: ['wa-conversations'] });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wa-messages', conversationId] });
      qc.invalidateQueries({ queryKey: ['wa-conversations'] });
    },
  });

  return { ...query, sendMessage, sendMedia, markRead };
}

/** Signed URL (1h) gerada sob demanda por mensagem; nunca persistida além disso. */
export function useWaMediaUrl(mediaPath: string | null | undefined) {
  return useQuery({
    queryKey: ['wa-media-url', mediaPath],
    queryFn: async () => {
      if (!mediaPath) return null;
      const { data, error } = await supabase.storage
        .from(WA_MEDIA_BUCKET)
        .createSignedUrl(mediaPath, 3600);
      if (error) throw error;
      return data?.signedUrl ?? null;
    },
    enabled: !!mediaPath,
    staleTime: 30 * 60 * 1000,
    gcTime: 45 * 60 * 1000,
  });
}