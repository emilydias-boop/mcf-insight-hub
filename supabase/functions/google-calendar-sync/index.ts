import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

// ============================================================================
// google-calendar-sync
// Cria/atualiza/cancela o evento no Google Calendar do CLOSER (impersonação
// via service account com domain-wide delegation), para que o convidado (lead)
// exista de verdade no evento e ferramentas como o MeetGeek reconheçam.
// Mantém o meeting_link FIXO do closer como "location" (não gera Meet novo).
// ============================================================================

const TZ = 'America/Sao_Paulo';
const SCOPE = 'https://www.googleapis.com/auth/calendar.events';

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

// Cache de tokens por usuário impersonado (in-memory, ~50 min)
const tokenCache = new Map<string, { token: string; expiresAt: number }>();

async function getImpersonatedAccessToken(subject: string): Promise<string> {
  const cached = tokenCache.get(subject);
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;

  const sa = getServiceAccount();
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claims = {
    iss: sa.client_email,
    sub: subject,
    scope: SCOPE,
    aud: sa.token_uri,
    iat: now,
    exp: now + 3600,
  };

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
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`Token exchange failed [${res.status}]: ${body}`);
  const json = JSON.parse(body);
  tokenCache.set(subject, {
    token: json.access_token,
    expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
  });
  return json.access_token;
}

function partialSuccess(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    // Token administrativo (testes/backfill manual) — dispensa sessão de usuário
    const adminToken = Deno.env.get('GCAL_SYNC_ADMIN_TOKEN');
    const providedAdminToken = req.headers.get('x-admin-token');
    const isAdminCall = !!adminToken && providedAdminToken === adminToken;

    if (!isAdminCall && !authHeader?.startsWith('Bearer ')) {
      return partialSuccess({ success: false, error: 'Unauthorized' }, 401);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    if (!isAdminCall) {
      const authClient = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!,
      );
      const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(
        authHeader!.replace('Bearer ', ''),
      );
      if (claimsError || !claimsData?.claims) {
        return partialSuccess({ success: false, error: 'Unauthorized' }, 401);
      }
    }

    const body = await req.json().catch(() => ({}));
    const action: string = body?.action;
    const meetingSlotId: string = body?.meeting_slot_id ?? body?.meetingSlotId;

    if (!['create', 'update', 'cancel'].includes(action) || !meetingSlotId) {
      return partialSuccess(
        { success: false, error: 'action (create|update|cancel) e meeting_slot_id são obrigatórios' },
        400,
      );
    }

    // ---- Dados da reunião ----
    const { data: slot, error: slotError } = await supabase
      .from('meeting_slots')
      .select(
        'id, closer_id, scheduled_at, duration_minutes, meeting_link, meeting_type, notes, google_event_id, contact_id, deal_id',
      )
      .eq('id', meetingSlotId)
      .maybeSingle();

    if (slotError || !slot) {
      console.error('[gcal-sync] slot não encontrado', slotError);
      return partialSuccess({ success: false, error: 'meeting_slot not found' });
    }

    const { data: closer } = await supabase
      .from('closers')
      .select('id, name, email')
      .eq('id', slot.closer_id)
      .maybeSingle();

    if (!closer?.email) {
      console.warn('[gcal-sync] closer sem e-mail, ignorando', slot.closer_id);
      return partialSuccess({ success: false, skipped: true, error: 'closer sem e-mail' });
    }

    let accessToken: string;
    try {
      accessToken = await getImpersonatedAccessToken(closer.email);
    } catch (authErr) {
      console.error('[gcal-sync] falha ao obter token impersonado:', authErr);
      return partialSuccess({
        success: false,
        error: authErr instanceof Error ? authErr.message : 'auth error',
      });
    }

    const base = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
    const gHeaders = {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    };

    // ---- CANCEL ----
    if (action === 'cancel') {
      if (!slot.google_event_id) {
        return partialSuccess({ success: true, skipped: true, reason: 'sem google_event_id' });
      }
      const res = await fetch(
        `${base}/${encodeURIComponent(slot.google_event_id)}?sendUpdates=all`,
        { method: 'DELETE', headers: gHeaders },
      );
      if (!res.ok && res.status !== 404 && res.status !== 410) {
        const errBody = await res.text();
        console.error(`[gcal-sync] delete falhou [${res.status}]: ${errBody}`);
        return partialSuccess({ success: false, status: res.status, details: errBody });
      }
      await supabase
        .from('meeting_slots')
        .update({ google_event_id: null })
        .eq('id', slot.id);
      return partialSuccess({ success: true, action: 'cancel' });
    }

    // ---- Lead (nome + e-mail) ----
    let leadName: string | null = null;
    let leadEmail: string | null = null;

    if (slot.contact_id) {
      const { data: contact } = await supabase
        .from('crm_contacts')
        .select('name, email')
        .eq('id', slot.contact_id)
        .maybeSingle();
      leadName = contact?.name ?? null;
      leadEmail = contact?.email ?? null;
    }

    if (!leadEmail || !leadName) {
      const { data: attendee } = await supabase
        .from('meeting_slot_attendees')
        .select('attendee_name, contact_id, deal_id')
        .eq('meeting_slot_id', slot.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      leadName = leadName || attendee?.attendee_name || null;

      const contactId = attendee?.contact_id ?? null;
      if (!leadEmail && contactId) {
        const { data: c } = await supabase
          .from('crm_contacts')
          .select('name, email')
          .eq('id', contactId)
          .maybeSingle();
        leadEmail = c?.email ?? leadEmail;
        leadName = leadName || c?.name || null;
      }

      const dealId = slot.deal_id ?? attendee?.deal_id ?? null;
      if ((!leadEmail || !leadName) && dealId) {
        const { data: deal } = await supabase
          .from('crm_deals')
          .select('name, email, contact_id')
          .eq('id', dealId)
          .maybeSingle();
        leadEmail = leadEmail || (deal as any)?.email || null;
        leadName = leadName || (deal as any)?.name || null;
        if (!leadEmail && deal?.contact_id) {
          const { data: dc } = await supabase
            .from('crm_contacts')
            .select('name, email')
            .eq('id', deal.contact_id)
            .maybeSingle();
          leadEmail = dc?.email ?? null;
          leadName = leadName || dc?.name || null;
        }
      }
    }

    // ---- Link fixo do closer ----
    let meetingLink = slot.meeting_link || '';
    if (!meetingLink) {
      const scheduledUtc = new Date(slot.scheduled_at);
      const br = new Date(scheduledUtc.getTime() - 3 * 60 * 60 * 1000);
      const dow = br.getUTCDay();
      const timeStr = `${String(br.getUTCHours()).padStart(2, '0')}:${String(br.getUTCMinutes()).padStart(2, '0')}:00`;
      const { data: link } = await supabase
        .from('closer_meeting_links')
        .select('google_meet_link')
        .eq('closer_id', slot.closer_id)
        .eq('day_of_week', dow)
        .eq('start_time', timeStr)
        .maybeSingle();
      meetingLink = link?.google_meet_link || '';
    }

    const duration = slot.duration_minutes ?? 30;
    const start = new Date(slot.scheduled_at);
    const end = new Date(start.getTime() + duration * 60 * 1000);

    const typeLabel = (slot.meeting_type || 'r1').toUpperCase();
    const attendees: Array<{ email: string; displayName?: string }> = [];
    if (leadEmail) attendees.push({ email: leadEmail, displayName: leadName ?? undefined });
    attendees.push({ email: closer.email, displayName: closer.name });

    const descriptionParts = [
      meetingLink ? `Link da reunião: ${meetingLink}` : null,
      slot.notes ? `Observações:\n${slot.notes}` : null,
      'Agendado via CRM MCF',
    ].filter(Boolean);

    const eventBody = {
      summary: `Reunião ${typeLabel} - ${leadName || 'Lead'}`,
      description: descriptionParts.join('\n\n'),
      location: meetingLink || undefined,
      start: { dateTime: start.toISOString(), timeZone: TZ },
      end: { dateTime: end.toISOString(), timeZone: TZ },
      attendees,
    };

    // ---- UPDATE ----
    if (action === 'update' && slot.google_event_id) {
      const res = await fetch(
        `${base}/${encodeURIComponent(slot.google_event_id)}?sendUpdates=all`,
        { method: 'PATCH', headers: gHeaders, body: JSON.stringify(eventBody) },
      );
      const text = await res.text();
      if (!res.ok) {
        console.error(`[gcal-sync] patch falhou [${res.status}]: ${text}`);
        // 404/410: evento não existe mais — recria abaixo
        if (res.status !== 404 && res.status !== 410) {
          return partialSuccess({ success: false, status: res.status, details: text });
        }
      } else {
        return partialSuccess({ success: true, action: 'update', event_id: slot.google_event_id });
      }
    }

    // ---- CREATE (também usado como fallback do update) ----
    const res = await fetch(`${base}?sendUpdates=all`, {
      method: 'POST',
      headers: gHeaders,
      body: JSON.stringify(eventBody),
    });
    const text = await res.text();
    if (!res.ok) {
      console.error(`[gcal-sync] create falhou [${res.status}]: ${text}`);
      return partialSuccess({ success: false, status: res.status, details: text });
    }

    const created = JSON.parse(text);
    await supabase
      .from('meeting_slots')
      .update({ google_event_id: created.id })
      .eq('id', slot.id);

    return partialSuccess({
      success: true,
      action: 'create',
      event_id: created.id,
      lead_invited: !!leadEmail,
    });
  } catch (error) {
    console.error('[gcal-sync] erro inesperado:', error);
    // Nunca quebrar o fluxo de agendamento do CRM
    return partialSuccess({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});