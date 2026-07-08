import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type WaConversation = {
  id: string;
  phone_e164: string;
  contact_name: string | null;
  deal_id: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  last_direction: 'inbound' | 'outbound' | null;
  unread_count: number;
  created_at: string;
};

export type WaMessage = {
  id: string;
  conversation_id: string;
  direction: 'inbound' | 'outbound';
  body: string;
  sent_by_user_id: string | null;
  sent_by_name: string | null;
  status: string | null;
  error_message: string | null;
  created_at: string;
};

export function useWaConversations() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['wa_conversations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wa_conversations')
        .select('*')
        .order('last_message_at', { ascending: false, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as WaConversation[];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel('wa_conversations_rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wa_conversations' }, () => {
        qc.invalidateQueries({ queryKey: ['wa_conversations'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  return query;
}

export function useWaMessages(conversationId: string | null) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['wa_messages', conversationId],
    enabled: !!conversationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wa_messages')
        .select('*')
        .eq('conversation_id', conversationId!)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as WaMessage[];
    },
  });

  useEffect(() => {
    if (!conversationId) return;
    const ch = supabase
      .channel(`wa_messages_rt_${conversationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'wa_messages', filter: `conversation_id=eq.${conversationId}` },
        () => {
          qc.invalidateQueries({ queryKey: ['wa_messages', conversationId] });
          qc.invalidateQueries({ queryKey: ['wa_conversations'] });
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [conversationId, qc]);

  return query;
}

export function useSendWaMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { conversation_id: string; body: string }) => {
      const { data, error } = await supabase.functions.invoke('twilio-wa-send', { body: payload });
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['wa_messages', vars.conversation_id] });
      qc.invalidateQueries({ queryKey: ['wa_conversations'] });
    },
  });
}

export function useStartWaConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { phone: string; contact_name?: string; deal_id?: string }) => {
      const { data, error } = await supabase.functions.invoke('twilio-wa-start', { body: payload });
      if (error) throw error;
      return data as { conversation_id: string };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wa_conversations'] });
    },
  });
}

export function useMarkWaConversationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (conversationId: string) => {
      const { error } = await supabase
        .from('wa_conversations')
        .update({ unread_count: 0 })
        .eq('id', conversationId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wa_conversations'] }),
  });
}

export function useHasMcfAtendimentoAccess() {
  return useQuery({
    queryKey: ['mcf_atendimento_access', 'self'],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) return false;
      // admin/manager também podem
      const { data: roles } = await supabase
        .from('user_roles').select('role').eq('user_id', uid);
      if ((roles ?? []).some((r: any) => r.role === 'admin' || r.role === 'manager')) return true;
      const { data } = await supabase
        .from('mcf_atendimento_access').select('user_id').eq('user_id', uid).maybeSingle();
      return !!data;
    },
  });
}