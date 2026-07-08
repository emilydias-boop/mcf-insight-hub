// Twilio WhatsApp inbound webhook — roteia mensagem do cliente para a checkin_room dele
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

function stripWa(raw: string): string {
  return raw.replace(/^whatsapp:/i, '').trim();
}

function digitsOnly(v: string | null | undefined): string {
  return (v ?? '').replace(/\D/g, '');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const form = await req.formData();
    const fromRaw = String(form.get('From') ?? '');
    const body = String(form.get('Body') ?? '');
    const messageSid = String(form.get('MessageSid') ?? '');
    const profileName = form.get('ProfileName') ? String(form.get('ProfileName')) : null;

    if (!fromRaw || !body) {
      return new Response('<?xml version="1.0" encoding="UTF-8"?><Response/>', {
        status: 200, headers: { 'Content-Type': 'text/xml' },
      });
    }

    const fromDigits = digitsOnly(stripWa(fromRaw));
    // usa os últimos 10 dígitos (DDD + número) como chave de match
    const suffix = fromDigits.slice(-10);

    // busca a sala mais recente cujo telefone bate no sufixo
    const { data: rooms } = await admin
      .from('checkin_rooms')
      .select('id, customer_phone, customer_name, unread_for_team, created_at')
      .not('customer_phone', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1000);

    const room = (rooms ?? []).find((r) => digitsOnly(r.customer_phone).endsWith(suffix));

    if (!room) {
      console.warn('twilio-wa-webhook: nenhuma sala para', fromRaw);
      return new Response('<?xml version="1.0" encoding="UTF-8"?><Response/>', {
        status: 200, headers: { 'Content-Type': 'text/xml' },
      });
    }

    const nowIso = new Date().toISOString();
    await admin.from('checkin_messages').insert({
      room_id: room.id,
      sender_type: 'customer',
      sender_name: profileName ?? room.customer_name ?? null,
      body,
      delivered_at: nowIso,
    });

    await admin
      .from('checkin_rooms')
      .update({
        last_message_at: nowIso,
        last_message_preview: body.slice(0, 200),
        unread_for_team: (room.unread_for_team ?? 0) + 1,
      })
      .eq('id', room.id);

    return new Response('<?xml version="1.0" encoding="UTF-8"?><Response/>', {
      status: 200, headers: { 'Content-Type': 'text/xml' },
    });
  } catch (err) {
    console.error('twilio-wa-webhook error', err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});