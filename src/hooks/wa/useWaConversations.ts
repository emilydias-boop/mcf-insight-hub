import { useEffect } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type WaConversationStatus = 'aberta' | 'aguardando_cliente' | 'resolvida';

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
  created_at: string;
  updated_at: string;
}

export type WaScope = 'mine' | 'all';

export function useWaConversations(scope: WaScope = 'mine') {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['wa-conversations', scope],
    queryFn: async () => {
      let q = supabase
        .from('wa_conversations')
        .select('*')
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(500);

      if (scope === 'mine') {
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth.user?.id;
        if (!uid) return [] as WaConversation[];
        q = q.eq('assigned_to', uid);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as WaConversation[];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel('wa-conversations-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wa_conversations' }, () => {
        qc.invalidateQueries({ queryKey: ['wa-conversations'] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  return query;
}

export function useUpdateWaConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Record<string, any> }) => {
      const { error } = await supabase.from('wa_conversations').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wa-conversations'] });
    },
    onError: (err: any) => toast.error(err.message ?? 'Erro ao atualizar conversa'),
  });
}