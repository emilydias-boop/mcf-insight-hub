import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function normalizePhone(phone: string): string {
  if (!phone) return '';
  let normalized = phone.replace(/\D/g, '');
  if (normalized.startsWith('0')) {
    normalized = normalized.substring(1);
  }
  if (!normalized.startsWith('55') && normalized.length <= 11) {
    normalized = '55' + normalized;
  }
  return normalized;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    // GET - List failed webhooks
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const daysBack = parseInt(url.searchParams.get('days_back') || '7');
      
      console.log(`[reprocess] GET - Listing failed webhooks from last ${daysBack} days`);
      
      const { data: failedWebhooks, error } = await supabase
        .from('webhook_events')
        .select('id, event_type, event_data, status, error_message, created_at')
        .eq('status', 'error')
        .gte('created_at', new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      return new Response(JSON.stringify({
        success: true,
        days_back: daysBack,
        count: failedWebhooks?.length || 0,
        webhooks: failedWebhooks
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // POST - Reprocess webhooks
    if (req.method === 'POST') {
      const url = new URL(req.url);
      const urlAll = url.searchParams.get('all') === 'true';
      const body = await req.json().catch(() => ({}));
      const { webhook_id, webhook_ids, dry_run = false, all: bodyAll, days_back = 7, year_month } = body;
      
      // Accept 'all' from querystring OR body
      const reprocessAll = urlAll || bodyAll === true;

      console.log(`[reprocess] Request received - urlAll: ${urlAll}, bodyAll: ${bodyAll}, reprocessAll: ${reprocessAll}, days_back: ${days_back}, year_month: ${year_month}`);

      let webhooksToProcess = [];

      if (reprocessAll || year_month) {
        let query = supabase
          .from('webhook_events')
          .select('*')
          .eq('status', 'error');
        
        // If year_month is provided, filter by that specific month
        if (year_month) {
          const [year, month] = year_month.split('-');
          const startDate = `${year}-${month}-01T00:00:00.000Z`;
          const nextMonth = parseInt(month) === 12 ? 1 : parseInt(month) + 1;
          const nextYear = parseInt(month) === 12 ? parseInt(year) + 1 : parseInt(year);
          const endDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01T00:00:00.000Z`;
          
          console.log(`[reprocess] Filtering by month: ${startDate} to ${endDate}`);
          query = query.gte('created_at', startDate).lt('created_at', endDate);
        } else {
          // Use days_back filter
          query = query.gte('created_at', new Date(Date.now() - days_back * 24 * 60 * 60 * 1000).toISOString());
        }
        
        const { data, error } = await query
          .order('created_at', { ascending: true })
          .limit(500);
        if (error) throw error;
        webhooksToProcess = data || [];
      } else if (webhook_ids && Array.isArray(webhook_ids)) {
        const { data, error } = await supabase
          .from('webhook_events')
          .select('*')
          .in('id', webhook_ids);
        if (error) throw error;
        webhooksToProcess = data || [];
      } else if (webhook_id) {
        const { data, error } = await supabase
          .from('webhook_events')
          .select('*')
          .eq('id', webhook_id)
          .single();
        if (error) throw error;
        webhooksToProcess = data ? [data] : [];
      } else {
        return new Response(JSON.stringify({
          success: false,
          error: 'Provide webhook_id, webhook_ids array, or ?all=true'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log(`[reprocess] Processing ${webhooksToProcess.length} webhooks (dry_run: ${dry_run})`);

      const results = [];
      for (const webhook of webhooksToProcess) {
        try {
          const result = await reprocessWebhook(supabase, webhook, dry_run);
          results.push({ id: webhook.id, ...result });
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          console.error(`[reprocess] Error processing webhook ${webhook.id}:`, err);
          results.push({ id: webhook.id, success: false, error: errorMessage });
        }
      }

      const successCount = results.filter(r => r.success).length;
      const errorCount = results.filter(r => !r.success).length;

      return new Response(JSON.stringify({
        success: true,
        dry_run,
        total: webhooksToProcess.length,
        processed: successCount,
        errors: errorCount,
        results
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[reprocess] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function reprocessWebhook(supabase: any, webhook: any, dryRun: boolean) {
  const eventData = webhook.event_data;
  const eventType = webhook.event_type;

  console.log(`[reprocess] Processing webhook ${webhook.id}, type: ${eventType}`);

  // Extract contact data from various possible locations in payload
  const contactData = extractContactData(eventData);
  console.log(`[reprocess] Contact data extracted:`, JSON.stringify(contactData));

  if (!contactData.name && !contactData.email && !contactData.phone) {
    return { success: false, error: 'No contact data found in webhook payload' };
  }

  // Find or create contact
  const contact = await findOrCreateContact(supabase, contactData, dryRun);
  if (!contact) {
    return { success: false, error: 'Could not find or create contact' };
  }
  console.log(`[reprocess] Contact resolved: ${contact.id} (${contact.created ? 'created' : 'found'})`);

  // Handle deal events
  if (eventType?.includes('deal') || eventData.deal_id || eventData.deal) {
    const dealResult = await handleDealEvent(supabase, eventData, contact.id, dryRun);
    if (!dealResult.success) {
      return dealResult;
    }

    // Update webhook status
    if (!dryRun) {
      await supabase.from('webhook_events').update({
        status: 'success',
        error_message: null,
        processed_at: new Date().toISOString()
      }).eq('id', webhook.id);
    }

    return {
      success: true,
      contact_id: contact.id,
      contact_created: contact.created,
      deal_id: dealResult.deal_id,
      deal_created: dealResult.created,
      activity_created: dealResult.activity_created
    };
  }

  return { success: false, error: `Unknown event type: ${eventType}` };
}

function extractContactData(data: any) {
  // Try multiple paths to find contact info
  const contact = data.contact || data.deal?.contact || {};
  
  return {
    clint_id: contact.id || data.contact_id || data.deal?.contact_id || null,
    name: contact.name || data.contact_name || data.deal?.contact_name || 'Contato sem nome',
    email: contact.email || data.contact_email || data.deal?.contact_email || null,
    phone: contact.phone || data.contact_phone || data.deal?.contact_phone || 
           contact.complete_phone || data.complete_phone || null,
    tags: contact.tags || data.tags || [],
  };
}

async function findOrCreateContact(supabase: any, contactData: any, dryRun: boolean) {
  // Try to find by clint_id first
  if (contactData.clint_id) {
    const { data: byClintId } = await supabase
      .from('crm_contacts')
      .select('id')
      .eq('clint_id', contactData.clint_id)
      .maybeSingle();
    
    if (byClintId) {
      return { id: byClintId.id, created: false };
    }
  }

  // Try to find by email
  if (contactData.email) {
    const { data: byEmail } = await supabase
      .from('crm_contacts')
      .select('id')
      .ilike('email', contactData.email)
      .maybeSingle();
    
    if (byEmail) {
      return { id: byEmail.id, created: false };
    }
  }

  // Try to find by phone
  if (contactData.phone) {
    const normalizedPhone = normalizePhone(contactData.phone);
    const { data: byPhone } = await supabase
      .from('crm_contacts')
      .select('id')
      .eq('phone', normalizedPhone)
      .maybeSingle();
    
    if (byPhone) {
      return { id: byPhone.id, created: false };
    }
  }

  // Create new contact if not dry run
  if (dryRun) {
    return { id: 'dry-run-contact-id', created: true };
  }

  const newContactData = {
    clint_id: contactData.clint_id || `reprocessed-${Date.now()}`,
    name: contactData.name || 'Contato sem nome',
    email: contactData.email || null,
    phone: contactData.phone ? normalizePhone(contactData.phone) : null,
    tags: contactData.tags || [],
  };

  console.log(`[reprocess] Creating new contact:`, JSON.stringify(newContactData));

  const { data: newContact, error } = await supabase
    .from('crm_contacts')
    .insert(newContactData)
    .select('id')
    .single();

  if (error) {
    console.error('[reprocess] Error creating contact:', error);
    return null;
  }

  return { id: newContact.id, created: true };
}

async function handleDealEvent(supabase: any, eventData: any, contactId: string, dryRun: boolean) {
  const deal = eventData.deal || eventData;
  const dealClintId = deal.id || deal.deal_id || eventData.deal_id;

  if (!dealClintId) {
    return { success: false, error: 'No deal ID found in event data' };
  }

  // Check if deal already exists
  const { data: existingDeal } = await supabase
    .from('crm_deals')
    .select('id')
    .eq('clint_id', dealClintId)
    .maybeSingle();

  let dealId = existingDeal?.id;
  let dealCreated = false;

  if (!existingDeal) {
    if (dryRun) {
      dealId = 'dry-run-deal-id';
      dealCreated = true;
    } else {
      // Find origin_id from event data
      let originId = null;
      const originClintId = deal.origin_id || deal.origin?.id || eventData.origin_id;
      const originName = eventData.deal_origin || deal.origin || deal.origin_name;
      
      if (originClintId) {
        const { data: origin } = await supabase
          .from('crm_origins')
          .select('id')
          .eq('clint_id', originClintId)
          .maybeSingle();
        originId = origin?.id;
        console.log(`[reprocess] Origin by clint_id '${originClintId}': ${originId}`);
      }
      
      // Fallback: buscar origin pelo nome
      if (!originId && originName) {
        const { data: origin } = await supabase
          .from('crm_origins')
          .select('id')
          .ilike('name', originName)
          .maybeSingle();
        originId = origin?.id;
        console.log(`[reprocess] Origin by name '${originName}': ${originId}`);
      }

      // Find stage_id from event data
      let stageId = null;
      const stageName = eventData.deal_stage || deal.stage || eventData.to_stage || eventData.stage_to;
      const stageClintId = deal.stage_id || eventData.to_stage_id;
      
      if (stageClintId) {
        const { data: stage } = await supabase
          .from('crm_stages')
          .select('id')
          .eq('clint_id', stageClintId)
          .maybeSingle();
        stageId = stage?.id;
        console.log(`[reprocess] Stage by clint_id '${stageClintId}': ${stageId}`);
      }
      
      // Fallback: buscar stage pelo nome dentro do origin
      if (!stageId && stageName && originId) {
        const { data: stage } = await supabase
          .from('crm_stages')
          .select('id')
          .eq('origin_id', originId)
          .ilike('stage_name', `%${stageName}%`)
          .maybeSingle();
        stageId = stage?.id;
        console.log(`[reprocess] Stage by name '${stageName}' in origin ${originId}: ${stageId}`);
      }

      // owner_id armazena o email diretamente (campo TEXT)
      // Tentar múltiplos caminhos para extrair o email do SDR
      const ownerId = eventData.deal_user || 
                      deal.user_email || 
                      deal.owner_email || 
                      eventData.responsible_email ||
                      eventData.assigned_to ||
                      deal.responsible?.email ||
                      deal.user?.email ||
                      eventData.user?.email ||
                      null;
      console.log(`[reprocess] Owner email extracted: ${ownerId}`);

      const newDealData = {
        clint_id: dealClintId,
        name: deal.name || deal.contact_name || eventData.contact_name || 'Deal sem nome',
        contact_id: contactId,
        origin_id: originId,
        stage_id: stageId,
        owner_id: ownerId,
        value: deal.value || 0,
        custom_fields: deal.custom_fields || eventData.custom_fields || {},
        tags: deal.tags || eventData.tags || [],
      };

      console.log(`[reprocess] Creating new deal:`, JSON.stringify(newDealData));

      const { data: newDeal, error } = await supabase
        .from('crm_deals')
        .insert(newDealData)
        .select('id')
        .single();

      if (error) {
        console.error('[reprocess] Error creating deal:', error);
        return { success: false, error: `Failed to create deal: ${error.message}` };
      }

      dealId = newDeal.id;
      dealCreated = true;
    }
  }

  // Create activity for stage change
  let activityCreated = false;
  const fromStage = eventData.from_stage || eventData.stage_from || eventData.deal_old_stage || deal?.old_stage;
  const toStage = eventData.to_stage || eventData.stage_to || eventData.deal_stage || deal?.stage;

  if (toStage && dealId && !dryRun) {
    // Extrair owner_email para incluir no metadata da atividade (importante para métricas de SDR)
    const ownerEmail = eventData.deal_user || 
                       deal.user_email || 
                       deal.owner_email || 
                       eventData.responsible_email ||
                       eventData.assigned_to ||
                       deal.responsible?.email ||
                       deal.user?.email ||
                       eventData.user?.email ||
                       null;
    
    console.log(`[reprocess] Creating activity with owner_email: ${ownerEmail}`);

    const { error: activityError } = await supabase
      .from('deal_activities')
      .insert({
        deal_id: dealId,
        activity_type: 'stage_changed',
        from_stage: fromStage || null,
        to_stage: toStage,
        description: `Reprocessado: ${fromStage || 'N/A'} → ${toStage}`,
        metadata: {
          reprocessed: true,
          original_webhook_created_at: eventData.created_at || new Date().toISOString(),
          owner_email: ownerEmail,
          deal_user: ownerEmail
        }
      });

    if (!activityError) {
      activityCreated = true;
    } else {
      console.warn('[reprocess] Failed to create activity:', activityError);
    }
  }

  return {
    success: true,
    deal_id: dealId,
    created: dealCreated,
    activity_created: activityCreated
  };
}
