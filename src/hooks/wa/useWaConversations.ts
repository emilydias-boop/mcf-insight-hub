import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

export type WaConversationStatus = 'aberta' | 'aguardando_cliente' | 'sem_contato' | 'resolvida';

export interface WaConversation {
  id: string;
  phone_e164: string;
  contact_name: string | null;
  deal_id: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  last_direction: 'inbound' | 'outbound' | null;
  unread_count: number;
  status: WaConversationStatus;
  assigned_to: string | null;
  assigned_at: string | null;
  assigned_reason: string | null;
  last_inbound_at: string | null;
  first_contact_at: string | null;
  /** Quando o webhook detectou pedido de descadastro. Só sinalização — o opt-out é manual. */
  pedido_saida_em: string | null;
  created_at: string;
  updated_at: string;
}

export type WaScope = 'mine' | 'all';

/** Campos que a tela realmente altera. */
export interface WaConversationPatch {
  status?: WaConversationStatus;
  assigned_to?: string | null;
  pedido_saida_em?: string | null;
}

export function useWaConversations(scope: WaScope = 'mine') {
  const qc = useQueryClient();
  const { user } = useAuth();
  const uid = user?.id ?? null;
  /** Sufixo por instância: evita duas assinaturas disputando o mesmo canal. */
  const sufixoCanal = useRef(Math.random().toString(36).slice(2, 8));

  const query = useQuery({
    queryKey: ['wa-conversations', scope, uid],
    staleTime: 15_000,
    // Rede de segurança: se o realtime cair, badge e ordenação ainda aparecem.
    refetchInterval: 20_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      let q = supabase
        .from('wa_conversations')
        .select('*')
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(500);

      if (scope === 'mine') {
        if (!uid) return [] as WaConversation[];
        q = q.eq('assigned_to', uid);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as WaConversation[];
    },
  });

  useEffect(() => {
    const nomeCanal = `wa-conversations-${scope}-${sufixoCanal.current}`;
    const channel = supabase
      .channel(nomeCanal)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wa_conversations' }, () => {
        qc.invalidateQueries({ queryKey: ['wa-conversations'] });
      })
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
  }, [qc, scope]);

  return query;
}

export function useUpdateWaConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: WaConversationPatch }) => {
      const { data, error } = await supabase
        .from('wa_conversations')
        .update(patch)
        .eq('id', id)
        .select('id');
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('Não foi possível atualizar a conversa (sem permissão ou já alterada).');
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wa-conversations'] });
    },
    onError: (err: unknown) =>
      toast.error(err instanceof Error ? err.message : 'Erro ao atualizar conversa'),
  });
}