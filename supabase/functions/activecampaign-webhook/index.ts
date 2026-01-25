// ActiveCampaign Webhook - Receive events from ActiveCampaign
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
    const payload = await req.json();
    console.log('[AC-WEBHOOK] Received:', JSON.stringify(payload));

    const eventType = payload.type;
    const contactEmail = payload.contact?.email;

    if (!contactEmail) {
      console.log('[AC-WEBHOOK] No contact email in payload');
      return new Response('OK', { headers: corsHeaders });
    }

    // Find logs for this email
    const { data: logEntries, error: findError } = await supabase
      .from('automation_logs')
      .select('id, status')
      .eq('recipient', contactEmail)
      .eq('channel', 'email')
      .order('created_at', { ascending: false })
      .limit(1);

    if (findError) {
      console.error('[AC-WEBHOOK] Error finding logs:', findError);
    }

    const logEntry = logEntries?.[0];

    if (logEntry) {
      const updateData: any = {
        external_status: eventType
      };

      // Map ActiveCampaign events to our status
      switch (eventType) {
        case 'open':
        case 'email_open':
          updateData.status = 'read';
          updateData.read_at = new Date().toISOString();
          break;
        case 'click':
        case 'link_click':
          // Click implies read
          if (logEntry.status !== 'replied') {
            updateData.status = 'read';
          }
          break;
        case 'reply':
        case 'email_reply':
          updateData.status = 'replied';
          updateData.replied_at = new Date().toISOString();
          break;
        case 'bounce':
        case 'hard_bounce':
        case 'soft_bounce':
          updateData.status = 'failed';
          updateData.error_message = `Email bounced: ${eventType}`;
          break;
        case 'unsubscribe':
          updateData.status = 'failed';
          updateData.error_message = 'Contact unsubscribed';
          
          // Add to blacklist
          await supabase.from('automation_blacklist').insert({
            email: contactEmail,
            channel: 'email',
            reason: 'Unsubscribed via ActiveCampaign'
          });
          break;
        case 'complaint':
        case 'spam_complaint':
          updateData.status = 'failed';
          updateData.error_message = 'Marked as spam';
          
          // Add to blacklist
          await supabase.from('automation_blacklist').insert({
            email: contactEmail,
            channel: 'email',
            reason: 'Marked as spam'
          });
          break;
      }

      const { error: updateError } = await supabase
        .from('automation_logs')
        .update(updateData)
        .eq('id', logEntry.id);

      if (updateError) {
        console.error('[AC-WEBHOOK] Error updating log:', updateError);
      } else {
        console.log(`[AC-WEBHOOK] Updated log ${logEntry.id} with event: ${eventType}`);
      }
    } else {
      console.log(`[AC-WEBHOOK] No log found for email: ${contactEmail}`);
    }

    return new Response('OK', { headers: corsHeaders });

  } catch (error: any) {
    console.error('[AC-WEBHOOK] Error:', error.message);
    return new Response('OK', { headers: corsHeaders });
  }
});
