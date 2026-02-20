import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "npm:resend@4.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface SendDocumentEmailRequest {
  to: string;
  recipientName: string;
  subject: string;
  message: string;
  action: string;
}

function buildEmailHtml(recipientName: string, subject: string, message: string, appUrl: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#ffffff;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
          <!-- Header -->
          <tr>
            <td style="background-color:#1a1a2e;padding:24px 32px;border-radius:8px 8px 0 0;">
              <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:600;">MCF Gestão</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="background-color:#f8f9fa;padding:32px;border-left:1px solid #e9ecef;border-right:1px solid #e9ecef;">
              <p style="margin:0 0 8px;color:#6c757d;font-size:14px;">Olá, ${recipientName}</p>
              <h2 style="margin:0 0 16px;color:#1a1a2e;font-size:18px;font-weight:600;">${subject}</h2>
              <p style="margin:0 0 24px;color:#495057;font-size:15px;line-height:1.6;">${message}</p>
              <a href="${appUrl}" target="_blank" style="display:inline-block;background-color:#1a1a2e;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:6px;font-size:14px;font-weight:500;">
                Ver no Sistema
              </a>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:#f1f3f5;padding:16px 32px;border-radius:0 0 8px 8px;border:1px solid #e9ecef;border-top:none;">
              <p style="margin:0;color:#adb5bd;font-size:12px;text-align:center;">
                Este é um email automático enviado por MCF Gestão. Não responda a este email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY not configured');
    }

    const resend = new Resend(resendApiKey);
    const body: SendDocumentEmailRequest = await req.json();

    const { to, recipientName, subject, message, action } = body;

    if (!to || !subject || !message) {
      throw new Error('Missing required fields: to, subject, message');
    }

    const appUrl = 'https://mcf-insight-hub.lovable.app';

    const html = buildEmailHtml(
      recipientName || 'Colaborador',
      subject,
      message,
      appUrl
    );

    console.log(`[SEND-DOCUMENT-EMAIL] Sending to ${to}, action: ${action}`);

    const { data, error } = await resend.emails.send({
      from: 'MCF Notificações <notificacoes@mcfgestao.com.br>',
      to: [to],
      subject: subject,
      html: html,
    });

    if (error) {
      console.error('[SEND-DOCUMENT-EMAIL] Resend error:', error);
      throw new Error(error.message);
    }

    console.log('[SEND-DOCUMENT-EMAIL] Email sent:', data);

    return new Response(
      JSON.stringify({ success: true, id: data?.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[SEND-DOCUMENT-EMAIL] Error:', error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
