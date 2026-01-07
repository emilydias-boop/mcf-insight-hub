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
    const { dry_run = false, limit = 500 } = body;

    console.log(`[fix-activities] Starting fix - dry_run: ${dry_run}, limit: ${limit}`);

    // Buscar atividades reprocessadas que não têm owner_email no metadata
    const { data: activities, error: fetchError } = await supabase
      .from('deal_activities')
      .select('id, deal_id, metadata')
      .eq('activity_type', 'stage_changed')
      .not('metadata', 'is', null)
      .limit(limit);

    if (fetchError) throw fetchError;

    // Filtrar apenas atividades reprocessadas sem owner
    const activitiesToFix = (activities || []).filter(a => {
      const metadata = a.metadata as Record<string, any> | null;
      return metadata?.reprocessed === true && !metadata?.owner_email;
    });

    console.log(`[fix-activities] Found ${activitiesToFix.length} activities to fix`);

    if (activitiesToFix.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No activities need fixing',
        fixed: 0,
        skipped: 0,
        errors: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Buscar os deals correspondentes para obter o owner_id
    const dealIds = [...new Set(activitiesToFix.map(a => a.deal_id))];
    const { data: deals, error: dealsError } = await supabase
      .from('crm_deals')
      .select('id, owner_id, clint_id')
      .in('id', dealIds);

    if (dealsError) throw dealsError;

    const dealMap = new Map((deals || []).map(d => [d.id, { owner_id: d.owner_id, clint_id: d.clint_id }]));

    let fixed = 0;
    let skipped = 0;
    let errors = 0;
    const results: Array<{ id: string; status: string; owner?: string; source?: string }> = [];

    for (const activity of activitiesToFix) {
      const dealInfo = dealMap.get(activity.deal_id);
      let ownerEmail = dealInfo?.owner_id || null;
      let ownerSource = 'deal';

      // Fallback: buscar owner no webhook_events se o deal não tem owner
      if (!ownerEmail && dealInfo?.clint_id) {
        const { data: events } = await supabase
          .from('webhook_events')
          .select('event_data')
          .or(`event_data->>deal_id.eq.${dealInfo.clint_id},event_data->>dealId.eq.${dealInfo.clint_id}`)
          .order('created_at', { ascending: false })
          .limit(3);

        for (const ev of (events || [])) {
          const data = ev.event_data as Record<string, any>;
          ownerEmail = data?.deal_user || data?.owner_email || data?.user_email || 
                       data?.deal?.user || data?.deal?.owner_email || null;
          if (ownerEmail) {
            ownerSource = 'webhook';
            break;
          }
        }
      }
      
      if (!ownerEmail) {
        skipped++;
        results.push({ id: activity.id, status: 'skipped', owner: 'null' });
        continue;
      }

      if (dry_run) {
        fixed++;
        results.push({ id: activity.id, status: 'would_fix', owner: ownerEmail });
        continue;
      }

      const currentMetadata = activity.metadata as Record<string, any>;
      const newMetadata = {
        ...currentMetadata,
        owner_email: ownerEmail,
        deal_user: ownerEmail,
        fixed_at: new Date().toISOString()
      };

      const { error: updateError } = await supabase
        .from('deal_activities')
        .update({ metadata: newMetadata })
        .eq('id', activity.id);

      if (updateError) {
        console.error(`[fix-activities] Error updating activity ${activity.id}:`, updateError);
        errors++;
        results.push({ id: activity.id, status: 'error', owner: ownerEmail });
      } else {
        fixed++;
        results.push({ id: activity.id, status: 'fixed', owner: ownerEmail });
      }
    }

    console.log(`[fix-activities] Complete - fixed: ${fixed}, skipped: ${skipped}, errors: ${errors}`);

    return new Response(JSON.stringify({
      success: true,
      dry_run,
      total: activitiesToFix.length,
      fixed,
      skipped,
      errors,
      results: results.slice(0, 50) // Limitar resultados retornados
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[fix-activities] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
