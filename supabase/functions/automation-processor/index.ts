// Automation Processor - Cron job to process automation queue
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BATCH_SIZE = 50;
const MAX_RETRIES = 3;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const startTime = Date.now();
  const results = {
    processed: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
    errors: [] as string[]
  };

  try {
    console.log('[AUTOMATION-PROCESSOR] Starting processing...');

    // 1. Fetch pending items that are due
    const { data: queueItems, error: fetchError } = await supabase
      .from('automation_queue')
      .select(`
        id,
        deal_id,
        contact_id,
        flow_id,
        step_id,
        scheduled_at,
        attempts,
        automation_steps:step_id (
          id,
          channel,
          template_id,
          automation_templates:template_id (
            id,
            name,
            channel,
            content,
            subject,
            twilio_template_sid,
            activecampaign_template_id,
            variables
          )
        ),
        automation_flows:flow_id (
          id,
          name,
          stage_id
        )
      `)
      .eq('status', 'pending')
      .lte('scheduled_at', new Date().toISOString())
      .order('scheduled_at', { ascending: true })
      .limit(BATCH_SIZE);

    if (fetchError) {
      throw fetchError;
    }

    if (!queueItems || queueItems.length === 0) {
      console.log('[AUTOMATION-PROCESSOR] No pending items to process');
      return new Response(
        JSON.stringify({ success: true, ...results, message: 'No pending items' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[AUTOMATION-PROCESSOR] Found ${queueItems.length} items to process`);

    // 2. Process each item
    for (const item of queueItems) {
      results.processed++;
      
      try {
        // Validate step and template exist
        const step = item.automation_steps as any;
        const flow = item.automation_flows as any;
        
        if (!step || !step.automation_templates) {
          console.warn(`[AUTOMATION-PROCESSOR] Item ${item.id} has no valid step/template`);
          await markAsSkipped(supabase, item.id, 'Missing step or template');
          results.skipped++;
          continue;
        }

        const template = step.automation_templates;

        // 3. Verify deal is still in the same stage
        const { data: deal } = await supabase
          .from('crm_deals')
          .select('id, stage_id, contact_id')
          .eq('id', item.deal_id)
          .maybeSingle();

        if (!deal) {
          console.warn(`[AUTOMATION-PROCESSOR] Deal ${item.deal_id} not found`);
          await markAsSkipped(supabase, item.id, 'Deal not found');
          results.skipped++;
          continue;
        }

        if (flow.stage_id && deal.stage_id !== flow.stage_id) {
          console.log(`[AUTOMATION-PROCESSOR] Deal ${item.deal_id} moved to different stage, skipping`);
          await markAsSkipped(supabase, item.id, 'Deal moved to different stage');
          results.skipped++;
          continue;
        }

        // 4. Get contact info for variables
        const { data: contact } = await supabase
          .from('crm_contacts')
          .select('id, name, email, phone')
          .eq('id', item.contact_id || deal.contact_id)
          .maybeSingle();

        if (!contact) {
          console.warn(`[AUTOMATION-PROCESSOR] Contact not found for deal ${item.deal_id}`);
          await markAsSkipped(supabase, item.id, 'Contact not found');
          results.skipped++;
          continue;
        }

        // 5. Check blacklist
        const { data: blacklisted } = await supabase
          .from('automation_blacklist')
          .select('id')
          .or(`contact_id.eq.${contact.id},email.eq.${contact.email},phone.eq.${contact.phone}`)
          .maybeSingle();

        if (blacklisted) {
          console.log(`[AUTOMATION-PROCESSOR] Contact ${contact.id} is blacklisted`);
          await markAsSkipped(supabase, item.id, 'Contact blacklisted');
          results.skipped++;
          continue;
        }

        // 6. Get deal owner info for SDR variable
        const { data: dealWithOwner } = await supabase
          .from('crm_deals')
          .select('owner_id, original_sdr_email')
          .eq('id', item.deal_id)
          .maybeSingle();

        let sdrName = '';
        if (dealWithOwner?.owner_id) {
          const { data: ownerProfile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', dealWithOwner.owner_id)
            .maybeSingle();
          sdrName = ownerProfile?.full_name || '';
        }

        // 7. Build message content with variables
        const variables = {
          nome: contact.name || '',
          email: contact.email || '',
          telefone: contact.phone || '',
          sdr: sdrName,
          data: new Date().toLocaleDateString('pt-BR'),
          link: '' // Can be customized per template
        };

        const content = replaceVariables(template.content, variables);
        const subject = template.subject ? replaceVariables(template.subject, variables) : undefined;

        // 8. Send via appropriate channel
        let sendResult: { success: boolean; externalId?: string; error?: string };

        if (step.channel === 'whatsapp') {
          sendResult = await sendWhatsApp(supabase, {
            to: contact.phone,
            templateSid: template.twilio_template_sid,
            content,
            variables
          });
        } else if (step.channel === 'email') {
          sendResult = await sendEmail(supabase, {
            to: contact.email,
            name: contact.name,
            subject: subject || 'Mensagem automática',
            content,
            templateId: template.activecampaign_template_id
          });
        } else {
          sendResult = { success: false, error: `Unknown channel: ${step.channel}` };
        }

        // 9. Log the result
        await supabase.from('automation_logs').insert({
          flow_id: item.flow_id,
          step_id: item.step_id,
          template_id: template.id,
          deal_id: item.deal_id,
          contact_id: contact.id,
          channel: step.channel,
          recipient: step.channel === 'whatsapp' ? contact.phone : contact.email,
          content_sent: content,
          status: sendResult.success ? 'sent' : 'failed',
          external_id: sendResult.externalId,
          error_message: sendResult.error,
          sent_at: sendResult.success ? new Date().toISOString() : null
        });

        // 10. Update queue item status
        if (sendResult.success) {
          await supabase
            .from('automation_queue')
            .update({
              status: 'sent',
              processed_at: new Date().toISOString()
            })
            .eq('id', item.id);
          results.sent++;
          console.log(`[AUTOMATION-PROCESSOR] Sent ${step.channel} to ${contact.name}`);
        } else {
          const newAttempts = (item.attempts || 0) + 1;
          const newStatus = newAttempts >= MAX_RETRIES ? 'failed' : 'pending';
          
          await supabase
            .from('automation_queue')
            .update({
              status: newStatus,
              attempts: newAttempts,
              last_attempt_at: new Date().toISOString(),
              error_message: sendResult.error
            })
            .eq('id', item.id);
          
          if (newStatus === 'failed') {
            results.failed++;
            results.errors.push(`${step.channel} to ${contact.email}: ${sendResult.error}`);
          }
          console.error(`[AUTOMATION-PROCESSOR] Failed ${step.channel} to ${contact.name}: ${sendResult.error}`);
        }

      } catch (itemError: any) {
        console.error(`[AUTOMATION-PROCESSOR] Error processing item ${item.id}:`, itemError.message);
        results.failed++;
        results.errors.push(itemError.message);
        
        await supabase
          .from('automation_queue')
          .update({
            status: 'failed',
            error_message: itemError.message,
            processed_at: new Date().toISOString()
          })
          .eq('id', item.id);
      }
    }

    const processingTime = Date.now() - startTime;
    console.log(`[AUTOMATION-PROCESSOR] Completed in ${processingTime}ms:`, results);

    return new Response(
      JSON.stringify({ success: true, ...results, processingTime }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[AUTOMATION-PROCESSOR] Fatal error:', error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message, ...results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

async function markAsSkipped(supabase: any, itemId: string, reason: string) {
  await supabase
    .from('automation_queue')
    .update({
      status: 'skipped',
      error_message: reason,
      processed_at: new Date().toISOString()
    })
    .eq('id', itemId);
}

function replaceVariables(content: string, variables: Record<string, string>): string {
  let result = content;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`{{${key}}}`, 'gi'), value || '');
  }
  return result;
}

async function sendWhatsApp(
  supabase: any,
  params: { to: string; templateSid?: string; content: string; variables: Record<string, string> }
): Promise<{ success: boolean; externalId?: string; error?: string }> {
  try {
    if (!params.to) {
      return { success: false, error: 'No phone number' };
    }

    // Call the twilio-whatsapp-send edge function
    const { data, error } = await supabase.functions.invoke('twilio-whatsapp-send', {
      body: {
        to: params.to,
        templateSid: params.templateSid,
        body: params.content,
        variables: params.variables
      }
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: data?.success, externalId: data?.messageSid, error: data?.error };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

async function sendEmail(
  supabase: any,
  params: { to: string; name: string; subject: string; content: string; templateId?: string }
): Promise<{ success: boolean; externalId?: string; error?: string }> {
  try {
    if (!params.to) {
      return { success: false, error: 'No email address' };
    }

    // Call the activecampaign-send edge function
    const { data, error } = await supabase.functions.invoke('activecampaign-send', {
      body: {
        email: params.to,
        name: params.name,
        subject: params.subject,
        content: params.content,
        templateId: params.templateId
      }
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: data?.success, externalId: data?.messageId, error: data?.error };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
