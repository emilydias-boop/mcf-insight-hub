import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase, SUPABASE_PROJECT_URL, SUPABASE_PUBLISHABLE_KEY } from '@/integrations/supabase/client';

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
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
      ...(init?.headers ?? {}),
    },
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
  const didInitialLoad = useRef(false);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!token) return;
    try {
      if (!opts?.silent && !didInitialLoad.current) setLoading(true);
      const data = await callFn(`messages?token=${encodeURIComponent(token)}`);
      setRoom(data.room);
      setMessages((prev) => {
        const incoming: CustomerMessage[] = data.messages ?? [];
        // Merge: mantém otimistas ainda não confirmadas e evita "piscar" quando nada mudou
        const map = new Map<string, CustomerMessage>();
        for (const m of prev) map.set(m.id, m);
        for (const m of incoming) map.set(m.id, m);
        return Array.from(map.values()).sort(
          (a, b) => new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime(),
        );
      });
    } catch (e: any) {
      setError(e.message);
    } finally {
      didInitialLoad.current = true;
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  // Realtime (silencioso — sem piscar tela)
  useEffect(() => {
    if (!room?.id) return;
    const channel = supabase
      .channel(`checkin-customer-${room.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'checkin_messages', filter: `room_id=eq.${room.id}` },
        () => {
          load({ silent: true });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [room?.id, load]);

  // Fallback: polling leve caso o realtime não esteja acessível ao anon
  useEffect(() => {
    if (!room?.id) return;
    const iv = setInterval(() => load({ silent: true }), 5000);
    return () => clearInterval(iv);
  }, [room?.id, load]);

  const send = useCallback(
    async (body: string) => {
      if (!token) return;
      const trimmed = body.trim();
      if (!trimmed) return;
      // Otimista: já mostra a mensagem enquanto o servidor confirma
      const tempId = `tmp-${Date.now()}`;
      const optimistic: CustomerMessage = {
        id: tempId,
        sender_type: 'customer',
        sender_name: room?.customer_name ?? null,
        body: trimmed,
        sent_at: new Date().toISOString(),
        delivered_at: null,
        read_at: null,
      };
      setMessages((prev) => [...prev, optimistic]);
      try {
        const res = await callFn('messages', {
          method: 'POST',
          body: JSON.stringify({ token, body: trimmed }),
        });
        if (res?.message) {
          setMessages((prev) => prev.map((m) => (m.id === tempId ? res.message : m)));
        } else {
          await load({ silent: true });
        }
      } catch (e) {
        // remove otimista em caso de falha
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        throw e;
      }
    },
    [token, load, room?.customer_name],
  );

  return { room, messages, loading, error, send, reload: load };
}