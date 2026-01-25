// Twilio WhatsApp Webhook - Receive status callbacks from Twilio
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    // Twilio sends form-urlencoded data
    const formData = await req.formData();
    const payload: Record<string, string> = {};
    
    for (const [key, value] of formData.entries()) {
      payload[key] = value.toString();
    }

    console.log('[TWILIO-WEBHOOK] Received:', JSON.stringify(payload));

    const messageSid = payload.MessageSid;
    const messageStatus = payload.MessageStatus || payload.SmsStatus;
    const errorCode = payload.ErrorCode;
    const errorMessage = payload.ErrorMessage;

    if (!messageSid) {
      console.warn('[TWILIO-WEBHOOK] No MessageSid in payload');
      return new Response('OK', { headers: corsHeaders });
    }

    // Map Twilio status to our status
    const statusMap: Record<string, string> = {
      'queued': 'sent',
      'sent': 'sent',
      'delivered': 'delivered',
      'read': 'read',
      'failed': 'failed',
      'undelivered': 'failed'
    };

    const ourStatus = statusMap[messageStatus] || messageStatus;

    // Find the log entry by external_id
    const { data: logEntry, error: findError } = await supabase
      .from('automation_logs')
      .select('id, status')
      .eq('external_id', messageSid)
      .eq('channel', 'whatsapp')
      .maybeSingle();

    if (findError) {
      console.error('[TWILIO-WEBHOOK] Error finding log:', findError);
    }

    if (logEntry) {
      // Update the log entry
      const updateData: any = {
        external_status: messageStatus,
        status: ourStatus
      };

      if (messageStatus === 'delivered') {
        updateData.delivered_at = new Date().toISOString();
      } else if (messageStatus === 'read') {
        updateData.read_at = new Date().toISOString();
      } else if (messageStatus === 'failed' || messageStatus === 'undelivered') {
        updateData.error_message = errorMessage || `Error code: ${errorCode}`;
      }

      const { error: updateError } = await supabase
        .from('automation_logs')
        .update(updateData)
        .eq('id', logEntry.id);

      if (updateError) {
        console.error('[TWILIO-WEBHOOK] Error updating log:', updateError);
      } else {
        console.log(`[TWILIO-WEBHOOK] Updated log ${logEntry.id} to status: ${ourStatus}`);
      }
    } else {
      console.log(`[TWILIO-WEBHOOK] No log found for messageSid: ${messageSid}`);
    }

    // Twilio expects a 200 response
    return new Response('OK', { headers: corsHeaders });

  } catch (error: any) {
    console.error('[TWILIO-WEBHOOK] Error:', error.message);
    // Still return 200 to prevent Twilio from retrying
    return new Response('OK', { headers: corsHeaders });
  }
});
