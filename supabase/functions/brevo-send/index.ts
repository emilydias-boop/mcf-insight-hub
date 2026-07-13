import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || Deno.env.get('VITE_SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const supabaseAdmin = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

const MCF_DOMAIN = '@minhacasafinanciada.com';
const DEFAULT_SENDER_EMAIL = `marketing${MCF_DOMAIN}`;
const DEFAULT_SENDER_NAME = 'MCF Gestão';

interface BrevoSendRequest {
  to: string;
  name?: string;
  subject: string;
  htmlContent: string;
  cc?: Array<{ email: string; name?: string }>;
  tags?: string[];
  senderEmail?: string;
  senderName?: string;
  dealId?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let logId: string | null = null;

  try {
    const apiKey = Deno.env.get('BREVO_API_KEY');
    if (!apiKey) {
      throw new Error('BREVO_API_KEY not configured');
    }

    const body: BrevoSendRequest = await req.json();
    const { to, name, subject, htmlContent, cc, tags, senderEmail, senderName, dealId } = body;

    if (!to || !subject || !htmlContent) {
      throw new Error('Missing required fields: to, subject, htmlContent');
    }

    // Use individual @mcf email as sender if provided, otherwise fallback
    const useMcfSender = senderEmail && senderEmail.endsWith(MCF_DOMAIN);
    const finalSenderEmail = useMcfSender ? senderEmail : DEFAULT_SENDER_EMAIL;
    const finalSenderName = useMcfSender && senderName ? senderName : DEFAULT_SENDER_NAME;

    // Persist log entry before sending
    if (supabaseAdmin) {
      const { data: log, error: logError } = await supabaseAdmin
        .from('automation_logs')
        .insert({
          channel: 'email',
          recipient: to,
          status: 'pending',
          deal_id: dealId || null,
          content_sent: htmlContent,
          metadata: {
            tags: tags || [],
            subject,
            senderEmail: finalSenderEmail,
            senderName: finalSenderName,
            dealId: dealId || null,
          },
        })
        .select('id')
        .single();

      if (logError) {
        console.error('[BREVO-SEND] Failed to create automation log:', logError);
      } else if (log) {
        logId = log.id;
      }
    }

    const payload: Record<string, unknown> = {
      sender: {
        name: finalSenderName,
        email: finalSenderEmail,
      },
      to: [{ email: to, name: name || to }],
      subject,
      htmlContent,
    };

    // Add replyTo when a sender email is provided
    if (senderEmail) {
      payload.replyTo = {
        email: senderEmail,
        name: senderName || senderEmail,
      };
    }

    if (cc && cc.length > 0) {
      payload.cc = cc;
    }

    if (tags && tags.length > 0) {
      payload.tags = tags;
    }

    console.log(`[BREVO-SEND] Sending from ${finalSenderEmail} to ${to}, subject: ${subject}`);

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
      const errorMessage = data.message || `Brevo API error: ${response.status}`;

      if (logId && supabaseAdmin) {
        const { error: updateError } = await supabaseAdmin
          .from('automation_logs')
          .update({
            status: 'failed',
            error_message: errorMessage,
            external_status: String(response.status),
          })
          .eq('id', logId);

        if (updateError) {
          console.error('[BREVO-SEND] Failed to update automation log:', updateError);
        }
      }

      throw new Error(errorMessage);
    }

    console.log('[BREVO-SEND] Email sent successfully:', data);

    if (logId && supabaseAdmin) {
      const { error: updateError } = await supabaseAdmin
        .from('automation_logs')
        .update({
          status: 'sent',
          external_id: data.messageId ? String(data.messageId) : null,
          external_status: 'sent',
          sent_at: new Date().toISOString(),
        })
        .eq('id', logId);

      if (updateError) {
        console.error('[BREVO-SEND] Failed to update automation log:', updateError);
      }
    }

    // NOTA: auto-move para "Em contato" foi removido daqui.
    // brevo-send é invocado por automações e por fluxos sistêmicos (NFSe, relatórios),
    // então não devemos mover o lead automaticamente. Movimentação só deve ocorrer
    // por ação manual do SDR (deal_activities tipo 'call'/'note'/'qualification_note').

    return new Response(
      JSON.stringify({ success: true, messageId: data.messageId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[BREVO-SEND] Error:', error.message);

    if (logId && supabaseAdmin) {
      const { error: updateError } = await supabaseAdmin
        .from('automation_logs')
        .update({
          status: 'failed',
          error_message: error.message,
        })
        .eq('id', logId);

      if (updateError) {
        console.error('[BREVO-SEND] Failed to update automation log:', updateError);
      }
    }

    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
