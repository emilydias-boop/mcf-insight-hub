import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CheckinRoom {
  id: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  product_name: string | null;
  purchase_date: string | null;
  assigned_to: string | null;
  status: 'novo' | 'em_atendimento' | 'aguardando_cliente' | 'concluido';
  access_token: string;
  last_message_at: string | null;
  last_message_preview: string | null;
  unread_for_team: number;
  unread_for_customer: number;
  created_at: string;
  updated_at: string;
  deal_id: string | null;
  attendee_id: string | null;
  hubla_transaction_id: string | null;
}

export function useCheckinRooms() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['checkin-rooms'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('checkin_rooms')
        .select('*')
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as CheckinRoom[];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel('checkin-rooms-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'checkin_rooms' }, () => {
        qc.invalidateQueries({ queryKey: ['checkin-rooms'] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  return query;
}