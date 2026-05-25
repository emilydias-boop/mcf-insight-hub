// Public webhook Twilio calls with delivery status updates (StatusCallback).
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function validateTwilioSignature(req: Request, url: string, params: Record<string, string>): Promise<boolean> {
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
  if (!authToken) return false;
  const signature = req.headers.get('x-twilio-signature') || req.headers.get('X-Twilio-Signature');
  if (!signature) return false;
  const sortedKeys = Object.keys(params).sort();
  let data = url;
  for (const k of sortedKeys) data += k + params[k];
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(authToken), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  const expected = btoa(String.fromCharCode(...new Uint8Array(sig)));
  return expected === signature;
}

const candidatePublicUrls = (req: Request): string[] => {
  const u = new URL(req.url);
  const urls = new Set<string>();
  const base = Deno.env.get('SUPABASE_URL');
  const path = u.pathname;
  const withFnPrefix = path.startsWith('/functions/v1/') ? path : `/functions/v1${path}`;
  const variants = new Set<string>([path, withFnPrefix]);
  const cleanBase = base ? base.replace(/\/$/, '') : null;
  const proto = req.headers.get('x-forwarded-proto') || 'https';
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  for (const p of variants) {
    if (cleanBase) urls.add(`${cleanBase}${p}${u.search}`);
    if (host) urls.add(`${proto}://${host}${p}${u.search}`);
    urls.add(`${u.protocol}//${u.host}${p}${u.search}`);
  }
  return Array.from(urls);
};

const validateWithAnyUrl = async (req: Request, params: Record<string, string>): Promise<{ ok: boolean; tried: string[] }> => {
  const tried = candidatePublicUrls(req);
  for (const u of tried) {
    if (await validateTwilioSignature(req, u, params)) return { ok: true, tried };
  }
  return { ok: false, tried };
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const ct = req.headers.get('content-type') || '';
    let params: Record<string, string> = {};
    if (ct.includes('application/x-www-form-urlencoded')) {
      const text = await req.text();
      const sp = new URLSearchParams(text);
      sp.forEach((v, k) => { params[k] = v; });
    } else if (ct.includes('application/json')) {
      params = await req.json();
    } else {
      const text = await req.text();
      try { params = Object.fromEntries(new URLSearchParams(text)); } catch (_) {}
    }

    const { ok: valid, tried } = await validateWithAnyUrl(req, params);
    if (!valid) {
      console.error('[twilio-status-webhook] Invalid Twilio signature. Tried URLs:', tried);
      return new Response('Forbidden', { status: 403, headers: corsHeaders });
    }

    const sid = params.MessageSid || params.SmsSid;
    const status = params.MessageStatus || params.SmsStatus;
    const errorCode = params.ErrorCode || null;
    const errorMessage = params.ErrorMessage || null;

    console.log('[twilio-status-webhook]', { sid, status, errorCode, errorMessage });

    if (!sid || !status) {
      return new Response('missing sid/status', { status: 200, headers: corsHeaders });
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const mapped = ['delivered','read'].includes(status) ? status
      : ['failed','undelivered'].includes(status) ? 'failed'
      : ['sent','queued','sending','accepted','scheduled'].includes(status) ? 'sent'
      : status;

    const update: Record<string, any> = {
      status: mapped,
      external_status: status,
    };
    if (errorCode || errorMessage) update.error_message = `[${errorCode}] ${errorMessage}`;
    if (status === 'delivered') update.delivered_at = new Date().toISOString();
    if (status === 'read') update.read_at = new Date().toISOString();

    await admin.from('automation_logs').update(update).eq('external_id', sid);

    return new Response('ok', { status: 200, headers: corsHeaders });
  } catch (e: any) {
    console.error('[twilio-status-webhook] error', e);
    return new Response('error', { status: 200, headers: corsHeaders });
  }
});