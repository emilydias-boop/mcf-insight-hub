// Public webhook Twilio calls with delivery status updates (StatusCallback).
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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