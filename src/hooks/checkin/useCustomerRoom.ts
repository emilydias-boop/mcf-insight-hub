import { useEffect, useState, useCallback } from 'react';
import { supabase, SUPABASE_PROJECT_URL } from '@/integrations/supabase/client';

export interface CustomerRoomData {
  id: string;
  customer_name: string;
  customer_email: string | null;
  product_name: string | null;
  purchase_date: string | null;
  status: string;
}

export interface CustomerMessage {
  id: string;
  sender_type: 'customer' | 'staff' | 'system';
  sender_name: string | null;
  body: string;
  sent_at: string;
  delivered_at: string | null;
  read_at: string | null;
}

const FN_URL = `${SUPABASE_PROJECT_URL}/functions/v1/checkin-customer`;

async function callFn(path: string, init?: RequestInit) {
  const res = await fetch(`${FN_URL}/${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || `HTTP ${res.status}`);
  }
  return res.json();
}

export function useCustomerRoom(token: string | null) {
  const [room, setRoom] = useState<CustomerRoomData | null>(null);
  const [messages, setMessages] = useState<CustomerMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const data = await callFn(`messages?token=${encodeURIComponent(token)}`);
      setRoom(data.room);
      setMessages(data.messages ?? []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!room?.id) return;
    const channel = supabase
      .channel(`checkin-customer-${room.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'checkin_messages', filter: `room_id=eq.${room.id}` },
        () => {
          load();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [room?.id, load]);

  const send = useCallback(
    async (body: string) => {
      if (!token) return;
      await callFn('messages', {
        method: 'POST',
        body: JSON.stringify({ token, body }),
      });
      await load();
    },
    [token, load],
  );

  return { room, messages, loading, error, send, reload: load };
}