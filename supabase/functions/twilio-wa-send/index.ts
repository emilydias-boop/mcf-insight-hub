// Envia mensagem WhatsApp de operador → cliente via Twilio
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ error: 'Unauthorized' }, 401);
    }
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

    // Checa acesso
    const { data: hasAccess } = await admin.rpc('has_mcf_atendimento_access', { _user_id: userId });
    if (!hasAccess) return json({ error: 'Sem acesso ao MCF - Atendimento' }, 403);

    const { conversation_id, body } = await req.json();
    if (!conversation_id || !body || typeof body !== 'string') {
      return json({ error: 'conversation_id e body são obrigatórios' }, 400);
    }

    const { data: conv, error: convErr } = await admin
      .from('wa_conversations')
      .select('id, phone_e164')
      .eq('id', conversation_id)
      .single();
    if (convErr || !conv) return json({ error: 'Conversa não encontrada' }, 404);

    // Nome do remetente
    const { data: profile } = await admin
      .from('profiles')
      .select('nome, email')
      .eq('id', userId)
      .maybeSingle();
    const senderName = profile?.nome ?? profile?.email ?? 'Operador';

    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const fromNumber = Deno.env.get('TWILIO_WHATSAPP_FROM');
    if (!accountSid || !authToken || !fromNumber) {
      return json({ error: 'Twilio não configurado' }, 500);
    }

    const to = conv.phone_e164.startsWith('whatsapp:') ? conv.phone_e164 : `whatsapp:${conv.phone_e164}`;

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const twilioResp = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`${accountSid}:${authToken}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: to, From: fromNumber, Body: body }),
    });

    const twilioJson = await twilioResp.json().catch(() => ({}));
    if (!twilioResp.ok) {
      console.error('Twilio erro', twilioResp.status, twilioJson);
      await admin.from('wa_messages').insert({
        conversation_id,
        direction: 'outbound',
        body,
        sent_by_user_id: userId,
        sent_by_name: senderName,
        status: 'failed',
        error_message: twilioJson?.message ?? `HTTP ${twilioResp.status}`,
      });
      return json({ error: 'Falha ao enviar', details: twilioJson }, twilioResp.status);
    }

    await admin.from('wa_messages').insert({
      conversation_id,
      direction: 'outbound',
      body,
      twilio_message_sid: twilioJson?.sid ?? null,
      sent_by_user_id: userId,
      sent_by_name: senderName,
      status: twilioJson?.status ?? 'sent',
    });

    await admin.from('wa_conversations').update({
      last_message_at: new Date().toISOString(),
      last_message_preview: body.slice(0, 200),
      last_direction: 'outbound',
      unread_count: 0,
    }).eq('id', conversation_id);

    return json({ ok: true, sid: twilioJson?.sid });
  } catch (err) {
    console.error('twilio-wa-send error', err);
    return json({ error: (err as Error).message }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}