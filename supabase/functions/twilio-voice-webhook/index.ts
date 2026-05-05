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
        const MIN_DURATION = 30;

        if (durationSec >= MIN_DURATION) {
          // Buscar o call record para descobrir deal_id e checar outcome/answered_by atual
          const { data: callRow } = await supabase
            .from('calls')
            .select('id, deal_id, answered_by, outcome')
            .eq('twilio_call_sid', callSid)
            .maybeSingle();

          const finalAnsweredBy = answeredBy || callRow?.answered_by || null;
          const isHuman = finalAnsweredBy === 'human' || (!finalAnsweredBy && callRow?.outcome !== 'voicemail');

          if (callRow?.deal_id && isHuman) {
            const EM_CONTATO_STAGE_ID = 'b1c0a7e2-9d4f-4a1c-8e3b-2f5d6a8b9c01';
            const ALLOWED_SOURCE_STAGES = new Set([
              'e6fab26d-f16d-4b00-900f-ca915cbfe9d9', // ANAMNESE INCOMPLETA
              'd346320a-00b0-4e9f-89b6-149ad1c34061', // Lead Gratuito
              '3c81d73b-0d5d-480f-a3c9-ab7a6c7965a2', // Lead Instagram
              'cf4a369c-c4a6-4299-933d-5ae3dcc39d4b', // Novo Lead
              'a1d19874-4d47-4405-94fd-fb5237da44dd', // Lead Qualificado
              'b06c9413-0312-4f1d-89b4-822d79bc6a90', // Sem Interesse
            ]);

            const { data: dealRow } = await supabase
              .from('crm_deals')
              .select('id, stage_id, owner_id')
              .eq('id', callRow.deal_id)
              .maybeSingle();

            if (dealRow?.stage_id && ALLOWED_SOURCE_STAGES.has(dealRow.stage_id)) {
              const previousStageId = dealRow.stage_id;

              const { error: stageErr } = await supabase
                .from('crm_deals')
                .update({ stage_id: EM_CONTATO_STAGE_ID, updated_at: new Date().toISOString() })
                .eq('id', callRow.deal_id);

              if (stageErr) {
                console.error('[Em contato] Falha ao atualizar stage:', stageErr);
              } else {
                await supabase.from('deal_activities').insert({
                  deal_id: callRow.deal_id,
                  activity_type: 'stage_change',
                  description: `Movido automaticamente para "Em contato" — chamada Twilio com humano (duração ${durationSec}s)`,
                  from_stage: previousStageId,
                  to_stage: EM_CONTATO_STAGE_ID,
                  user_id: dealRow.owner_id || null,
                  metadata: {
                    source: 'twilio_auto',
                    call_sid: callSid,
                    call_id: callRow.id,
                    duration_seconds: durationSec,
                    answered_by: finalAnsweredBy,
                  },
                });
                console.log(`✅ Deal ${callRow.deal_id} movido para "Em contato" (call ${callSid}, ${durationSec}s, AMD=${finalAnsweredBy})`);
              }
            } else {
              console.log(`[Em contato] Deal ${callRow.deal_id} não movido — stage ${dealRow?.stage_id} não permite auto-move`);
            }
          } else {
            console.log(`[Em contato] Auto-move pulado — deal_id=${callRow?.deal_id}, isHuman=${isHuman}, answeredBy=${finalAnsweredBy}`);
          }
        } else {
          console.log(`[Em contato] Duração ${durationSec}s abaixo do mínimo (${MIN_DURATION}s) — não move`);
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
