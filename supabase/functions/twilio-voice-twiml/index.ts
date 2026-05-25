import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

const escapeXml = (value: string | null | undefined) =>
  (value || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const webhookBaseUrl = 'https://rehcfgqvigfcekiipqkc.supabase.co/functions/v1/twilio-voice-webhook';

const buildWebhookUrl = (params: Record<string, string | undefined>) => {
  const url = new URL(webhookBaseUrl);
  Object.entries(params).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
  });
  return url.toString();
};

const normalizeE164 = (phoneNumber: string) => {
  const hasCountryCode = phoneNumber.trim().startsWith('+');
  const digits = phoneNumber.replace(/\D/g, '');
  return hasCountryCode ? `+${digits}` : `+55${digits}`;
};

const parseTwilioParams = async (req: Request): Promise<{ get: (k: string) => string | null; all: Record<string, string> }> => {
  const contentType = req.headers.get('content-type') || '';
  if (contentType.includes('multipart/form-data')) {
    const fd = await req.formData();
    const all: Record<string, string> = {};
    for (const [k, v] of fd.entries()) all[k] = v.toString();
    return { get: (k) => (all[k] ?? null), all };
  }
  const bodyText = await req.text();
  const params = new URLSearchParams(bodyText);
  const all: Record<string, string> = {};
  params.forEach((v, k) => { all[k] = v; });
  return { get: (k) => params.get(k), all };
};

const getPublicUrl = (req: Request): string => {
  const u = new URL(req.url);
  const proto = req.headers.get('x-forwarded-proto') || 'https';
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || u.host;
  return `${proto}://${host}${u.pathname}${u.search}`;
};

serve(async (req) => {
  try {
    // Parse form data from Twilio
    const formData = await parseTwilioParams(req);

    const publicUrl = getPublicUrl(req);
    const valid = await validateTwilioSignature(req, publicUrl, formData.all);
    if (!valid) {
      console.error('[twilio-voice-twiml] Invalid Twilio signature for url:', publicUrl);
      return new Response('Forbidden', { status: 403 });
    }

    const to = formData.get('To')?.toString();
    const from = formData.get('From')?.toString();
    const callRecordId = formData.get('callRecordId')?.toString() || '';
    const callerId = Deno.env.get('TWILIO_PHONE_NUMBER');

    console.log(`TwiML request: To=${to}, From=${from}, callRecordId=${callRecordId}`);

    if (!to) {
      console.error('Missing To number');
      return new Response(
        `<?xml version="1.0" encoding="UTF-8"?>
        <Response>
          <Say language="pt-BR">Número de destino não informado.</Say>
        </Response>`,
        { headers: { 'Content-Type': 'application/xml' } }
      );
    }

    // Clean the phone number (remove any client: prefix if present)
    let cleanNumber = to;
    if (to.startsWith('client:')) {
      cleanNumber = to.replace('client:', '');
    }

    cleanNumber = normalizeE164(cleanNumber);

    const webhookUrl = buildWebhookUrl({ callRecordId });
    const amdCallbackUrl = buildWebhookUrl({ callRecordId, type: 'amd' });

    // Generate TwiML to dial the number with recording + Answering Machine Detection.
    // AMD belongs to the <Number> noun in TwiML; keeping it on <Dial> makes Twilio reject
    // the application instructions and the browser receives HANGUP / 31005.
    // AMD attributes belong to <Dial>, not <Number>. Putting them on <Number>
    // makes Twilio reject the TwiML and the call ends immediately as `failed`.
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial
    callerId="${escapeXml(callerId || '')}"
    timeout="30"
    record="record-from-answer-dual"
    recordingStatusCallback="${escapeXml(webhookUrl)}"
    recordingStatusCallbackEvent="completed"
    action="${escapeXml(webhookUrl)}"
    machineDetection="Enable"
    machineDetectionTimeout="5"
    machineDetectionSpeechThreshold="2400"
    machineDetectionSpeechEndThreshold="1200"
    machineDetectionSilenceTimeout="5000"
    amdStatusCallback="${escapeXml(amdCallbackUrl)}"
    amdStatusCallbackMethod="POST">
    <Number>${escapeXml(cleanNumber)}</Number>
  </Dial>
</Response>`;

    console.log(`Generated TwiML for call to: ${cleanNumber}, webhook: ${webhookUrl}`);

    return new Response(twiml, {
      headers: { 'Content-Type': 'application/xml' }
    });

  } catch (error) {
    console.error('Error generating TwiML:', error);
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Say language="pt-BR">Erro ao processar a chamada.</Say>
      </Response>`,
      { headers: { 'Content-Type': 'application/xml' } }
    );
  }
});
