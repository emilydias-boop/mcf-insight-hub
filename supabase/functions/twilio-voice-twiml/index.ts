import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  try {
    // Parse form data from Twilio
    const formData = await req.formData();
    
    const to = formData.get('To')?.toString();
    const from = formData.get('From')?.toString();
    const callerId = Deno.env.get('TWILIO_PHONE_NUMBER');

    console.log(`TwiML request: To=${to}, From=${from}`);

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

    // Ensure the number has country code
    if (!cleanNumber.startsWith('+')) {
      // Assume Brazil if no country code
      cleanNumber = '+55' + cleanNumber.replace(/\D/g, '');
    }

    // Generate TwiML to dial the number with recording enabled
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial 
    callerId="${callerId}" 
    timeout="30" 
    record="record-from-answer-dual"
    recordingStatusCallback="https://rehcfgqvigfcekiipqkc.supabase.co/functions/v1/twilio-voice-webhook"
    recordingStatusCallbackEvent="completed"
    action="https://rehcfgqvigfcekiipqkc.supabase.co/functions/v1/twilio-voice-webhook">
    <Number>${cleanNumber}</Number>
  </Dial>
</Response>`;

    console.log(`Generated TwiML for call to: ${cleanNumber}`);

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
