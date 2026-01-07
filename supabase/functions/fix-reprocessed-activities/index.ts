// Fix reprocessed activities - Corrects created_at dates using metadata
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('[FIX-ACTIVITIES] Starting...');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const { dry_run = true } = await req.json().catch(() => ({ dry_run: true }));
    
    console.log('[FIX-ACTIVITIES] Mode:', dry_run ? 'DRY RUN' : 'EXECUTE');

    // Step 1: Find activities with wrong dates
    // Activities created on/after 2026-01-05 but metadata shows December 2025 or earlier
    const { data: wrongDateActivities, error: fetchError } = await supabase
      .from('deal_activities')
      .select('id, deal_id, activity_type, from_stage, to_stage, created_at, metadata')
      .gte('created_at', '2026-01-05T00:00:00Z')
      .eq('activity_type', 'stage_change')
      .not('metadata->deal_updated_stage_at', 'is', null);

    if (fetchError) throw fetchError;

    console.log('[FIX-ACTIVITIES] Found activities with metadata date:', wrongDateActivities?.length || 0);

    // Filter activities where metadata date is before January 2026
    const activitiesToFix = (wrongDateActivities || []).filter(activity => {
      const metadataDate = activity.metadata?.deal_updated_stage_at;
      if (!metadataDate) return false;
      
      try {
        const originalDate = new Date(metadataDate);
        const jan2026 = new Date('2026-01-01T00:00:00Z');
        return originalDate < jan2026;
      } catch {
        return false;
      }
    });

    console.log('[FIX-ACTIVITIES] Activities with December dates:', activitiesToFix.length);

    // Step 2: Fix dates
    const fixedActivities: any[] = [];
    const errors: any[] = [];

    for (const activity of activitiesToFix) {
      const originalDate = activity.metadata?.deal_updated_stage_at;
      
      if (!dry_run) {
        const { error: updateError } = await supabase
          .from('deal_activities')
          .update({ created_at: originalDate })
          .eq('id', activity.id);

        if (updateError) {
          errors.push({ id: activity.id, error: updateError.message });
        } else {
          fixedActivities.push({
            id: activity.id,
            deal_id: activity.deal_id,
            old_date: activity.created_at,
            new_date: originalDate,
            to_stage: activity.to_stage
          });
        }
      } else {
        fixedActivities.push({
          id: activity.id,
          deal_id: activity.deal_id,
          old_date: activity.created_at,
          new_date: originalDate,
          to_stage: activity.to_stage,
          would_fix: true
        });
      }
    }

    console.log('[FIX-ACTIVITIES] Fixed:', fixedActivities.length, 'Errors:', errors.length);

    // Step 3: Remove duplicates (always check, not just when dates fixed)
    let duplicatesRemoved = 0;
    let duplicatesFound = 0;
    
    if (!dry_run) {
      // Find and remove duplicate activities manually
      // Get all stage_change activities and identify duplicates
      const { data: allActivities, error: allError } = await supabase
        .from('deal_activities')
        .select('id, deal_id, to_stage, created_at')
        .eq('activity_type', 'stage_change')
        .order('created_at', { ascending: true });

      if (!allError && allActivities) {
        // Group by deal_id + to_stage + minute
        const groups: Record<string, string[]> = {};
        allActivities.forEach((a: any) => {
          const minute = a.created_at?.substring(0, 16) || '';
          const key = `${a.deal_id}-${a.to_stage}-${minute}`;
          if (!groups[key]) groups[key] = [];
          groups[key].push(a.id);
        });

        // Find groups with more than 1 activity (duplicates)
        const duplicateIds: string[] = [];
        Object.values(groups).forEach(ids => {
          if (ids.length > 1) {
            // Keep first, mark rest as duplicates
            duplicateIds.push(...ids.slice(1));
          }
        });

        duplicatesFound = duplicateIds.length;
        console.log('[FIX-ACTIVITIES] Found duplicate IDs:', duplicatesFound);

        // Delete duplicates in batches
        for (let i = 0; i < duplicateIds.length; i += 100) {
          const batch = duplicateIds.slice(i, i + 100);
          const { error: delError } = await supabase
            .from('deal_activities')
            .delete()
            .in('id', batch);
          
          if (!delError) duplicatesRemoved += batch.length;
        }
        console.log('[FIX-ACTIVITIES] Duplicates removed:', duplicatesRemoved);
      }
    } else {
      // Dry run - just count duplicates
      const { data: allActivities } = await supabase
        .from('deal_activities')
        .select('id, deal_id, to_stage, created_at')
        .eq('activity_type', 'stage_change')
        .order('created_at', { ascending: true });

      if (allActivities) {
        const groups: Record<string, string[]> = {};
        allActivities.forEach((a: any) => {
          const minute = a.created_at?.substring(0, 16) || '';
          const key = `${a.deal_id}-${a.to_stage}-${minute}`;
          if (!groups[key]) groups[key] = [];
          groups[key].push(a.id);
        });

        Object.values(groups).forEach(ids => {
          if (ids.length > 1) {
            duplicatesFound += ids.length - 1;
          }
        });
      }
    }

    // Step 4: Summary by month
    const byMonth: Record<string, number> = {};
    fixedActivities.forEach(a => {
      const month = a.new_date?.substring(0, 7) || 'unknown';
      byMonth[month] = (byMonth[month] || 0) + 1;
    });

    return new Response(
      JSON.stringify({
        success: true,
        dry_run,
        total_found: wrongDateActivities?.length || 0,
        activities_to_fix: activitiesToFix.length,
        fixed: fixedActivities.length,
        duplicates_found: duplicatesFound,
        duplicates_removed: duplicatesRemoved,
        errors: errors.length,
        by_month: byMonth,
        sample: fixedActivities.slice(0, 10),
        error_details: errors.slice(0, 5)
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[FIX-ACTIVITIES] Error:', error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
