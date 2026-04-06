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
  const monthsBack = parseInt(url.searchParams.get("months") || "2");

  const sinceDate = new Date();
  sinceDate.setMonth(sinceDate.getMonth() - monthsBack);
  const sinceDateStr = sinceDate.toISOString();

  console.log(`🔍 Backfill orphan A010 | dry_run=${dryRun} | limit=${limitParam} | since=${sinceDateStr}`);

  try {
    // 1. Find origin + stage in parallel
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

    // 2. Use RPC/raw query to find orphan contacts efficiently
    // Find contacts with A010 tag, no deal in this origin, created recently
    const { data: orphanRows, error: orphanError } = await supabase.rpc('execute_readonly_query', {
      query_text: `
        SELECT c.id, c.email, c.name, c.phone, c.created_at
        FROM crm_contacts c
        WHERE c.tags @> ARRAY['A010']::text[]
          AND c.is_archived = false
          AND c.created_at >= '${sinceDateStr}'
          AND NOT EXISTS (
            SELECT 1 FROM crm_deals d 
            WHERE d.contact_id = c.id AND d.origin_id = '${originId}'
          )
        ORDER BY c.created_at DESC
        LIMIT ${limitParam * 3}
      `
    });

    // Fallback if RPC doesn't exist — use manual approach with batch
    let orphans: any[] = [];
    
    if (orphanError) {
      console.log("⚠️ RPC not available, using manual approach...");
      // Get contacts in batch, then filter
      const { data: contacts } = await supabase
        .from('crm_contacts')
        .select('id, email, name, phone, created_at')
        .contains('tags', ['A010'])
        .gte('created_at', sinceDateStr)
        .eq('is_archived', false)
        .order('created_at', { ascending: false })
        .limit(500);

      if (contacts && contacts.length > 0) {
        // Get all deals for these contacts in batches of 50 to avoid 1000-row limit
        const contactIds = contacts.map(c => c.id);
        const contactsWithDeal = new Set<string>();
        for (let i = 0; i < contactIds.length; i += 50) {
          const batch = contactIds.slice(i, i + 50);
          const { data: deals } = await supabase
            .from('crm_deals')
            .select('contact_id')
            .eq('origin_id', originId)
            .in('contact_id', batch);
          (deals || []).forEach((d: any) => contactsWithDeal.add(d.contact_id));
        }
        orphans = contacts.filter(c => !contactsWithDeal.has(c.id)).slice(0, limitParam * 2);
        console.log(`📋 Manual: ${contacts.length} contacts, ${contactsWithDeal.size} with deals, ${orphans.length} orphans`);
      }
    } else {
      orphans = orphanRows || [];
      console.log(`📋 RPC: ${orphans.length} orphans found`);
    }

    // 3. For orphans with email, check if another contact with same email has a deal
    const results = {
      duplicates_archived: [] as string[],
      deals_created: [] as string[],
      partners_skipped: [] as string[],
      already_has_deal_via_email: [] as string[],
    };

    let processed = 0;

    for (const orphan of orphans) {
      if (processed >= limitParam) break;

      // Check if email duplicate already has a deal
      if (orphan.email) {
        const { data: otherWithDeal } = await supabase
          .from('crm_contacts')
          .select('id, crm_deals!inner(id)')
          .ilike('email', orphan.email)
          .eq('is_archived', false)
          .neq('id', orphan.id)
          .eq('crm_deals.origin_id', originId)
          .limit(1)
          .maybeSingle();

        if (otherWithDeal) {
          // Archive this duplicate
          if (!dryRun) {
            await supabase.from('crm_contacts').update({
              is_archived: true,
              merged_into_contact_id: otherWithDeal.id,
            }).eq('id', orphan.id);
          }
          results.duplicates_archived.push(`${orphan.email} (${orphan.id} → ${otherWithDeal.id})`);
          results.already_has_deal_via_email.push(orphan.email);
          processed++;
          continue;
        }

        // Check if partner
        const { data: partnerTxs } = await supabase
          .from('hubla_transactions')
          .select('product_name')
          .ilike('customer_email', orphan.email)
          .eq('sale_status', 'completed')
          .limit(30);

        const isPartner = (partnerTxs || []).some((tx: any) => {
          if (!tx.product_name) return false;
          const upper = tx.product_name.toUpperCase();
          return PARTNER_PATTERNS.some(p => upper.includes(p));
        });

        if (isPartner) {
          results.partners_skipped.push(orphan.email);
          processed++;
          continue;
        }
      }

      // Create deal
      if (dryRun) {
        results.deals_created.push(`[DRY] ${orphan.email || orphan.name} (${orphan.id})`);
      } else {
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
            name: `${orphan.name || 'Cliente'} - A010`,
            contact_id: orphan.id,
            origin_id: originId,
            stage_id: stageId,
            value: 0,
            owner_id: ownerEmail,
            owner_profile_id: ownerProfileId,
            tags: ['A010', 'Backfill'],
            custom_fields: { source: 'backfill', backfill_date: new Date().toISOString() },
            data_source: 'webhook',
          };

        // Use upsert with ignoreDuplicates to handle constraint gracefully
        const { data: newDeal, error: dealError } = await supabase
          .from('crm_deals')
          .upsert(dealPayload, { onConflict: 'contact_id,origin_id', ignoreDuplicates: true })
          .select('id')
          .maybeSingle();

        if (dealError) {
          console.error(`❌ ${orphan.email}: ${dealError.message}`);
        } else if (!newDeal) {
          console.log(`⏭️ ${orphan.email}: already has deal (constraint skip)`);
          results.already_has_deal_via_email.push(`${orphan.email} (upsert skip)`);
        } else {
          results.deals_created.push(`${orphan.email || orphan.name} → ${newDeal?.id || 'ignored'} → ${ownerEmail}`);
          if (newDeal?.id && ownerEmail) {
            await supabase.from('deal_activities').insert({
              deal_id: newDeal.id,
              activity_type: 'owner_change',
              description: `Lead A010 (backfill) distribuído para ${ownerEmail}`,
              metadata: { owner_email: ownerEmail, source: 'backfill-orphan-a010' },
            });
          }
        }
      }
      processed++;
    }

    const result = {
      success: true,
      dry_run: dryRun,
      since: sinceDateStr,
      orphans_checked: orphans.length,
      processed,
      ...Object.fromEntries(Object.entries(results).map(([k, v]) => [`${k}_count`, v.length])),
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
