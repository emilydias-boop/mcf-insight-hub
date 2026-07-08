// Twilio WhatsApp inbound webhook — recebe mensagens do cliente e persiste
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

function normalizePhone(raw: string): string {
  // "whatsapp:+5511999999999" → "+5511999999999"
  return raw.replace(/^whatsapp:/i, '').trim();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Twilio manda application/x-www-form-urlencoded
    const form = await req.formData();
    const from = normalizePhone(String(form.get('From') ?? ''));
    const body = String(form.get('Body') ?? '');
    const messageSid = String(form.get('MessageSid') ?? '');
    const profileName = form.get('ProfileName') ? String(form.get('ProfileName')) : null;

    if (!from || !body) {
      return new Response('missing', { status: 200, headers: corsHeaders });
    }

    // upsert conversation
    const { data: existing } = await supabase
      .from('wa_conversations')
      .select('id, unread_count, contact_name')
      .eq('phone_e164', from)
      .maybeSingle();

    let conversationId: string;
    if (existing) {
      conversationId = existing.id;
      await supabase
        .from('wa_conversations')
        .update({
          contact_name: existing.contact_name ?? profileName,
          last_message_at: new Date().toISOString(),
          last_message_preview: body.slice(0, 200),
          last_direction: 'inbound',
          unread_count: (existing.unread_count ?? 0) + 1,
        })
        .eq('id', conversationId);
    } else {
      const { data: created, error: cErr } = await supabase
        .from('wa_conversations')
        .insert({
          phone_e164: from,
          contact_name: profileName,
          last_message_at: new Date().toISOString(),
          last_message_preview: body.slice(0, 200),
          last_direction: 'inbound',
          unread_count: 1,
        })
        .select('id')
        .single();
      if (cErr || !created) throw cErr ?? new Error('failed to create conversation');
      conversationId = created.id;
    }

    await supabase.from('wa_messages').insert({
      conversation_id: conversationId,
      direction: 'inbound',
      body,
      twilio_message_sid: messageSid || null,
      status: 'received',
    });

    // Twilio espera TwiML (vazio = sem auto-resposta)
    return new Response('<?xml version="1.0" encoding="UTF-8"?><Response/>', {
      status: 200,
      headers: { 'Content-Type': 'text/xml' },
    });
  } catch (err) {
    console.error('twilio-wa-webhook error', err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});