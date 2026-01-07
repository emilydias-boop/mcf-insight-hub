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
    const body = req.method === 'POST' ? await req.json() : {};
    const dryRun = body.dry_run ?? true;
    const limit = Math.min(body.limit ?? 500, 2000);

    console.log(`[repair-activity-owners] Starting: dry_run=${dryRun}, limit=${limit}`);

    // Find activities missing owner_email where deal has owner_id
    const { data: activitiesToFix, error: queryError } = await supabase.rpc(
      'get_activities_missing_owner',
      { p_limit: limit }
    );

    // If RPC doesn't exist, fallback to raw query via select
    let activities = activitiesToFix;
    
    if (queryError || !activities) {
      console.log('[repair-activity-owners] RPC not available, using manual query');
      
      // Get all stage_change activities
      const { data: allActivities, error: actError } = await supabase
        .from('deal_activities')
        .select('id, deal_id, metadata, activity_type')
        .eq('activity_type', 'stage_change')
        .limit(limit * 2);

      if (actError) throw actError;

      // Filter those missing owner_email/deal_user
      const candidateActivities = (allActivities || []).filter(a => {
        const metadata = a.metadata as any || {};
        const ownerEmail = metadata.owner_email || metadata.deal_user;
        return !ownerEmail;
      });

      console.log(`[repair-activity-owners] Found ${candidateActivities.length} activities missing owner`);

      // Get deal owners for these activities - deal_id in activities is TEXT, id in deals is UUID
      const dealIds = [...new Set(candidateActivities.map(a => a.deal_id))];
      
      // Fetch deals - need to handle UUID comparison
      const { data: deals, error: dealsError } = await supabase
        .from('crm_deals')
        .select('id, owner_id')
        .not('owner_id', 'is', null);

      if (dealsError) throw dealsError;

      // Create map with string keys for proper comparison (deal_id in activities is TEXT)
      const dealOwnerMap = new Map((deals || []).map(d => [String(d.id), d.owner_id]));

      console.log(`[repair-activity-owners] Deal owner map size: ${dealOwnerMap.size}`);
      console.log(`[repair-activity-owners] Sample deal IDs from activities: ${dealIds.slice(0, 3).join(', ')}`);

      // Build list of activities to fix
      activities = candidateActivities
        .map(a => {
          const ownerId = dealOwnerMap.get(String(a.deal_id));
          if (!ownerId) return null;
          return {
            activity_id: a.id,
            deal_id: a.deal_id,
            owner_id: ownerId,
            current_metadata: a.metadata,
          };
        })
        .filter(Boolean)
        .slice(0, limit);
    }

    console.log(`[repair-activity-owners] Activities to fix: ${activities?.length || 0}`);

    const results = {
      total_found: activities?.length || 0,
      updated: 0,
      skipped: 0,
      errors: [] as any[],
      sample: [] as any[],
    };

    if (!activities || activities.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        dry_run: dryRun,
        message: 'No activities need repair',
        results,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    for (const activity of activities) {
      try {
        const currentMetadata = (activity.current_metadata as any) || {};
        const newMetadata = {
          ...currentMetadata,
          owner_email: activity.owner_id,
          deal_user: activity.owner_id,
          repaired_at: new Date().toISOString(),
        };

        if (!dryRun) {
          const { error: updateError } = await supabase
            .from('deal_activities')
            .update({ metadata: newMetadata })
            .eq('id', activity.activity_id);

          if (updateError) {
            results.errors.push({
              activity_id: activity.activity_id,
              error: updateError.message,
            });
            continue;
          }
        }

        results.updated++;
        
        if (results.sample.length < 10) {
          results.sample.push({
            activity_id: activity.activity_id,
            deal_id: activity.deal_id,
            owner_id: activity.owner_id,
          });
        }
      } catch (err: any) {
        results.errors.push({
          activity_id: activity.activity_id,
          error: err.message,
        });
      }
    }

    console.log(`[repair-activity-owners] Completed: updated=${results.updated}, errors=${results.errors.length}`);

    return new Response(JSON.stringify({
      success: true,
      dry_run: dryRun,
      results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('[repair-activity-owners] Error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
