import { useEffect } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface CheckinMessage {
  id: string;
  room_id: string;
  sender_type: 'customer' | 'staff' | 'system';
  sender_user_id: string | null;
  sender_name: string | null;
  body: string;
  sent_at: string;
  delivered_at: string | null;
  read_at: string | null;
}

export function useCheckinMessages(roomId: string | null) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['checkin-messages', roomId],
    queryFn: async () => {
      if (!roomId) return [];
      const { data, error } = await supabase
        .from('checkin_messages')
        .select('*')
        .eq('room_id', roomId)
        .order('sent_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as CheckinMessage[];
    },
    enabled: !!roomId,
  });

  useEffect(() => {
    if (!roomId) return;
    const channel = supabase
      .channel(`checkin-room-${roomId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'checkin_messages', filter: `room_id=eq.${roomId}` },
        () => {
          qc.invalidateQueries({ queryKey: ['checkin-messages', roomId] });
          qc.invalidateQueries({ queryKey: ['checkin-rooms'] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, qc]);

  const sendMessage = useMutation({
    mutationFn: async ({ body }: { body: string }) => {
      if (!roomId) throw new Error('room not selected');
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      const { data: profile } = user
        ? await supabase.from('profiles').select('full_name, email').eq('id', user.id).maybeSingle()
        : { data: null } as any;

      const { error } = await supabase.from('checkin_messages').insert({
        room_id: roomId,
        sender_type: 'staff',
        sender_user_id: user?.id ?? null,
        sender_name: profile?.full_name ?? profile?.email ?? user?.email ?? 'Equipe MCF',
        body: body.trim(),
        delivered_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onError: (err: any) => {
      toast.error(err.message ?? 'Erro ao enviar mensagem');
    },
  });

  const markRead = useMutation({
    mutationFn: async () => {
      if (!roomId) return;
      const nowIso = new Date().toISOString();
      await supabase
        .from('checkin_messages')
        .update({ read_at: nowIso })
        .eq('room_id', roomId)
        .eq('sender_type', 'customer')
        .is('read_at', null);
      await supabase.from('checkin_rooms').update({ unread_for_team: 0 }).eq('id', roomId);
      qc.invalidateQueries({ queryKey: ['checkin-rooms'] });
    },
  });

  return { ...query, sendMessage, markRead };
}

export function useUpdateRoom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Record<string, any> }) => {
      const { error } = await supabase.from('checkin_rooms').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['checkin-rooms'] });
    },
    onError: (err: any) => toast.error(err.message ?? 'Erro ao atualizar sala'),
  });
}