import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface BrevoSendRequest {
  to: string;
  name?: string;
  subject: string;
  htmlContent: string;
  cc?: Array<{ email: string; name?: string }>;
  tags?: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('BREVO_API_KEY');
    if (!apiKey) {
      throw new Error('BREVO_API_KEY not configured');
    }

    const body: BrevoSendRequest = await req.json();
    const { to, name, subject, htmlContent, cc, tags } = body;

    if (!to || !subject || !htmlContent) {
      throw new Error('Missing required fields: to, subject, htmlContent');
    }

    const payload: Record<string, unknown> = {
      sender: {
        name: 'MCF Gestão',
        email: 'marketing@minhacasafinanciada.com',
      },
      to: [{ email: to, name: name || to }],
      subject,
      htmlContent,
    };

    if (cc && cc.length > 0) {
      payload.cc = cc;
    }

    if (tags && tags.length > 0) {
      payload.tags = tags;
    }

    console.log(`[BREVO-SEND] Sending to ${to}, subject: ${subject}`);

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': apiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[BREVO-SEND] Brevo API error:', data);
      throw new Error(data.message || `Brevo API error: ${response.status}`);
    }

    console.log('[BREVO-SEND] Email sent successfully:', data);

    return new Response(
      JSON.stringify({ success: true, messageId: data.messageId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[BREVO-SEND] Error:', error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
