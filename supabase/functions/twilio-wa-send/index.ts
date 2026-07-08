// Envia mensagem WhatsApp de operador → cliente via Twilio, atrelada a uma checkin_room
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

function toE164(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, '');
  if (!digits) return null;
  if (String(raw).trim().startsWith('+')) return `+${digits}`;
  if (digits.length === 10 || digits.length === 11) return `+55${digits}`;
  if (digits.length === 12 || digits.length === 13) return `+${digits}`;
  return `+${digits}`;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace('Bearer ', '');
    const { data: claims, error: authErr } = await supabaseUser.auth.getClaims(token);
    if (authErr || !claims?.claims) return json({ error: 'Unauthorized' }, 401);
    const userId = claims.claims.sub as string;

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: hasAccess } = await admin.rpc('has_mcf_atendimento_access', { _user_id: userId });
    if (!hasAccess) return json({ error: 'Sem acesso ao MCF - Atendimento' }, 403);

    const { room_id, body } = await req.json();
    if (!room_id || !body || typeof body !== 'string') {
      return json({ error: 'room_id e body são obrigatórios' }, 400);
    }

    const { data: room, error: roomErr } = await admin
      .from('checkin_rooms')
      .select('id, customer_name, customer_phone')
      .eq('id', room_id)
      .single();
    if (roomErr || !room) return json({ error: 'Sala não encontrada' }, 404);

    const e164 = toE164(room.customer_phone);
    if (!e164) return json({ error: 'Cliente sem telefone válido nesta sala' }, 400);

    const { data: profile } = await admin
      .from('profiles').select('full_name, email').eq('id', userId).maybeSingle();
    const senderName = profile?.full_name ?? profile?.email ?? 'Equipe MCF';

    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const fromNumber = Deno.env.get('TWILIO_WHATSAPP_FROM');
    if (!accountSid || !authToken || !fromNumber) {
      return json({ error: 'Twilio não configurado' }, 500);
    }

    const to = `whatsapp:${e164}`;
    const twilioResp = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${btoa(`${accountSid}:${authToken}`)}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ To: to, From: fromNumber, Body: body }),
      },
    );
    const twilioJson = await twilioResp.json().catch(() => ({}));

    const nowIso = new Date().toISOString();
    if (!twilioResp.ok) {
      console.error('Twilio erro', twilioResp.status, twilioJson);
      await admin.from('checkin_messages').insert({
        room_id,
        sender_type: 'staff',
        sender_user_id: userId,
        sender_name: senderName,
        body: `${body}\n\n⚠️ Falha ao enviar via WhatsApp: ${twilioJson?.message ?? `HTTP ${twilioResp.status}`}`,
        delivered_at: nowIso,
      });
      return json({ error: 'Falha ao enviar via WhatsApp', details: twilioJson }, twilioResp.status);
    }

    const { data: inserted, error: msgErr } = await admin
      .from('checkin_messages')
      .insert({
        room_id,
        sender_type: 'staff',
        sender_user_id: userId,
        sender_name: senderName,
        body,
        delivered_at: nowIso,
      })
      .select('id')
      .single();
    if (msgErr) throw msgErr;

    await admin
      .from('checkin_rooms')
      .update({
        last_message_at: nowIso,
        last_message_preview: body.slice(0, 200),
      })
      .eq('id', room_id);

    return json({ ok: true, sid: twilioJson?.sid, message_id: inserted?.id });
  } catch (err) {
    console.error('twilio-wa-send error', err);
    return json({ error: (err as Error).message }, 500);
  }
});