import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
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
    // GET - Diagnóstico
    if (req.method === 'GET') {
      console.log('[backfill] Running diagnostics...');

      // Contar webhooks candidatos (success com deal_old_stage e deal_stage)
      const { data: candidateWebhooks, error: webhookError } = await supabase
        .from('webhook_events')
        .select('id, event_type, event_data, created_at')
        .eq('status', 'success')
        .eq('event_type', 'deal.stage_changed')
        .order('created_at', { ascending: false })
        .limit(1000);

      if (webhookError) throw webhookError;

      // Filtrar apenas os que têm deal_old_stage e deal_stage
      const webhooksWithStages = (candidateWebhooks || []).filter(w => {
        const data = w.event_data as any;
        const oldStage = data?.deal_old_stage || data?.deal?.old_stage;
        const newStage = data?.deal_stage || data?.deal?.stage;
        return oldStage && newStage;
      });

      // Agrupar por stage
      const byStage: Record<string, number> = {};
      webhooksWithStages.forEach(w => {
        const data = w.event_data as any;
        const toStage = data?.deal_stage || data?.deal?.stage || 'unknown';
        byStage[toStage] = (byStage[toStage] || 0) + 1;
      });

      // Contar deals sem owner_id
      const { count: dealsWithoutOwner } = await supabase
        .from('crm_deals')
        .select('id', { count: 'exact', head: true })
        .is('owner_id', null);

      // Contar total de deals vs activities
      const { count: totalDeals } = await supabase
        .from('crm_deals')
        .select('id', { count: 'exact', head: true });

      const { count: totalActivities } = await supabase
        .from('deal_activities')
        .select('id', { count: 'exact', head: true })
        .eq('activity_type', 'stage_change');

      // Verificar quantos webhooks realmente precisam de activities
      let needsActivity = 0;
      const sampleMissing: any[] = [];

      for (const webhook of webhooksWithStages.slice(0, 100)) {
        const data = webhook.event_data as any;
        const dealClintId = data?.deal_id || data?.deal?.id;
        const toStage = data?.deal_stage || data?.deal?.stage;

        if (!dealClintId || !toStage) continue;

        // Buscar deal
        const { data: deal } = await supabase
          .from('crm_deals')
          .select('id')
          .eq('clint_id', dealClintId)
          .maybeSingle();

        if (!deal) {
          needsActivity++;
          if (sampleMissing.length < 5) {
            sampleMissing.push({ type: 'deal_missing', clint_id: dealClintId, to_stage: toStage });
          }
          continue;
        }

        // Verificar se já existe activity
        const { data: existingActivity } = await supabase
          .from('deal_activities')
          .select('id')
          .eq('deal_id', deal.id)
          .eq('activity_type', 'stage_change')
          .eq('to_stage', toStage)
          .maybeSingle();

        if (!existingActivity) {
          needsActivity++;
          if (sampleMissing.length < 5) {
            sampleMissing.push({ type: 'activity_missing', deal_id: deal.id, to_stage: toStage });
          }
        }
      }

      return new Response(JSON.stringify({
        success: true,
        diagnostics: {
          total_webhooks_with_stages: webhooksWithStages.length,
          by_stage: byStage,
          deals_without_owner: dealsWithoutOwner || 0,
          total_deals: totalDeals || 0,
          total_stage_change_activities: totalActivities || 0,
          sample_checked: 100,
          needs_activity_in_sample: needsActivity,
          sample_missing: sampleMissing,
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // POST - Reprocessamento
    if (req.method === 'POST') {
      const body = await req.json();
      const dryRun = body.dry_run ?? true;
      const limit = Math.min(body.limit ?? 100, 500);
      const stageFilter = body.stage_filter || null;
      const dateFrom = body.date_from || null;

      console.log(`[backfill] Starting backfill: dry_run=${dryRun}, limit=${limit}, stage_filter=${stageFilter}`);

      // Buscar webhooks candidatos
      let query = supabase
        .from('webhook_events')
        .select('id, event_type, event_data, created_at')
        .eq('status', 'success')
        .eq('event_type', 'deal.stage_changed')
        .order('created_at', { ascending: true })
        .limit(limit * 2); // Buscar mais para filtrar depois

      if (dateFrom) {
        query = query.gte('created_at', dateFrom);
      }

      const { data: webhooks, error: webhookError } = await query;
      if (webhookError) throw webhookError;

      // Filtrar webhooks com dados completos
      let filteredWebhooks = (webhooks || []).filter(w => {
        const data = w.event_data as any;
        const oldStage = data?.deal_old_stage || data?.deal?.old_stage;
        const newStage = data?.deal_stage || data?.deal?.stage;
        
        if (!oldStage || !newStage) return false;
        if (stageFilter && newStage !== stageFilter) return false;
        return true;
      }).slice(0, limit);

      const results = {
        processed: 0,
        activities_created: 0,
        owners_updated: 0,
        deals_created: 0,
        contacts_created: 0,
        skipped: 0,
        errors: [] as any[],
        details: [] as any[],
      };

      for (const webhook of filteredWebhooks) {
        try {
          const data = webhook.event_data as any;
          const result = await processWebhook(supabase, data, dryRun);
          
          results.processed++;
          if (result.activity_created) results.activities_created++;
          if (result.owner_updated) results.owners_updated++;
          if (result.deal_created) results.deals_created++;
          if (result.contact_created) results.contacts_created++;
          if (result.skipped) results.skipped++;

          if (results.details.length < 20) {
            results.details.push({
              webhook_id: webhook.id,
              ...result
            });
          }
        } catch (err: any) {
          console.error(`[backfill] Error processing webhook ${webhook.id}:`, err);
          results.errors.push({
            webhook_id: webhook.id,
            error: err.message
          });
        }
      }

      console.log(`[backfill] Completed: ${JSON.stringify(results)}`);

      return new Response(JSON.stringify({
        success: true,
        dry_run: dryRun,
        results,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('[backfill] Error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function processWebhook(supabase: any, eventData: any, dryRun: boolean) {
  const result = {
    activity_created: false,
    owner_updated: false,
    deal_created: false,
    contact_created: false,
    skipped: false,
    reason: '',
    deal_id: '',
    from_stage: '',
    to_stage: '',
  };

  // Extrair dados do webhook
  const dealClintId = eventData?.deal_id || eventData?.deal?.id;
  const fromStage = eventData?.deal_old_stage || eventData?.deal?.old_stage;
  const toStage = eventData?.deal_stage || eventData?.deal?.stage;
  const ownerEmail = eventData?.deal_user || eventData?.deal?.user?.email || eventData?.user?.email;

  result.from_stage = fromStage || '';
  result.to_stage = toStage || '';

  if (!dealClintId) {
    result.skipped = true;
    result.reason = 'No deal_id in webhook';
    return result;
  }

  // Buscar deal existente
  const { data: existingDeal } = await supabase
    .from('crm_deals')
    .select('id, owner_id, name, contact_id')
    .eq('clint_id', dealClintId)
    .maybeSingle();

  let dealId = existingDeal?.id;

  // Se deal não existe, criar
  if (!existingDeal) {
    const contactData = extractContactData(eventData);
    
    // Buscar ou criar contato
    let contactId = null;
    if (contactData.clint_id) {
      const { data: existingContact } = await supabase
        .from('crm_contacts')
        .select('id')
        .eq('clint_id', contactData.clint_id)
        .maybeSingle();

      if (existingContact) {
        contactId = existingContact.id;
      } else if (!dryRun && contactData.name) {
        const { data: newContact, error: contactError } = await supabase
          .from('crm_contacts')
          .insert({
            clint_id: contactData.clint_id,
            name: contactData.name,
            email: contactData.email,
            phone: contactData.phone,
          })
          .select('id')
          .single();

        if (!contactError && newContact) {
          contactId = newContact.id;
          result.contact_created = true;
        }
      }
    }

    // Criar deal
    if (!dryRun) {
      const dealName = eventData?.deal?.name || eventData?.contact?.name || contactData.name || 'Deal sem nome';
      
      // Buscar stage_id
      let stageId = null;
      if (toStage) {
        const { data: stage } = await supabase
          .from('crm_stages')
          .select('id')
          .eq('stage_name', toStage)
          .maybeSingle();
        stageId = stage?.id;
      }

      // Buscar origin_id
      let originId = null;
      const originClintId = eventData?.deal?.origin?.id || eventData?.origin?.id;
      if (originClintId) {
        const { data: origin } = await supabase
          .from('crm_origins')
          .select('id')
          .eq('clint_id', originClintId)
          .maybeSingle();
        originId = origin?.id;
      }

      const { data: newDeal, error: dealError } = await supabase
        .from('crm_deals')
        .insert({
          clint_id: dealClintId,
          name: dealName,
          contact_id: contactId,
          stage_id: stageId,
          origin_id: originId,
          owner_id: ownerEmail,
        })
        .select('id')
        .single();

      if (!dealError && newDeal) {
        dealId = newDeal.id;
        result.deal_created = true;
      }
    } else {
      result.deal_created = true; // Would create
      result.reason = 'Deal would be created (dry run)';
      return result;
    }
  }

  if (!dealId) {
    result.skipped = true;
    result.reason = 'Could not find or create deal';
    return result;
  }

  result.deal_id = dealId;

  // Atualizar owner_id se vazio
  if (existingDeal && !existingDeal.owner_id && ownerEmail) {
    if (!dryRun) {
      await supabase
        .from('crm_deals')
        .update({ owner_id: ownerEmail })
        .eq('id', dealId);
    }
    result.owner_updated = true;
  }

  // Verificar se activity já existe
  if (toStage) {
    const { data: existingActivity } = await supabase
      .from('deal_activities')
      .select('id')
      .eq('deal_id', dealId)
      .eq('activity_type', 'stage_change')
      .eq('to_stage', toStage)
      .maybeSingle();

    if (existingActivity) {
      result.skipped = true;
      result.reason = 'Activity already exists for this stage';
      return result;
    }

    // Criar activity
    if (!dryRun) {
      const contactName = eventData?.contact?.name || eventData?.deal?.contact?.name || '';
      const contactPhone = eventData?.contact?.phone || eventData?.deal?.contact?.phone || '';

      const { error: activityError } = await supabase
        .from('deal_activities')
        .insert({
          deal_id: dealId,
          activity_type: 'stage_change',
          from_stage: fromStage,
          to_stage: toStage,
          description: `Deal movido de ${fromStage} para ${toStage}`,
          metadata: {
            deal_user: ownerEmail,
            owner_email: ownerEmail,
            backfilled: true,
            contact_name: contactName,
            contact_phone: contactPhone,
          }
        });

      if (!activityError) {
        result.activity_created = true;
      }
    } else {
      result.activity_created = true; // Would create
    }
  }

  return result;
}

function extractContactData(eventData: any) {
  const contact = eventData?.contact || eventData?.deal?.contact || {};
  return {
    clint_id: contact.id || '',
    name: contact.name || '',
    email: contact.email || '',
    phone: contact.phone || contact.cellphone || '',
  };
}
