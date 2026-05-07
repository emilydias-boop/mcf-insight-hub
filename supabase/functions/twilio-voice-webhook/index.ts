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
    const callbackType = url.searchParams.get('type'); // 'amd' for async machine detection

    // Parse form data from Twilio webhook
    const formData = await req.formData();
    
    const callSid = formData.get('CallSid')?.toString();
    // Twilio sends DialCallStatus/DialCallDuration when using <Dial> action callback
    const callStatus = formData.get('DialCallStatus')?.toString() || formData.get('CallStatus')?.toString();
    const callDuration = formData.get('DialCallDuration')?.toString() || formData.get('CallDuration')?.toString();
    const from = formData.get('From')?.toString();
    const to = formData.get('To')?.toString();
    const direction = formData.get('Direction')?.toString();
    const recordingUrl = formData.get('RecordingUrl')?.toString();
    const recordingSid = formData.get('RecordingSid')?.toString();
    const recordingDuration = formData.get('RecordingDuration')?.toString();
    const recordingStatus = formData.get('RecordingStatus')?.toString();
    const answeredBy = formData.get('AnsweredBy')?.toString();

    // Detailed logging for debugging
    console.log(`Webhook received: type=${callbackType}, CallSid=${callSid}, Status=${callStatus}, Duration=${callDuration}, RecordingStatus=${recordingStatus}, RecordingSid=${recordingSid}, RecordingDuration=${recordingDuration}, callRecordId=${callRecordIdFromUrl}, AnsweredBy=${answeredBy}`);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // ============================================================
    // ASYNC AMD CALLBACK (Answering Machine Detection)
    // Twilio sends AnsweredBy: human | machine_start | machine_end_beep
    //                        | machine_end_silence | machine_end_other
    //                        | fax | unknown
    // If detected as machine/fax/unknown → derruba a chamada e marca voicemail
    // ============================================================
    if (callbackType === 'amd' && answeredBy) {
      console.log(`AMD result: ${answeredBy} for CallSid=${callSid}, callRecordId=${callRecordIdFromUrl}`);

      const isMachine = answeredBy.startsWith('machine') || answeredBy === 'fax' || answeredBy === 'unknown';

      const amdUpdates: Record<string, any> = {
        answered_by: answeredBy,
        updated_at: new Date().toISOString(),
      };
      if (isMachine) {
        amdUpdates.outcome = 'voicemail';
      }

      // Update call record (try by CallSid first, fallback to callRecordId)
      if (callSid) {
        const { error } = await supabase
          .from('calls')
          .update(amdUpdates)
          .eq('twilio_call_sid', callSid);
        if (error) console.error('AMD update by CallSid error:', error);
      }
      if (callRecordIdFromUrl) {
        const { error } = await supabase
          .from('calls')
          .update(amdUpdates)
          .eq('id', callRecordIdFromUrl);
        if (error) console.error('AMD update by callRecordId error:', error);
      }

      // If machine detected → hang up the call via Twilio REST API
      if (isMachine && callSid) {
        try {
          const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
          const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
          if (accountSid && authToken) {
            const auth = btoa(`${accountSid}:${authToken}`);
            const hangupUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls/${callSid}.json`;
            const resp = await fetch(hangupUrl, {
              method: 'POST',
              headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/x-www-form-urlencoded',
              },
              body: new URLSearchParams({ Status: 'completed' }),
            });
            if (!resp.ok) {
              const txt = await resp.text();
              console.error(`Failed to hangup machine call ${callSid}: ${resp.status} ${txt}`);
            } else {
              console.log(`✅ Voicemail detected, hung up call ${callSid} (AnsweredBy=${answeredBy})`);
            }
          } else {
            console.error('Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN — cannot hangup');
          }
        } catch (hangupErr) {
          console.error('Error hanging up machine call:', hangupErr);
        }
      }

      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        { headers: { 'Content-Type': 'application/xml' } }
      );
    }

    // Check if this is a recording status callback (separate from call status)
    if (recordingStatus === 'completed' && recordingUrl) {
      // This is a recording callback - save URL and duration
      const finalRecordingUrl = recordingUrl.endsWith('.mp3') 
        ? recordingUrl 
        : `${recordingUrl}.mp3`;

      // Parse recording duration (more reliable than CallDuration)
      const durationSeconds = parseInt(recordingDuration || '0') || null;

      console.log(`Recording completed: ${finalRecordingUrl}, duration=${durationSeconds}s`);

      const recordingUpdates: Record<string, any> = { 
        recording_url: finalRecordingUrl,
        updated_at: new Date().toISOString()
      };

      // Save recording duration if available
      if (durationSeconds && durationSeconds > 0) {
        recordingUpdates.duration_seconds = durationSeconds;
      }

      // Try to update by callRecordId first (from URL param)
      if (callRecordIdFromUrl) {
        const { error } = await supabase
          .from('calls')
          .update(recordingUpdates)
          .eq('id', callRecordIdFromUrl);

        if (error) {
          console.error('Error updating recording by callRecordId:', error);
        } else {
          console.log(`Recording saved for call ${callRecordIdFromUrl} with duration ${durationSeconds}s`);
        }
      } else if (callSid) {
        // Fallback to CallSid
        const { error } = await supabase
          .from('calls')
          .update(recordingUpdates)
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

    // Do NOT overwrite started_at - it was set by the frontend when the SDR clicked to call
    // The 'in-progress' webhook means the callee answered, not when the call started
    if (callStatus === 'in-progress') {
      updates.answered_at = new Date().toISOString();
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

    // ============================================================
    // AUTO-MOVE deal para "Em contato" quando:
    //   - chamada completou (status = completed)
    //   - duração >= 30 segundos
    //   - AnsweredBy = 'human' OU não foi marcado como voicemail
    //   - deal está em uma das stages anteriores a R1 Agendada
    // ============================================================
    if (callStatus === 'completed') {
      try {
        const durationSec = parseInt(callDuration || '0') || 0;
        // Mover para "Em contato" em QUALQUER chamada completa (independente de duração / AMD)
        const { data: callRow } = await supabase
          .from('calls')
          .select('id, deal_id, answered_by, outcome')
          .eq('twilio_call_sid', callSid)
          .maybeSingle();
        if (callRow?.deal_id) {
          const { data: moved, error: rpcErr } = await supabase.rpc('auto_move_deal_to_em_contato', {
            p_deal_id: callRow.deal_id,
            p_source: 'twilio_call',
            p_description: `Movido automaticamente para "Em contato" — chamada Twilio (duração ${durationSec}s)`,
            p_metadata: {
              call_sid: callSid,
              call_id: callRow.id,
              duration_seconds: durationSec,
              answered_by: answeredBy || callRow?.answered_by || null,
            },
          });
          if (rpcErr) console.error('[Em contato] RPC erro:', rpcErr);
          else console.log(`[Em contato] call ${callSid} → moved=${moved}`);
        }
      } catch (autoMoveErr) {
        console.error('[Em contato] Erro no auto-move:', autoMoveErr);
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
