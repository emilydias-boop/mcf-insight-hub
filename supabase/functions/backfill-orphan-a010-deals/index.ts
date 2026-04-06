import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PIPELINE_INSIDE_SALES_ORIGIN = 'PIPELINE INSIDE SALES';
const PARTNER_PATTERNS = ['A001', 'A002', 'A003', 'A004', 'A009', 'INCORPORADOR', 'ANTICRISE'];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const url = new URL(req.url);
  const dryRun = url.searchParams.get("dry_run") === "true";
  const limitParam = parseInt(url.searchParams.get("limit") || "30");
  const monthsBack = parseInt(url.searchParams.get("months") || "1");

  const sinceDate = new Date();
  sinceDate.setMonth(sinceDate.getMonth() - monthsBack);
  const sinceDateStr = sinceDate.toISOString();

  console.log(`🔍 Backfill orphan A010 (v4 - RPC) | dry_run=${dryRun} | limit=${limitParam} | since=${sinceDateStr}`);

  try {
    // 1. Find origin + stage
    const [originRes, stageRes] = await Promise.all([
      supabase.from('crm_origins').select('id').ilike('name', PIPELINE_INSIDE_SALES_ORIGIN)
        .order('created_at', { ascending: true }).limit(1).maybeSingle(),
      supabase.from('crm_stages').select('id, origin_id').ilike('stage_name', '%Novo Lead%').limit(50),
    ]);

    const originId = originRes.data?.id;
    if (!originId) {
      return new Response(JSON.stringify({ error: "Origin not found" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const stageId = (stageRes.data || []).find((s: any) => s.origin_id === originId)?.id || null;

    // 2. Use RPC to get orphan emails in ~1 query (replaces 30s+ classification loop)
    const { data: orphans, error: rpcError } = await supabase.rpc('get_a010_orphan_emails', {
      p_origin_id: originId,
      p_since: sinceDateStr,
      p_limit: limitParam,
    });

    if (rpcError) {
      console.error("❌ RPC error:", rpcError.message);
      return new Response(JSON.stringify({ error: rpcError.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log(`📧 RPC returned ${(orphans || []).length} orphan emails`);

    if (!orphans || orphans.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "No orphans found", orphans: 0 }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const results = {
      deals_created: [] as string[],
      duplicates_archived: [] as string[],
      partners_skipped: [] as string[],
      errors: [] as string[],
    };

    // 3. Process each orphan — create deal + distribute
    for (const orphan of orphans) {
      const email = orphan.email;
      const contactId = orphan.contact_id;
      const contactName = orphan.contact_name || 'Cliente';

      // Check if partner
      const { data: partnerTxs } = await supabase
        .from('hubla_transactions')
        .select('product_name')
        .ilike('customer_email', email)
        .eq('sale_status', 'completed')
        .limit(30);

      const isPartner = (partnerTxs || []).some((tx: any) => {
        if (!tx.product_name) return false;
        const upper = tx.product_name.toUpperCase();
        return PARTNER_PATTERNS.some(p => upper.includes(p));
      });

      if (isPartner) {
        results.partners_skipped.push(email);
        continue;
      }

      if (dryRun) {
        results.deals_created.push(`[DRY] ${email} (${contactId})`);
        continue;
      }

      // Get owner via round-robin
      let ownerEmail: string | null = null;
      let ownerProfileId: string | null = null;
      const { data: nextOwner } = await supabase.rpc('get_next_lead_owner', { p_origin_id: originId });
      if (nextOwner) {
        ownerEmail = nextOwner;
        const { data: profile } = await supabase
          .from('profiles').select('id').ilike('email', nextOwner).limit(1).maybeSingle();
        ownerProfileId = profile?.id || null;
      }

      const dealPayload = {
        clint_id: `backfill-a010-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: `${contactName} - A010`,
        contact_id: contactId,
        origin_id: originId,
        stage_id: stageId,
        value: 0,
        owner_id: ownerEmail,
        owner_profile_id: ownerProfileId,
        tags: ['A010', 'Backfill'],
        custom_fields: { source: 'backfill', backfill_date: new Date().toISOString() },
        data_source: 'webhook',
      };

      const { data: newDeal, error: dealError } = await supabase
        .from('crm_deals')
        .insert(dealPayload)
        .select('id')
        .maybeSingle();

      if (dealError) {
        if (dealError.message.includes('duplicate') || dealError.message.includes('unique')) {
          results.errors.push(`${email}: skip (already exists)`);
        } else {
          results.errors.push(`${email}: ${dealError.message}`);
        }
      } else if (newDeal) {
        results.deals_created.push(`${email} → deal ${newDeal.id} → ${ownerEmail}`);
        if (newDeal.id && ownerEmail) {
          await supabase.from('deal_activities').insert({
            deal_id: newDeal.id,
            activity_type: 'owner_change',
            description: `Lead A010 (backfill) distribuído para ${ownerEmail}`,
            metadata: { owner_email: ownerEmail, source: 'backfill-orphan-a010' },
          });
        }
      }

      // Archive duplicate contacts with same email (keep the one we used)
      const { data: dupes } = await supabase
        .from('crm_contacts')
        .select('id')
        .ilike('email', email)
        .eq('is_archived', false)
        .neq('id', contactId);

      for (const dupe of (dupes || [])) {
        await supabase.from('crm_contacts').update({
          is_archived: true,
          merged_into_contact_id: contactId,
        }).eq('id', dupe.id);
        results.duplicates_archived.push(`${email} (${dupe.id} → ${contactId})`);
      }
    }

    const result = {
      success: true,
      dry_run: dryRun,
      since: sinceDateStr,
      orphans_from_rpc: orphans.length,
      deals_created: results.deals_created.length,
      duplicates_archived: results.duplicates_archived.length,
      partners_skipped: results.partners_skipped.length,
      errors: results.errors.length,
      details: results,
    };

    console.log("✅ Backfill complete:", JSON.stringify(result, null, 2));

    return new Response(JSON.stringify(result, null, 2), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("❌ Backfill error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
