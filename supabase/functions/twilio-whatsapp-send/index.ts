// Twilio WhatsApp Send - Send WhatsApp messages via Twilio API
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendRequest {
  to: string;
  body?: string;
  templateSid?: string;
  variables?: Record<string, string>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: SendRequest = await req.json();
    console.log('[TWILIO-WHATSAPP] Request:', JSON.stringify({ to: body.to, hasTemplate: !!body.templateSid }));

    const { to, body: messageBody, templateSid, variables } = body;

    if (!to) {
      throw new Error('Missing required field: to');
    }

    // Get Twilio credentials from environment
    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const fromNumber = Deno.env.get('TWILIO_WHATSAPP_FROM');

    if (!accountSid || !authToken) {
      console.error('[TWILIO-WHATSAPP] Missing Twilio credentials');
      throw new Error('Twilio credentials not configured');
    }

    if (!fromNumber) {
      console.error('[TWILIO-WHATSAPP] Missing TWILIO_WHATSAPP_FROM');
      throw new Error('WhatsApp sender number not configured');
    }

    // Normalize phone number
    let normalizedTo = to.replace(/\D/g, '');
    if (!normalizedTo.startsWith('55')) {
      normalizedTo = '55' + normalizedTo;
    }
    normalizedTo = 'whatsapp:+' + normalizedTo;

    const fromWhatsApp = fromNumber.startsWith('whatsapp:') 
      ? fromNumber 
      : `whatsapp:${fromNumber}`;

    // Build request body
    const formData = new URLSearchParams();
    formData.append('From', fromWhatsApp);
    formData.append('To', normalizedTo);

    if (templateSid) {
      // Use Content SID for template messages
      formData.append('ContentSid', templateSid);
      
      // Add template variables if provided
      if (variables) {
        const contentVariables: Record<string, string> = {};
        let index = 1;
        for (const [key, value] of Object.entries(variables)) {
          contentVariables[String(index)] = value;
          index++;
        }
        formData.append('ContentVariables', JSON.stringify(contentVariables));
      }
    } else if (messageBody) {
      // Free-form message (only works in sandbox or after 24h window)
      formData.append('Body', messageBody);
    } else {
      throw new Error('Either templateSid or body is required');
    }

    // Send via Twilio API
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const auth = btoa(`${accountSid}:${authToken}`);

    console.log('[TWILIO-WHATSAPP] Sending to:', normalizedTo);

    const response = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString()
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('[TWILIO-WHATSAPP] Twilio error:', result);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: result.message || 'Twilio API error',
          code: result.code 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log('[TWILIO-WHATSAPP] Message sent:', result.sid);

    return new Response(
      JSON.stringify({ 
        success: true, 
        messageSid: result.sid,
        status: result.status
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[TWILIO-WHATSAPP] Error:', error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
