// Dispara mensagem inicial (template ou texto livre no sandbox) com data-limite = hoje + 2 dias
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

function normalizePhoneE164(input: string): string | null {
  const digits = input.replace(/\D/g, '');
  if (digits.length < 10) return null;
  // Se já veio com +, preserva
  if (input.trim().startsWith('+')) return `+${digits}`;
  // Assume Brasil quando cabível
  if (digits.length === 10 || digits.length === 11) return `+55${digits}`;
  return `+${digits}`;
}

function formatBrDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
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

    const { phone, contact_name, deal_id } = await req.json();
    if (!phone) return json({ error: 'phone é obrigatório' }, 400);

    const e164 = normalizePhoneE164(String(phone));
    if (!e164) return json({ error: 'Telefone inválido' }, 400);

    // hoje + 2 dias
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 2);
    const deadlineStr = formatBrDate(deadline);

    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const fromNumber = Deno.env.get('TWILIO_WHATSAPP_FROM');
    const contentSid = Deno.env.get('TWILIO_WA_TEMPLATE_SID'); // opcional
    if (!accountSid || !authToken || !fromNumber) return json({ error: 'Twilio não configurado' }, 500);

    const fallbackBody = `Bem vindo a MCF CAPITAL! Sua reunião precisa ser agendada até ${deadlineStr}.`;
    const to = `whatsapp:${e164}`;

    const params: Record<string, string> = { To: to, From: fromNumber };
    if (contentSid) {
      params.ContentSid = contentSid;
      params.ContentVariables = JSON.stringify({ '1': deadlineStr });
    } else {
      params.Body = fallbackBody;
    }

    const twilioResp = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${btoa(`${accountSid}:${authToken}`)}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(params),
      },
    );
    const twilioJson = await twilioResp.json().catch(() => ({}));

    // upsert conversa
    const { data: existing } = await admin
      .from('wa_conversations')
      .select('id, contact_name')
      .eq('phone_e164', e164)
      .maybeSingle();

    let conversationId: string;
    if (existing) {
      conversationId = existing.id;
      await admin.from('wa_conversations').update({
        contact_name: contact_name ?? existing.contact_name,
        deal_id: deal_id ?? undefined,
        last_message_at: new Date().toISOString(),
        last_message_preview: fallbackBody.slice(0, 200),
        last_direction: 'outbound',
      }).eq('id', conversationId);
    } else {
      const { data: created, error: cErr } = await admin
        .from('wa_conversations')
        .insert({
          phone_e164: e164,
          contact_name: contact_name ?? null,
          deal_id: deal_id ?? null,
          last_message_at: new Date().toISOString(),
          last_message_preview: fallbackBody.slice(0, 200),
          last_direction: 'outbound',
          created_by: userId,
        })
        .select('id')
        .single();
      if (cErr || !created) throw cErr ?? new Error('failed to create conversation');
      conversationId = created.id;
    }

    const { data: profile } = await admin
      .from('profiles').select('full_name, email').eq('id', userId).maybeSingle();
    const senderName = profile?.full_name ?? profile?.email ?? 'Operador';

    await admin.from('wa_messages').insert({
      conversation_id: conversationId,
      direction: 'outbound',
      body: fallbackBody,
      twilio_message_sid: twilioJson?.sid ?? null,
      sent_by_user_id: userId,
      sent_by_name: senderName,
      status: twilioResp.ok ? (twilioJson?.status ?? 'sent') : 'failed',
      error_message: twilioResp.ok ? null : (twilioJson?.message ?? `HTTP ${twilioResp.status}`),
    });

    if (!twilioResp.ok) {
      return json({ error: 'Falha Twilio', details: twilioJson, conversation_id: conversationId }, twilioResp.status);
    }
    return json({ ok: true, conversation_id: conversationId, sid: twilioJson?.sid });
  } catch (err) {
    console.error('twilio-wa-start error', err);
    return json({ error: (err as Error).message }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}