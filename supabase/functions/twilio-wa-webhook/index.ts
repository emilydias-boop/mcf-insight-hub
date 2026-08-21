// Twilio WhatsApp inbound webhook — grava no modelo novo (wa_conversations / wa_messages)
// e mantém a escrita legada em checkin_messages enquanto a tela antiga existir.
import { createClient } from 'npm:@supabase/supabase-js@2';

// CORS inline: o subpath `npm:@supabase/supabase-js@2/cors` não existe no pacote.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TWIML_OK = '<?xml version="1.0" encoding="UTF-8"?><Response/>';
const twiml = () =>
  new Response(TWIML_OK, { status: 200, headers: { 'Content-Type': 'text/xml' } });

function stripWa(raw: string): string {
  return raw.replace(/^whatsapp:/i, '').trim();
}

function digitsOnly(v: string | null | undefined): string {
  return (v ?? '').replace(/\D/g, '');
}

/** Extensão deduzida do content-type da Twilio (usada só para nomear o arquivo). */
function extFromType(type: string): string {
  const t = (type || '').split(';')[0].trim().toLowerCase();
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'audio/ogg': 'ogg',
    'audio/mpeg': 'mp3',
    'audio/mp4': 'm4a',
    'audio/amr': 'amr',
    'video/mp4': 'mp4',
    'video/3gpp': '3gp',
    'application/pdf': 'pdf',
    'text/plain': 'txt',
    'text/csv': 'csv',
  };
  return map[t] ?? (t.split('/')[1] || 'bin');
}

/** Rótulo usado como `body` quando a mídia vem sem legenda. */
function placeholderFromType(type: string): string {
  const t = (type || '').toLowerCase();
  if (t.startsWith('image/')) return '[imagem]';
  if (t.startsWith('audio/')) return '[audio]';
  if (t.startsWith('video/')) return '[video]';
  return '[arquivo]';
}

/** Expressões que, sozinhas, são pedido inequívoco de descadastro. */
const EXPRESSOES_SAIDA = new Set([
  'sair',
  'parar',
  'pare',
  'stop',
  'descadastrar',
  'remover',
  'nao quero mais receber',
  'nao quero receber',
  'me tira da lista',
  'cancelar inscricao',
]);

/**
 * Detecção conservadora de pedido de saída: a mensagem tem de ser essencialmente
 * uma das expressões acima (sem acento, sem pontuação, sem caixa alta). Uma frase
 * longa com "parar" no meio — "não vou parar de tentar" — NÃO conta.
 */
function ehPedidoDeSaida(texto: string): boolean {
  const normalizado = texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalizado || normalizado.length > 30) return false;
  return EXPRESSOES_SAIDA.has(normalizado);
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
    const body = String(form.get('Body') ?? '').trim();
    const messageSid = String(form.get('MessageSid') ?? '') || null;
    const profileName = form.get('ProfileName') ? String(form.get('ProfileName')) : null;
    const numMedia = Number(form.get('NumMedia') ?? 0) || 0;

    if (!fromRaw) {
      console.warn('twilio-wa-webhook: form sem From');
      return twiml();
    }

    // 1) Normaliza o telefone pela mesma RPC que o resto do sistema usa.
    const { data: phoneE164, error: phoneErr } = await admin.rpc('wa_e164_br', {
      _raw: stripWa(fromRaw),
    });
    if (phoneErr) console.error('twilio-wa-webhook: wa_e164_br falhou', phoneErr);
    if (!phoneE164) {
      console.warn('twilio-wa-webhook: telefone inválido', fromRaw);
      return twiml();
    }
    const phone = String(phoneE164);

    // 2) Vincula ao negócio: sem deal_id a conversa nasce sem dono e o SDR não a vê.
    //    wa_match_lead_by_phone retorna TABLE(contact_id, deal_id, contatos_encontrados, negocios_encontrados).
    let dealId: string | null = null;
    let crmName: string | null = null;
    try {
      const { data: match, error: matchErr } = await admin.rpc('wa_match_lead_by_phone', {
        p_phone: phone,
      });
      if (matchErr) throw matchErr;
      const row = Array.isArray(match) ? match[0] : match;
      dealId = row?.deal_id ?? null;
      if (row?.contact_id) {
        const { data: contato } = await admin
          .from('crm_contacts')
          .select('name')
          .eq('id', row.contact_id)
          .maybeSingle();
        crmName = contato?.name ?? null;
      }
    } catch (e) {
      // Sem match seguimos com deal_id nulo — perder a mensagem seria pior.
      console.error('twilio-wa-webhook: wa_match_lead_by_phone falhou', e);
    }

    const contactName = crmName ?? profileName ?? null;

    // 3) Conversa (cria se não existir).
    const { data: conversationId, error: convErr } = await admin.rpc(
      'wa_get_or_create_conversation',
      { _phone_e164: phone, _deal_id: dealId, _contact_name: contactName },
    );
    if (convErr || !conversationId) {
      console.error('twilio-wa-webhook: wa_get_or_create_conversation falhou', convErr);
      return twiml();
    }
    const convId = String(conversationId);

    // 4) Mídia: as URLs da Twilio exigem Basic auth; falha aqui não pode perder a mensagem.
    let mediaPath: string | null = null;
    let mediaType: string | null = null;
    let mediaFilename: string | null = null;
    let mediaSize: number | null = null;

    if (numMedia > 0) {
      const sid = Deno.env.get('TWILIO_ACCOUNT_SID');
      const token = Deno.env.get('TWILIO_AUTH_TOKEN');
      const auth = sid && token ? 'Basic ' + btoa(`${sid}:${token}`) : null;
      for (let i = 0; i < numMedia; i++) {
        const url = form.get(`MediaUrl${i}`) ? String(form.get(`MediaUrl${i}`)) : null;
        const ctype = form.get(`MediaContentType${i}`)
          ? String(form.get(`MediaContentType${i}`))
          : 'application/octet-stream';
        if (!url || !auth) continue;
        try {
          const res = await fetch(url, { headers: { Authorization: auth } });
          if (!res.ok) throw new Error(`download ${res.status}: ${await res.text()}`);
          const bytes = new Uint8Array(await res.arrayBuffer());
          const filename = `${Date.now()}-inbound-${i}.${extFromType(ctype)}`;
          const path = `${convId}/${filename}`;
          const { error: upErr } = await admin.storage
            .from('wa-media')
            .upload(path, bytes, { contentType: ctype, upsert: false });
          if (upErr) throw upErr;
          // Guardamos a primeira mídia na linha da mensagem (modelo atual: 1 mídia por mensagem).
          if (!mediaPath) {
            mediaPath = path;
            mediaType = ctype;
            mediaFilename = filename;
            mediaSize = bytes.byteLength;
          }
        } catch (e) {
          console.error('twilio-wa-webhook: falha na mídia', i, e);
        }
      }
    }

    const firstType = numMedia > 0
      ? String(form.get('MediaContentType0') ?? 'application/octet-stream')
      : '';
    const finalBody = body || (numMedia > 0 ? placeholderFromType(firstType) : '');

    // 5) Insere a mensagem. O trigger wa_touch_conversation_from_message cuida de
    //    last_inbound_at, unread_count, preview e status da conversa.
    const { error: msgErr } = await admin.from('wa_messages').insert({
      conversation_id: convId,
      direction: 'inbound',
      status: 'received',
      body: finalBody,
      twilio_message_sid: messageSid,
      sent_by_user_id: null,
      sent_by_name: contactName,
      ...(mediaPath
        ? {
            media_path: mediaPath,
            media_type: mediaType,
            media_filename: mediaFilename,
            media_size_bytes: mediaSize,
          }
        : {}),
    });
    if (msgErr) console.error('twilio-wa-webhook: insert wa_messages falhou', msgErr);

    // 6) Escrita legada (tela antiga) — isolada para não derrubar o fluxo novo.
    try {
      const suffix = digitsOnly(phone).slice(-10);
      const { data: rooms } = await admin
        .from('checkin_rooms')
        .select('id, customer_phone, customer_name, unread_for_team, created_at')
        .not('customer_phone', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1000);
      const room = (rooms ?? []).find((r) => digitsOnly(r.customer_phone).endsWith(suffix));
      if (room) {
        const nowIso = new Date().toISOString();
        await admin.from('checkin_messages').insert({
          room_id: room.id,
          sender_type: 'customer',
          sender_name: profileName ?? room.customer_name ?? null,
          body: finalBody,
          delivered_at: nowIso,
        });
        await admin
          .from('checkin_rooms')
          .update({
            last_message_at: nowIso,
            last_message_preview: finalBody.slice(0, 200),
            unread_for_team: (room.unread_for_team ?? 0) + 1,
          })
          .eq('id', room.id);
      }
    } catch (e) {
      console.error('twilio-wa-webhook: escrita legada falhou', e);
    }

    return twiml();
  } catch (err) {
    // Sempre 200: erro 5xx faz a Twilio reentregar em ciclo.
    console.error('twilio-wa-webhook error', err);
    return twiml();
  }
});
