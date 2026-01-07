// Reprocess Missing Activities - Version 2025-12-27
// Cria activities retroativamente para webhooks de R1 Agendada sem deal_activities correspondentes
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('[REPROCESS] Starting missing activities reprocessing');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    // Parâmetros opcionais do body
    const body = await req.json().catch(() => ({}));
    const dryRun = body.dry_run ?? false;
    const limitDays = body.limit_days ?? 30;

    console.log('[REPROCESS] Mode:', dryRun ? 'DRY RUN' : 'EXECUTE');
    console.log('[REPROCESS] Looking back:', limitDays, 'days');

    // 1. Buscar webhooks de R1 Agendada que NÃO têm activities correspondentes
    const { data: missingActivities, error: queryError } = await supabase
      .from('webhook_events')
      .select('*')
      .eq('event_type', 'deal.stage_changed')
      .eq('status', 'success')
      .gte('created_at', new Date(Date.now() - limitDays * 24 * 60 * 60 * 1000).toISOString())
      .or('event_data->deal_stage.ilike.%Reunião 01 Agendada%,event_data->deal_stage.ilike.%R1 Agendada%')
      .order('created_at', { ascending: true });

    if (queryError) {
      console.error('[REPROCESS] Error querying webhooks:', queryError);
      throw queryError;
    }

    console.log('[REPROCESS] Found', missingActivities?.length || 0, 'R1 Agendada webhooks');

    const results = {
      total_webhooks: missingActivities?.length || 0,
      processed: 0,
      created: 0,
      skipped: 0,
      errors: 0,
      details: [] as any[]
    };

    for (const webhook of missingActivities || []) {
      const eventData = webhook.event_data;
      const contactEmail = eventData.contact_email;
      const dealStage = eventData.deal_stage;
      const dealUser = eventData.deal_user;
      const webhookDate = webhook.created_at;

      results.processed++;

      // 2. Buscar o deal pelo email do contato
      if (!contactEmail) {
        console.log('[REPROCESS] Skipping webhook without contact_email');
        results.skipped++;
        results.details.push({ webhook_id: webhook.id, status: 'no_email' });
        continue;
      }

      // Buscar contato pelo email
      const { data: contact } = await supabase
        .from('crm_contacts')
        .select('id')
        .ilike('email', contactEmail)
        .maybeSingle();

      if (!contact) {
        console.log('[REPROCESS] Contact not found:', contactEmail);
        results.skipped++;
        results.details.push({ webhook_id: webhook.id, email: contactEmail, status: 'contact_not_found' });
        continue;
      }

      // Buscar deal pelo contact_id
      const { data: deal } = await supabase
        .from('crm_deals')
        .select('id, name')
        .eq('contact_id', contact.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!deal) {
        console.log('[REPROCESS] Deal not found for contact:', contactEmail);
        results.skipped++;
        results.details.push({ webhook_id: webhook.id, email: contactEmail, status: 'deal_not_found' });
        continue;
      }

      // 3. Verificar se já existe activity para este deal na mesma data/hora (tolerância de 5 minutos)
      const webhookTime = new Date(webhookDate).getTime();
      const timeWindowStart = new Date(webhookTime - 5 * 60 * 1000).toISOString();
      const timeWindowEnd = new Date(webhookTime + 5 * 60 * 1000).toISOString();

      const { data: existingActivity } = await supabase
        .from('deal_activities')
        .select('id')
        .eq('deal_id', deal.id)
        .eq('activity_type', 'stage_change')
        .ilike('to_stage', '%Agendada%')
        .gte('created_at', timeWindowStart)
        .lte('created_at', timeWindowEnd)
        .maybeSingle();

      if (existingActivity) {
        console.log('[REPROCESS] Activity already exists for deal:', deal.id);
        results.skipped++;
        results.details.push({ 
          webhook_id: webhook.id, 
          deal_id: deal.id, 
          status: 'already_exists',
          existing_activity: existingActivity.id
        });
        continue;
      }

      // 4. Criar a activity faltante
      if (dryRun) {
        console.log('[REPROCESS] DRY RUN - Would create activity for deal:', deal.id);
        results.created++;
        results.details.push({ 
          webhook_id: webhook.id, 
          deal_id: deal.id, 
          deal_name: deal.name,
          owner: dealUser,
          date: webhookDate,
          status: 'would_create' 
        });
      } else {
        const { error: insertError } = await supabase
          .from('deal_activities')
          .insert({
            deal_id: deal.id,
            activity_type: 'stage_change',
            description: `Deal movido de ${eventData.deal_old_stage || 'desconhecido'} para ${dealStage}`,
            from_stage: eventData.deal_old_stage || null,
            to_stage: dealStage,
            created_at: webhookDate, // Usar a data original do webhook
            metadata: {
              deal_id: eventData.deal_id,
              owner_email: dealUser,
              deal_user: dealUser,
              deal_origin: eventData.deal_origin,
              contact_email: contactEmail,
              contact_name: eventData.contact_name,
              reprocessed: true,
              original_webhook_id: webhook.id
            }
          });

        if (insertError) {
          console.error('[REPROCESS] Error creating activity:', insertError);
          results.errors++;
          results.details.push({ 
            webhook_id: webhook.id, 
            deal_id: deal.id, 
            status: 'error',
            error: insertError.message
          });
        } else {
          console.log('[REPROCESS] Created activity for deal:', deal.id, 'owner:', dealUser);
          results.created++;
          results.details.push({ 
            webhook_id: webhook.id, 
            deal_id: deal.id, 
            deal_name: deal.name,
            owner: dealUser,
            date: webhookDate,
            status: 'created' 
          });
        }
      }
    }

    console.log('[REPROCESS] Completed:', JSON.stringify({
      total: results.total_webhooks,
      created: results.created,
      skipped: results.skipped,
      errors: results.errors
    }));

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[REPROCESS] Error:', error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
