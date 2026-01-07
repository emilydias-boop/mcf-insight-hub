// Fix reprocessed activities - Robust duplicate cleanup with second-level tolerance
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('[FIX-ACTIVITIES] Starting robust cleanup v2...');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const body = await req.json().catch(() => ({}));
    const dry_run = body.dry_run !== false; // Default to true
    const start_date = body.start_date || '2026-01-05';
    const end_date = body.end_date || '2026-01-08';
    const tolerance_seconds = body.tolerance_seconds || 60; // Default 60s tolerance
    
    console.log('[FIX-ACTIVITIES] Mode:', dry_run ? 'DRY RUN' : 'EXECUTE');
    console.log('[FIX-ACTIVITIES] Date range:', start_date, 'to', end_date);
    console.log('[FIX-ACTIVITIES] Tolerance:', tolerance_seconds, 'seconds');

    // Step 1: Fetch all relevant activities - use pagination to avoid limit
    let allActivities: any[] = [];
    let offset = 0;
    const pageSize = 1000;
    
    while (true) {
      const { data: batch, error: fetchError } = await supabase
        .from('deal_activities')
        .select('id, deal_id, activity_type, from_stage, to_stage, created_at, metadata')
        .gte('created_at', `${start_date}T00:00:00Z`)
        .lte('created_at', `${end_date}T23:59:59Z`)
        .in('activity_type', ['stage_change', 'stage_changed'])
        .order('created_at', { ascending: true })
        .range(offset, offset + pageSize - 1);

      if (fetchError) throw fetchError;
      if (!batch || batch.length === 0) break;
      
      allActivities = allActivities.concat(batch);
      if (batch.length < pageSize) break;
      offset += pageSize;
    }

    console.log('[FIX-ACTIVITIES] Total activities in range:', allActivities.length);

    // Step 2: Group by (deal_id + activity_type + from_stage + to_stage)
    // Then within each group, find duplicates within tolerance_seconds of each other
    const groupsByKey: Record<string, Array<{id: string, created_at: string, ts: number}>> = {};
    
    allActivities.forEach((activity: any) => {
      const key = [
        activity.deal_id,
        activity.activity_type,
        activity.from_stage || 'null',
        activity.to_stage || 'null'
      ].join('|');
      
      if (!groupsByKey[key]) groupsByKey[key] = [];
      groupsByKey[key].push({
        id: activity.id,
        created_at: activity.created_at,
        ts: new Date(activity.created_at).getTime()
      });
    });

    // Step 3: Within each group, find duplicates using tolerance window
    const duplicateIds: string[] = [];
    const duplicateClusters: Array<{key: string, kept: string, removed: string[], count: number}> = [];

    Object.entries(groupsByKey).forEach(([key, activities]) => {
      if (activities.length <= 1) return;
      
      // Sort by timestamp
      activities.sort((a, b) => a.ts - b.ts);
      
      // Use a clustering approach: activities within tolerance_seconds form a cluster
      const clusters: Array<{id: string, ts: number}[]> = [];
      let currentCluster: Array<{id: string, ts: number}> = [activities[0]];
      
      for (let i = 1; i < activities.length; i++) {
        const timeDiff = (activities[i].ts - currentCluster[currentCluster.length - 1].ts) / 1000;
        
        if (timeDiff <= tolerance_seconds) {
          // Same cluster
          currentCluster.push(activities[i]);
        } else {
          // New cluster
          if (currentCluster.length > 0) clusters.push(currentCluster);
          currentCluster = [activities[i]];
        }
      }
      if (currentCluster.length > 0) clusters.push(currentCluster);
      
      // For each cluster with more than 1 activity, keep the first, remove the rest
      clusters.forEach(cluster => {
        if (cluster.length > 1) {
          const kept = cluster[0].id;
          const removed = cluster.slice(1).map(a => a.id);
          
          duplicateClusters.push({
            key,
            kept,
            removed,
            count: cluster.length
          });
          
          duplicateIds.push(...removed);
        }
      });
    });

    console.log('[FIX-ACTIVITIES] Duplicate clusters found:', duplicateClusters.length);
    console.log('[FIX-ACTIVITIES] Total duplicates to remove:', duplicateIds.length);

    // Step 4: Execute deletions if not dry_run
    let duplicatesRemoved = 0;
    const errors: any[] = [];

    if (!dry_run && duplicateIds.length > 0) {
      // Remove duplicates in batches
      for (let i = 0; i < duplicateIds.length; i += 100) {
        const batch = duplicateIds.slice(i, i + 100);
        const { error: delError } = await supabase
          .from('deal_activities')
          .delete()
          .in('id', batch);
        
        if (delError) {
          errors.push({ type: 'delete', batch: i, error: delError.message });
        } else {
          duplicatesRemoved += batch.length;
        }
      }
      console.log('[FIX-ACTIVITIES] Duplicates removed:', duplicatesRemoved);
    }

    // Stats by deal
    const dealStats: Record<string, number> = {};
    duplicateClusters.forEach(c => {
      const dealId = c.key.split('|')[0];
      dealStats[dealId] = (dealStats[dealId] || 0) + c.removed.length;
    });

    return new Response(
      JSON.stringify({
        success: true,
        dry_run,
        tolerance_seconds,
        date_range: { start: start_date, end: end_date },
        total_activities_in_range: allActivities.length,
        duplicate_clusters: duplicateClusters.length,
        duplicates_to_remove: duplicateIds.length,
        duplicates_removed: duplicatesRemoved,
        errors: errors.length,
        top_affected_deals: Object.entries(dealStats)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([deal_id, count]) => ({ deal_id, duplicates: count })),
        sample_clusters: duplicateClusters.slice(0, 10).map(c => ({
          key: c.key,
          kept: c.kept,
          removed_count: c.removed.length
        })),
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
