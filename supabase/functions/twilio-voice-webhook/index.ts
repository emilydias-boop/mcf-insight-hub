import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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
    // Get callRecordId from URL query params (passed from TwiML)
    const url = new URL(req.url);
    const callRecordIdFromUrl = url.searchParams.get('callRecordId');

    // Parse form data from Twilio webhook
    const formData = await req.formData();
    
    const callSid = formData.get('CallSid')?.toString();
    const callStatus = formData.get('CallStatus')?.toString();
    const callDuration = formData.get('CallDuration')?.toString();
    const from = formData.get('From')?.toString();
    const to = formData.get('To')?.toString();
    const direction = formData.get('Direction')?.toString();
    const recordingUrl = formData.get('RecordingUrl')?.toString();
    const recordingSid = formData.get('RecordingSid')?.toString();
    const recordingDuration = formData.get('RecordingDuration')?.toString();
    const recordingStatus = formData.get('RecordingStatus')?.toString();

    console.log(`Webhook received: CallSid=${callSid}, Status=${callStatus}, RecordingStatus=${recordingStatus}, RecordingSid=${recordingSid}, callRecordId=${callRecordIdFromUrl}`);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Check if this is a recording status callback (separate from call status)
    if (recordingStatus === 'completed' && recordingUrl) {
      // This is a recording callback - just save the recording URL
      const finalRecordingUrl = recordingUrl.endsWith('.mp3') 
        ? recordingUrl 
        : `${recordingUrl}.mp3`;

      console.log(`Recording completed: ${finalRecordingUrl}`);

      // Try to update by callRecordId first (from URL param)
      if (callRecordIdFromUrl) {
        const { error } = await supabase
          .from('calls')
          .update({ 
            recording_url: finalRecordingUrl,
            updated_at: new Date().toISOString()
          })
          .eq('id', callRecordIdFromUrl);

        if (error) {
          console.error('Error updating recording by callRecordId:', error);
        } else {
          console.log(`Recording saved for call ${callRecordIdFromUrl}`);
        }
      } else if (callSid) {
        // Fallback to CallSid
        const { error } = await supabase
          .from('calls')
          .update({ 
            recording_url: finalRecordingUrl,
            updated_at: new Date().toISOString()
          })
          .eq('twilio_call_sid', callSid);

        if (error) {
          console.error('Error updating recording by CallSid:', error);
        } else {
          console.log(`Recording saved for CallSid ${callSid}`);
        }
      }

      // Return empty TwiML response
      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        { headers: { 'Content-Type': 'application/xml' } }
      );
    }

    // Regular call status webhook
    if (!callSid) {
      console.error('Missing CallSid in webhook');
      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        { headers: { 'Content-Type': 'application/xml' } }
      );
    }

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

    // Set started_at when call is answered
    if (callStatus === 'in-progress') {
      updates.started_at = new Date().toISOString();
    }

    // Set ended_at and duration when call completes
    if (['completed', 'failed', 'busy', 'no-answer', 'canceled'].includes(callStatus || '')) {
      updates.ended_at = new Date().toISOString();
      updates.duration_seconds = parseInt(callDuration || '0') || 0;
    }

    // Add recording URL if available in status callback (backup)
    if (recordingUrl) {
      updates.recording_url = recordingUrl.endsWith('.mp3') ? recordingUrl : `${recordingUrl}.mp3`;
      console.log(`Recording URL in status callback: ${updates.recording_url}`);
    }

    // Try to update by twilio_call_sid first
    let updateSucceeded = false;
    const { error: sidError, data: sidData } = await supabase
      .from('calls')
      .update(updates)
      .eq('twilio_call_sid', callSid)
      .select('id');

    if (!sidError && sidData && sidData.length > 0) {
      updateSucceeded = true;
      console.log(`Call ${callSid} updated by twilio_call_sid to status: ${mappedStatus}`);
    }

    // If update by CallSid failed, try by callRecordId
    if (!updateSucceeded && callRecordIdFromUrl) {
      // Also set the twilio_call_sid so future updates work
      const { error: recordError } = await supabase
        .from('calls')
        .update({ ...updates, twilio_call_sid: callSid })
        .eq('id', callRecordIdFromUrl);

      if (recordError) {
        console.error('Error updating call by callRecordId:', recordError);
      } else {
        console.log(`Call ${callRecordIdFromUrl} updated by callRecordId, linked to CallSid: ${callSid}`);
      }
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
