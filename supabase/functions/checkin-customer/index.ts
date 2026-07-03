import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function getRoomByToken(token: string) {
  const { data, error } = await supabase
    .from('checkin_rooms')
    .select('id, customer_name, customer_email, customer_phone, product_name, purchase_date, status, last_message_at')
    .eq('access_token', token)
    .maybeSingle();
  if (error) throw error;
  return data;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const parts = url.pathname.split('/').filter(Boolean);
    const action = parts[parts.length - 1];

    if (req.method === 'GET' && action === 'room') {
      const token = url.searchParams.get('token');
      if (!token) return json(400, { error: 'token required' });
      const room = await getRoomByToken(token);
      if (!room) return json(404, { error: 'not found' });
      return json(200, { room });
    }

    if (req.method === 'GET' && action === 'messages') {
      const token = url.searchParams.get('token');
      if (!token) return json(400, { error: 'token required' });
      const room = await getRoomByToken(token);
      if (!room) return json(404, { error: 'not found' });

      const { data: messages, error } = await supabase
        .from('checkin_messages')
        .select('id, sender_type, sender_name, body, sent_at, delivered_at, read_at')
        .eq('room_id', room.id)
        .order('sent_at', { ascending: true });
      if (error) throw error;

      // marca como entregues + lidas (staff mensagens) para o cliente
      const nowIso = new Date().toISOString();
      await supabase
        .from('checkin_messages')
        .update({ delivered_at: nowIso, read_at: nowIso })
        .eq('room_id', room.id)
        .eq('sender_type', 'staff')
        .is('read_at', null);
      await supabase
        .from('checkin_rooms')
        .update({ unread_for_customer: 0 })
        .eq('id', room.id);

      return json(200, { room, messages });
    }

    if (req.method === 'POST' && action === 'messages') {
      const body = await req.json().catch(() => null) as { token?: string; body?: string } | null;
      if (!body?.token || !body?.body || !body.body.trim()) {
        return json(400, { error: 'token and body required' });
      }
      const room = await getRoomByToken(body.token);
      if (!room) return json(404, { error: 'not found' });

      const { data: msg, error } = await supabase
        .from('checkin_messages')
        .insert({
          room_id: room.id,
          sender_type: 'customer',
          sender_name: room.customer_name,
          body: body.body.trim(),
          delivered_at: new Date().toISOString(),
        })
        .select()
        .single();
      if (error) throw error;
      return json(200, { message: msg });
    }

    return json(404, { error: 'unknown action' });
  } catch (err) {
    console.error('[checkin-customer] error', err);
    return json(500, { error: (err as Error).message });
  }
});