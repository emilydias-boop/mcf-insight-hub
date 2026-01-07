import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const body = await req.json().catch(() => ({}));
    const { dry_run = false, limit = 100 } = body;

    console.log(`[repair-orphan-owners] Starting - dry_run: ${dry_run}, limit: ${limit}`);

    // 1. Buscar atividades reprocessadas sem owner
    const { data: activities, error: actError } = await supabase
      .from('deal_activities')
      .select('id, deal_id, metadata')
      .eq('activity_type', 'stage_changed')
      .not('metadata', 'is', null)
      .limit(500);

    if (actError) throw actError;

    // Filtrar apenas reprocessadas sem owner
    const orphanActivities = (activities || []).filter(a => {
      const meta = a.metadata as Record<string, any> | null;
      return meta?.reprocessed === true && !meta?.owner_email;
    });

    const orphanDealIds = [...new Set(orphanActivities.map(a => a.deal_id))];
    console.log(`[repair-orphan-owners] Found ${orphanDealIds.length} deals with orphan activities`);

    if (orphanDealIds.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No orphan deals found',
        deals_fixed: 0,
        activities_fixed: 0
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 2. Buscar os deals sem owner
    const { data: deals, error: dealsError } = await supabase
      .from('crm_deals')
      .select('id, clint_id, owner_id')
      .in('id', orphanDealIds)
      .is('owner_id', null);

    if (dealsError) throw dealsError;

    console.log(`[repair-orphan-owners] Found ${deals?.length || 0} deals without owner`);

    let dealsFixed = 0;
    let activitiesFixed = 0;
    let notFound = 0;
    const results: Array<{ deal_id: string; status: string; owner?: string }> = [];

    for (const deal of (deals || []).slice(0, limit)) {
      // 3. Buscar o owner original no webhook_events
      const { data: events, error: evError } = await supabase
        .from('webhook_events')
        .select('event_data')
        .or(`event_data->>deal_id.eq.${deal.clint_id},event_data->>dealId.eq.${deal.clint_id}`)
        .order('created_at', { ascending: false })
        .limit(5);

      if (evError) {
        console.error(`[repair-orphan-owners] Error fetching events for deal ${deal.id}:`, evError);
        continue;
      }

      // Procurar owner em qualquer evento
      let foundOwner: string | null = null;
      for (const ev of (events || [])) {
        const data = ev.event_data as Record<string, any>;
        foundOwner = data?.deal_user || data?.owner_email || data?.user_email || 
                     data?.deal?.user || data?.deal?.owner_email || null;
        if (foundOwner) break;
      }

      if (!foundOwner) {
        notFound++;
        results.push({ deal_id: deal.id, status: 'owner_not_found' });
        continue;
      }

      if (dry_run) {
        dealsFixed++;
        results.push({ deal_id: deal.id, status: 'would_fix', owner: foundOwner });
        continue;
      }

      // 4. Atualizar o deal com o owner encontrado
      const { error: updateDealError } = await supabase
        .from('crm_deals')
        .update({ owner_id: foundOwner })
        .eq('id', deal.id);

      if (updateDealError) {
        console.error(`[repair-orphan-owners] Error updating deal ${deal.id}:`, updateDealError);
        results.push({ deal_id: deal.id, status: 'error', owner: foundOwner });
        continue;
      }

      dealsFixed++;
      results.push({ deal_id: deal.id, status: 'fixed', owner: foundOwner });

      // 5. Atualizar as atividades desse deal
      const dealActivities = orphanActivities.filter(a => a.deal_id === deal.id);
      for (const act of dealActivities) {
        const meta = act.metadata as Record<string, any>;
        const { error: updateActError } = await supabase
          .from('deal_activities')
          .update({
            metadata: {
              ...meta,
              owner_email: foundOwner,
              deal_user: foundOwner,
              repaired_at: new Date().toISOString()
            }
          })
          .eq('id', act.id);

        if (!updateActError) activitiesFixed++;
      }
    }

    console.log(`[repair-orphan-owners] Complete - deals: ${dealsFixed}, activities: ${activitiesFixed}, not_found: ${notFound}`);

    return new Response(JSON.stringify({
      success: true,
      dry_run,
      deals_fixed: dealsFixed,
      activities_fixed: activitiesFixed,
      not_found: notFound,
      results: results.slice(0, 50)
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[repair-orphan-owners] Error:', error);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
