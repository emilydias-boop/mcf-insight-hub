import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse form data from Twilio webhook
    const formData = await req.formData();
    
    const callSid = formData.get('CallSid')?.toString();
    const callStatus = formData.get('CallStatus')?.toString();
    const callDuration = formData.get('CallDuration')?.toString();
    const from = formData.get('From')?.toString();
    const to = formData.get('To')?.toString();
    const direction = formData.get('Direction')?.toString();
    const recordingUrl = formData.get('RecordingUrl')?.toString();

    console.log(`Webhook received: CallSid=${callSid}, Status=${callStatus}, Duration=${callDuration}`);

    if (!callSid) {
      console.error('Missing CallSid in webhook');
      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        { headers: { 'Content-Type': 'application/xml' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Map Twilio status to our status
    const statusMap: Record<string, string> = {
      'queued': 'initiated',
      'initiated': 'initiated',
      'ringing': 'ringing',
      'in-progress': 'in-progress',
      'completed': 'completed',
      'failed': 'failed',
      'busy': 'busy',
      'no-answer': 'no-answer',
      'canceled': 'canceled'
    };

    const mappedStatus = statusMap[callStatus || ''] || callStatus;
    const updates: Record<string, any> = { 
      status: mappedStatus,
      updated_at: new Date().toISOString()
    };

    // Set answered_at when call is answered
    if (callStatus === 'in-progress') {
      updates.answered_at = new Date().toISOString();
    }

    // Set ended_at and duration when call completes
    if (['completed', 'failed', 'busy', 'no-answer', 'canceled'].includes(callStatus || '')) {
      updates.ended_at = new Date().toISOString();
      updates.duration_seconds = parseInt(callDuration || '0') || 0;
    }

    // Add recording URL if available
    if (recordingUrl) {
      updates.recording_url = recordingUrl;
    }

    // Update the call record
    const { error } = await supabase
      .from('calls')
      .update(updates)
      .eq('twilio_call_sid', callSid);

    if (error) {
      console.error('Error updating call:', error);
    } else {
      console.log(`Call ${callSid} updated to status: ${mappedStatus}`);
    }

    // Return empty TwiML response
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      { headers: { 'Content-Type': 'application/xml' } }
    );

  } catch (error) {
    console.error('Error processing webhook:', error);
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      { headers: { 'Content-Type': 'application/xml' } }
    );
  }
});
