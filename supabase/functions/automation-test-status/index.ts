// Fetch live Twilio message status and reflect it on automation_logs.
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userId = claimsData.claims.sub as string;
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: isAdmin } = await admin.rpc('has_role', { _user_id: userId, _role: 'admin' });
    const { data: isManager } = await admin.rpc('has_role', { _user_id: userId, _role: 'manager' });
    if (!isAdmin && !isManager) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const url = new URL(req.url);
    let sid = url.searchParams.get('sid');
    if (!sid && (req.method === 'POST')) {
      try { const b = await req.json(); sid = b?.sid ?? null; } catch (_) {}
    }
    if (!sid) {
      return new Response(JSON.stringify({ error: 'sid is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    if (!accountSid || !authToken) {
      return new Response(JSON.stringify({ error: 'Twilio creds missing' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const auth = btoa(`${accountSid}:${authToken}`);
    const twResp = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages/${sid}.json`, {
      headers: { Authorization: `Basic ${auth}` },
    });
    const tw = await twResp.json();
    if (!twResp.ok) {
      return new Response(JSON.stringify({ success: false, error: tw.message || 'Twilio error', details: tw }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Mirror status into automation_logs
    const status = tw.status as string;
    const mapped = ['delivered','read'].includes(status) ? status
      : ['failed','undelivered'].includes(status) ? 'failed'
      : ['sent','queued','sending','accepted','scheduled'].includes(status) ? 'sent'
      : status;
    try {
      await admin.from('automation_logs').update({
        status: mapped,
        external_status: status,
        error_message: tw.error_message ?? null,
        delivered_at: status === 'delivered' ? new Date().toISOString() : undefined,
      }).eq('external_id', sid);
    } catch (_) {}

    return new Response(JSON.stringify({
      success: true,
      sid,
      status,
      errorCode: tw.error_code,
      errorMessage: tw.error_message,
      to: tw.to,
      from: tw.from,
      dateSent: tw.date_sent,
      dateUpdated: tw.date_updated,
      price: tw.price,
      raw: tw,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});