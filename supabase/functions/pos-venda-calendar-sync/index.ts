import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

// ============================================================================
// pos-venda-calendar-sync
// Convite das Reuniões de Viabilidade da BU Pós-venda (tabela pos_venda_reunioes).
// Cria/cancela o evento no Google Agenda do GERENTE (profiles.email), impersonado
// pela mesma service account da google-calendar-sync, com o cliente como
// convidado e sendUpdates=all (o próprio Google envia o convite por e-mail).
// - Se a reunião tem link_reuniao (ex.: Zoom), usa esse link no evento.
// - Se não tem, pede um Google Meet ao criar o evento e grava o link em link_reuniao.
// Não altera a google-calendar-sync (Agenda R1/R2 de closers).
// ============================================================================

const TZ = 'America/Sao_Paulo';
const SCOPE = 'https://www.googleapis.com/auth/calendar.events';
const TIPO_LABEL: Record<string, string> = {
  viabilidade_1: 'Reunião de Viabilidade 1',
  viabilidade_2: 'Reunião de Viabilidade 2',
};

interface ServiceAccount {
  client_email: string;
  private_key: string;
  token_uri: string;
}

function getServiceAccount(): ServiceAccount {
  const raw = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON');
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON not configured');
  const sa = JSON.parse(raw);
  if (!sa.client_email || !sa.private_key) throw new Error('Invalid service account JSON');
  return {
    client_email: sa.client_email,
    private_key: String(sa.private_key).replace(/\\n/g, '\n'),
    token_uri: sa.token_uri || 'https://oauth2.googleapis.com/token',
  };
}

function b64url(input: Uint8Array | string): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  let str = '';
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function pemToPkcs8(pem: string): Uint8Array {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '');
  const bin = atob(body);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

const tokenCache = new Map<string, { token: string; expiresAt: number }>();

async function getImpersonatedAccessToken(subject: string): Promise<string> {
  const cached = tokenCache.get(subject);
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;

  const sa = getServiceAccount();
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claims = { iss: sa.client_email, sub: subject, scope: SCOPE, aud: sa.token_uri, iat: now, exp: now + 3600 };

  const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claims))}`;
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToPkcs8(sa.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned)),
  );
  const assertion = `${unsigned}.${b64url(signature)}`;

  const res = await fetch(sa.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`Token exchange failed [${res.status}]: ${body}`);
  const json = JSON.parse(body);
  tokenCache.set(subject, { token: json.access_token, expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000 });
  return json.access_token;
}

function reply(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

Deno if (action === 'cancel') {
      if (!r.google_event_id) return reply({ success: true, skipped: true, reason: 'sem google_event_id' });
      const res = await fetch(`${base}/${encodeURIComponent(r.google_event_id)}?sendUpdates=all`, {
        method: 'DELETE',
        headers: gHeaders,
      });
      if (!res.ok && res.status !== 404 && res.status !== 410) {
        const errBody = await res.text();
        console.error(`[pv-gcal] delete falhou [${res.status}]: ${errBody}`);
        return reply({ success: false, status: res.status, details: errBody });
      }
      await admin.from('pos_venda_reunioes').update({ google_event_id: null }).eq('id', r.id);
      return reply({ success: true, action: 'cancel' });
    }

    // ---- CREATE ----
    if (r.status !== 'agendada') return reply({ success: true, skipped: true, reason: `status ${r.status}` });
    if (new Date(r.inicio).getTime() <= Date.now()) return reply({ success: true, skipped: true, reason: 'reunião no passado' });
    if (r.google_event_id) return reply({ success: true, skipped: true, reason: 'convite já criado', event_id: r.google_event_id });

    const { data: deal } = await admin.from('crm_deals').select('name, contact_id').eq('id', r.deal_id).maybeSingle();
    let clienteNome: string | null = deal?.name ?? null;
    let clienteEmail: string | null = null;
    if (deal?.contact_id) {
      const { data: c } = await admin.from('crm_contacts').select('name, email').eq('id', deal.contact_id).maybeSingle();
      clienteEmail = c?.email?.trim() || null;
      clienteNome = c?.name || clienteNome;
    }
    if (clienteEmail && !EMAIL_RE.test(clienteEmail)) clienteEmail = null;

    const start = new Date(r.inicio);
    const end = new Date(start.getTime() + (r.duracao_min ?? 60) * 60 * 1000);
    const link = (r.link_reuniao || '').trim();
    const titulo = `${TIPO_LABEL[r.tipo] ?? 'Reunião de Viabilidade'} - ${clienteNome || 'Cliente'} | MCF`;

    const attendees: Array<{ email: string; displayName?: string }> = [];
    if (clienteEmail) attendees.push({ email: clienteEmail, displayName: clienteNome ?? undefined });
    attendees.push({ email: gerente.email, displayName: gerente.full_name ?? undefined });

    // Visível ao cliente. NUNCA incluir observacao (anotação interna do gerente).
    const descricao = [
      link ? `Link da reunião: ${link}` : null,
      `Sua ${TIPO_LABEL[r.tipo] ?? 'reunião'} com ${gerente.full_name ?? 'seu gerente de relacionamento'}, da MCF Capital.`,
    ].filter(Boolean).join('\n\n');

    const eventBody: Record<string, unknown> = {
      summary: titulo,
      description: descricao,
      start: { dateTime: start.toISOString(), timeZone: TZ },
      end: { dateTime: end.toISOString(), timeZone: TZ },
      attendees,
    };
    if (link) {
      eventBody.location = link;
    } else {
      eventBody.conferenceData = {
        createRequest: { requestId: `pv-${r.id}`, conferenceSolutionKey: { type: 'hangoutsMeet' } },
      };
    }

    let res = await fetch(`${base}?sendUpdates=all&conferenceDataVersion=1`, {
      method: 'POST',
      headers: gHeaders,
      body: JSON.stringify(eventBody),
    });
    let text = await res.text();

    // Se o Meet não puder ser criado, tenta de novo sem conferência (convite sai sem link).
    if (!res.ok && !link) {
      console.warn(`[pv-gcal] create com Meet falhou [${res.status}], tentando sem Meet: ${text}`);
      delete eventBody.conferenceData;
      res = await fetch(`${base}?sendUpdates=all`, { method: 'POST', headers: gHeaders, body: JSON.stringify(eventBody) });
      text = await res.text();
    }
    if (!res.ok) {
      console.error(`[pv-gcal] create falhou [${res.status}]: ${text}`);
      return reply({ success: false, status: res.status, details: text });
    }

    const created = JSON.parse(text);
    const meetLink: string | null =
      created.hangoutLink ??
      created.conferenceData?.entryPoints?.find((e: { entryPointType?: string; uri?: string }) => e.entryPointType === 'video')?.uri ??
      null;

    const patch: Record<string, unknown> = { google_event_id: created.id };
    if (clienteEmail) patch.convite_enviado_em = new Date().toISOString();
    if (!link && meetLink) patch.link_reuniao = meetLink;
    await admin.from('pos_venda_reunioes').update(patch).eq('id', r.id);

    return reply({
      success: true,
      action: 'create',
      event_id: created.id,
      cliente_convidado: !!clienteEmail,
      link_reuniao: link || meetLink,
    });
  } catch (error) {
    console.error('[pv-gcal] erro inesperado:', error);
    // Nunca quebrar o agendamento
    return reply({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
});
