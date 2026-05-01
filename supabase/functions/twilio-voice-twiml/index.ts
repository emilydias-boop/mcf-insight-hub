import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

const parseTwilioParams = async (req: Request) => {
  const contentType = req.headers.get('content-type') || '';
  if (contentType.includes('multipart/form-data')) return await req.formData();

  const bodyText = await req.text();
  const params = new URLSearchParams(bodyText);
  return {
    get: (key: string) => params.get(key),
  };
};

serve(async (req) => {
  try {
    // Parse form data from Twilio
    const formData = await parseTwilioParams(req);
    
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
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial 
    callerId="${escapeXml(callerId || '')}" 
    timeout="30" 
    record="record-from-answer-dual"
    recordingStatusCallback="${escapeXml(webhookUrl)}"
    recordingStatusCallbackEvent="completed"
    action="${escapeXml(webhookUrl)}">
    <Number
      machineDetection="DetectMessageEnd"
      amdStatusCallback="${escapeXml(amdCallbackUrl)}"
      amdStatusCallbackMethod="POST">${escapeXml(cleanNumber)}</Number>
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
