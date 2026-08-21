// Envio de WhatsApp operador -> cliente via Twilio (API oficial).
// #48 conversa por telefone | #50 janela de 24h | #60 templates aprovados
// #49 StatusCallback | midia: audio gravado e arquivo, via bucket wa-media.
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function toE164(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, '');
  if (!digits) return null;
  if (String(raw).trim().startsWith('+')) return `+${digits}`;
  if (digits.length === 10 || digits.length === 11) return `+55${digits}`;
  return `+${digits}`;
}

// O Twilio usa placeholders posicionais ({{1}}), o texto salvo usa nomes ({{nome}}).
function renderTemplatePreview(
  bodyPreview: string,
  varNames: string[],
  vars: Record<string, string> | undefined,
): string {
  let out = bodyPreview;
  if (!vars) return out;
  for (const [key, value] of Object.entries(vars)) {
    out = out.replaceAll(`{{${key}}}`, value);
    if (/^\d+$/.test(key)) {
      const name = varNames[Number(key) - 1];
      if (name) out = out.replaceAll(`{{${name}}}`, value);
    } else {
      const idx = varNames.indexOf(key);
      if (idx >= 0) out = out.replaceAll(`{{${idx + 1}}}`, value);
    }
  }
  return out;
}

function rotuloMidia(mime: string | null | undefined): string {
  const m = (mime ?? '').split(';')[0];
  if (m.startsWith('image/')) return '[imagem]';
  if (m.startsWith('audio/')) return '[audio]';
  if (m.startsWith('video/')) return '[video]';
  return '[arquivo]';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;

    const supabaseUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace('Bearer ', '');
    const { data: claims, error: authErr } = await supabaseUser.auth.getClaims(token);
    if (authErr || !claims?.claims) return json({ error: 'Unauthorized' }, 401);
    const userId = claims.claims.sub as string;

    const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: hasAccess } = await admin.rpc('has_mcf_atendimento_access', { _user_id: userId });
    if (!hasAccess) return json({ error: 'Sem acesso ao MCF - Atendimento' }, 403);

    const {
      conversation_id, deal_id, phone, room_id,
      body, template_sid, template_variables,
      media_path, media_type, media_filename, media_duration_seconds,
    }: {
      conversation_id?: string; deal_id?: string; phone?: string; room_id?: string;
      body?: string; template_sid?: string; template_variables?: Record<string, string>;
      media_path?: string; media_type?: string; media_filename?: string;
      media_duration_seconds?: number;
    } = await req.json();

    const temTexto = !!body && typeof body === 'string' && !!body.trim();
    if (!template_sid && !temTexto && !media_path) {
      return json({ error: 'Informe body, media_path ou template_sid' }, 400);
    }
    if (template_sid && media_path) {
      return json({
        error: 'midia_com_template',
        message: 'Nao da para anexar arquivo em template aprovado. Envie o template primeiro e o arquivo depois, com a janela aberta.',
      }, 400);
    }

    // ---- resolve destino ----
    let e164: string | null = null;
    let convId: string | null = conversation_id ?? null;
    let dealForConv: string | null = deal_id ?? null;
    let contactName: string | null = null;
    const legacyRoomId: string | null = room_id ?? null;

    if (convId) {
      const { data: conv, error } = await admin
        .from('wa_conversations').select('phone_e164, deal_id, contact_name').eq('id', convId).single();
      if (error || !conv) return json({ error: 'Conversa nao encontrada' }, 404);
      e164 = conv.phone_e164;
      dealForConv = dealForConv ?? conv.deal_id;
      contactName = conv.contact_name;
    } else if (legacyRoomId) {
      const { data: room, error } = await admin
        .from('checkin_rooms').select('customer_name, customer_phone').eq('id', legacyRoomId).single();
      if (error || !room) return json({ error: 'Sala nao encontrada' }, 404);
      e164 = toE164(room.customer_phone);
      contactName = room.customer_name;
    } else if (phone) {
      e164 = toE164(phone);
    } else if (dealForConv) {
      const { data: contato, error } = await admin.rpc('wa_deal_contact', { _deal_id: dealForConv });
      if (error) throw error;
      const row = Array.isArray(contato) ? contato[0] : contato;
      e164 = toE164(row?.phone);
      contactName = row?.contact_name ?? null;
    }

    if (!e164) return json({ error: 'Nao foi possivel determinar o telefone do destinatario' }, 400);

    if (!convId) {
      const { data: created, error } = await admin.rpc('wa_get_or_create_conversation', {
        _phone_e164: e164, _deal_id: dealForConv, _contact_name: contactName,
      });
      if (error) throw error;
      convId = created as string;
    }

    // ---- template precisa estar aprovado ----
    let tpl: { name: string; body_preview: string; variables: string[] } | null = null;
    if (template_sid) {
      const { data } = await admin
        .from('wa_templates').select('name, body_preview, variables').eq('content_sid', template_sid).maybeSingle();
      if (!data) {
        return json({
          error: 'template_nao_aprovado',
          message: 'Esse template nao esta aprovado para WhatsApp. Escolha um da lista de aprovados.',
        }, 422);
      }
      tpl = data as { name: string; body_preview: string; variables: string[] };
    }

    // ---- janela de 24h ----
    // Texto livre E midia so passam dentro da janela. Fora dela, so template.
    if (!template_sid) {
      const { data: janelaAberta } = await admin.rpc('wa_window_open', { _conversation_id: convId });
      if (!janelaAberta) {
        return json({
          error: 'janela_fechada',
          message: 'O cliente nao escreve ha mais de 24h. Use um template aprovado para reabrir a conversa.',
        }, 409);
      }
    }

    const { data: profile } = await admin
      .from('profiles').select('full_name, email').eq('id', userId).maybeSingle();
    const senderName = profile?.full_name ?? profile?.email ?? 'Equipe MCF';

    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const fromNumber = Deno.env.get('TWILIO_WHATSAPP_FROM');
    if (!accountSid || !authToken || !fromNumber) return json({ error: 'Twilio nao configurado' }, 500);

    const params = new URLSearchParams({
      To: `whatsapp:${e164}`,
      From: fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`,
      StatusCallback: `${supabaseUrl.replace(/\/$/, '')}/functions/v1/twilio-status-webhook`,
    });

    if (template_sid) {
      params.set('ContentSid', template_sid);
      if (template_variables && Object.keys(template_variables).length > 0) {
        params.set('ContentVariables', JSON.stringify(template_variables));
      }
    } else {
      if (media_path) {
        // O Twilio precisa buscar o arquivo por HTTP. Bucket e privado, entao
        // assinamos por 1h — tempo de sobra para a entrega.
        const { data: signed, error: signErr } = await admin.storage
          .from('wa-media').createSignedUrl(media_path, 3600);
        if (signErr || !signed?.signedUrl) {
          return json({ error: 'Falha ao gerar URL do anexo', details: signErr?.message }, 500);
        }
        params.set('MediaUrl', signed.signedUrl);
      }
      if (temTexto) params.set('Body', body!);
    }

    const messageBodyForLog = tpl
      ? renderTemplatePreview(tpl.body_preview ?? `[${tpl.name}]`, tpl.variables ?? [], template_variables)
      : (temTexto ? body! : rotuloMidia(media_type));

    const twilioResp = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${btoa(`${accountSid}:${authToken}`)}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params,
      },
    );
    const twilioJson = await twilioResp.json().catch(() => ({}));

    const midiaCols = media_path
      ? {
          media_path,
          media_type: media_type ?? null,
          media_filename: media_filename ?? null,
          media_duration_seconds: media_duration_seconds ?? null,
        }
      : {};

    if (!twilioResp.ok) {
      console.error('Twilio erro', twilioResp.status, twilioJson);
      await admin.from('wa_messages').insert({
        conversation_id: convId,
        direction: 'outbound',
        body: messageBodyForLog,
        sent_by_user_id: userId,
        sent_by_name: senderName,
        status: 'failed',
        error_message: twilioJson?.message ?? `HTTP ${twilioResp.status}`,
        ...midiaCols,
      });
      return json({ error: 'Falha ao enviar via WhatsApp', details: twilioJson }, twilioResp.status);
    }

    const sid = twilioJson?.sid ?? null;

    const { data: inserted, error: msgErr } = await admin
      .from('wa_messages')
      .insert({
        conversation_id: convId,
        direction: 'outbound',
        body: messageBodyForLog,
        twilio_message_sid: sid,
        sent_by_user_id: userId,
        sent_by_name: senderName,
        status: 'sent',
        external_status: twilioJson?.status ?? null,
        ...midiaCols,
      })
      .select('id')
      .single();
    if (msgErr) throw msgErr;

    // --- escrita dupla temporaria ---
    if (legacyRoomId) {
      try {
        const nowIso = new Date().toISOString();
        await admin.from('checkin_messages').insert({
          room_id: legacyRoomId,
          sender_type: 'staff',
          sender_user_id: userId,
          sender_name: senderName,
          body: messageBodyForLog,
          delivered_at: nowIso,
        });
        await admin.from('checkin_rooms').update({
          last_message_at: nowIso,
          last_message_preview: messageBodyForLog.slice(0, 200),
        }).eq('id', legacyRoomId);
      } catch (e) {
        console.error('twilio-wa-send: escrita dupla legada falhou', e);
      }
    }

    return json({ ok: true, sid, conversation_id: convId, message_id: inserted?.id });
  } catch (err) {
    console.error('twilio-wa-send error', err);
    return json({ error: (err as Error).message }, 500);
  }
});
