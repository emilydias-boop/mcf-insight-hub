import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    const body = req.method === 'POST' ? await req.json() : {};
    const dryRun = body.dry_run ?? true;

    console.log(`[fix-r2-ownership] Starting: dry_run=${dryRun}`);

    // 1. Find deals where owner_id = r2_closer_email AND r1_closer_email exists
    const { data: deals, error: queryError } = await supabase
      .from('crm_deals')
      .select('id, name, owner_id, r1_closer_email, r2_closer_email, stage_id, owner_profile_id')
      .not('r1_closer_email', 'is', null)
      .not('r2_closer_email', 'is', null);

    if (queryError) throw queryError;

    // Filter: owner_id matches r2_closer_email (case-insensitive)
    const mismatched = (deals || []).filter(d => 
      d.owner_id && d.r2_closer_email &&
      d.owner_id.toLowerCase() === d.r2_closer_email.toLowerCase() &&
      d.r1_closer_email &&
      d.owner_id.toLowerCase() !== d.r1_closer_email.toLowerCase()
    );

    console.log(`[fix-r2-ownership] Found ${mismatched.length} deals with R2 closer as owner`);

    // 2. Exclude No-Show R2 deals (check stage name)
    let stageNames: Record<string, string> = {};
    const stageIds = [...new Set(mismatched.map(d => d.stage_id).filter(Boolean))];
    if (stageIds.length > 0) {
      const { data: stages } = await supabase
        .from('crm_stages')
        .select('id, stage_name')
        .in('id', stageIds);
      stageNames = Object.fromEntries((stages || []).map(s => [s.id, s.stage_name]));
    }

    const toFix = mismatched.filter(d => {
      const stageName = stageNames[d.stage_id] || '';
      return !stageName.toLowerCase().includes('no-show') || !stageName.toLowerCase().includes('r2');
    });

    console.log(`[fix-r2-ownership] After excluding No-Show R2: ${toFix.length} deals to fix`);

    // 3. Resolve profile IDs for R1 closers
    const r1Emails = [...new Set(toFix.map(d => d.r1_closer_email!.toLowerCase()))];
    const profileMap: Record<string, string> = {};
    if (r1Emails.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email')
        .in('email', r1Emails);
      for (const p of (profiles || [])) {
        profileMap[p.email.toLowerCase()] = p.id;
      }
    }

    const results = {
      total_found: mismatched.length,
      excluded_noshow_r2: mismatched.length - toFix.length,
      to_fix: toFix.length,
      fixed: 0,
      errors: [] as any[],
      sample: [] as any[],
    };

    // 4. Update deals
    for (const deal of toFix) {
      try {
        const newOwner = deal.r1_closer_email!;
        const newProfileId = profileMap[newOwner.toLowerCase()] || null;

        if (!dryRun) {
          const { error: updateError } = await supabase
            .from('crm_deals')
            .update({
              owner_id: newOwner,
              owner_profile_id: newProfileId,
            })
            .eq('id', deal.id);

          if (updateError) {
            results.errors.push({ deal_id: deal.id, error: updateError.message });
            continue;
          }

          // Audit log
          await supabase.from('deal_activities').insert({
            deal_id: deal.id,
            activity_type: 'stage_change',
            description: `Correção automática: owner transferido de ${deal.owner_id} (R2) para ${newOwner} (R1)`,
            metadata: {
              fix_type: 'r2_ownership_correction',
              old_owner: deal.owner_id,
              new_owner: newOwner,
              r2_closer_email: deal.r2_closer_email,
              fixed_at: new Date().toISOString(),
            },
          });
        }

        results.fixed++;
        if (results.sample.length < 15) {
          results.sample.push({
            deal_id: deal.id,
            deal_name: deal.name,
            old_owner: deal.owner_id,
            new_owner: newOwner,
            r2_closer: deal.r2_closer_email,
            stage: stageNames[deal.stage_id] || deal.stage_id,
          });
        }
      } catch (err: any) {
        results.errors.push({ deal_id: deal.id, error: err.message });
      }
    }

    console.log(`[fix-r2-ownership] Done: fixed=${results.fixed}, errors=${results.errors.length}`);

    return new Response(JSON.stringify({
      success: true,
      dry_run: dryRun,
      results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('[fix-r2-ownership] Error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
