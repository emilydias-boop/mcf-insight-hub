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

  // Parse params
  const url = new URL(req.url);
  const dryRun = url.searchParams.get("dry_run") === "true";
  const limitParam = parseInt(url.searchParams.get("limit") || "50");
  const monthsBack = parseInt(url.searchParams.get("months") || "2");

  const sinceDate = new Date();
  sinceDate.setMonth(sinceDate.getMonth() - monthsBack);
  const sinceDateStr = sinceDate.toISOString();

  console.log(`🔍 Backfill orphan A010 deals | dry_run=${dryRun} | limit=${limitParam} | since=${sinceDateStr}`);

  try {
    // 1. Find origin ID for PIPELINE INSIDE SALES
    const { data: originData } = await supabase
      .from('crm_origins')
      .select('id')
      .ilike('name', PIPELINE_INSIDE_SALES_ORIGIN)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!originData) {
      return new Response(JSON.stringify({ error: "Origin PIPELINE INSIDE SALES not found" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    const originId = originData.id;

    // 2. Find "Novo Lead" stage
    const { data: stageData } = await supabase
      .from('crm_stages')
      .select('id')
      .eq('origin_id', originId)
      .ilike('stage_name', '%Novo Lead%')
      .limit(1)
      .maybeSingle();
    const stageId = stageData?.id || null;

    // 3. Find orphan contacts: have A010 tag, created recently, NO deal in this origin
    // We use a raw approach: get contacts with A010 tag created after sinceDate
    const { data: a010Contacts, error: contactsError } = await supabase
      .from('crm_contacts')
      .select('id, email, name, phone, created_at')
      .contains('tags', ['A010'])
      .gte('created_at', sinceDateStr)
      .eq('is_archived', false)
      .order('created_at', { ascending: false })
      .limit(1000);

    if (contactsError) {
      console.error("❌ Error fetching contacts:", contactsError);
      return new Response(JSON.stringify({ error: contactsError.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log(`📋 Found ${a010Contacts?.length || 0} A010 contacts since ${sinceDateStr}`);

    // 4. For each contact, check if they have a deal in this origin
    const orphans: any[] = [];
    const duplicatesArchived: string[] = [];
    const dealsCreated: string[] = [];
    const skippedPartners: string[] = [];
    const skippedHasDeal: string[] = [];

    for (const contact of (a010Contacts || [])) {
      if (orphans.length >= limitParam) break;

      // Check if THIS contact has a deal
      const { data: deal } = await supabase
        .from('crm_deals')
        .select('id')
        .eq('contact_id', contact.id)
        .eq('origin_id', originId)
        .limit(1)
        .maybeSingle();

      if (deal) {
        continue; // Has deal, not orphan
      }

      // Check if another contact with same email already has a deal
      if (contact.email) {
        const { data: otherContacts } = await supabase
          .from('crm_contacts')
          .select('id')
          .ilike('email', contact.email)
          .neq('id', contact.id)
          .eq('is_archived', false)
          .limit(10);

        let emailHasDeal = false;
        for (const other of (otherContacts || [])) {
          const { data: otherDeal } = await supabase
            .from('crm_deals')
            .select('id')
            .eq('contact_id', other.id)
            .eq('origin_id', originId)
            .limit(1)
            .maybeSingle();

          if (otherDeal) {
            // Another copy of this email already has a deal — archive this duplicate
            emailHasDeal = true;
            if (!dryRun) {
              await supabase.from('crm_contacts').update({
                is_archived: true,
                merged_into_contact_id: other.id,
              }).eq('id', contact.id);
            }
            duplicatesArchived.push(`${contact.email} (${contact.id} → ${other.id})`);
            break;
          }
        }
        if (emailHasDeal) {
          skippedHasDeal.push(contact.email);
          continue;
        }
      }

      // Check if partner
      if (contact.email) {
        const { data: partnerTxs } = await supabase
          .from('hubla_transactions')
          .select('product_name')
          .ilike('customer_email', contact.email)
          .eq('sale_status', 'completed')
          .limit(50);

        const isPartner = (partnerTxs || []).some((tx: any) => {
          if (!tx.product_name) return false;
          const upper = tx.product_name.toUpperCase();
          return PARTNER_PATTERNS.some(p => upper.includes(p));
        });

        if (isPartner) {
          skippedPartners.push(contact.email);
          continue;
        }
      }

      orphans.push(contact);
    }

    console.log(`🔎 Orphans to fix: ${orphans.length} | Duplicates to archive: ${duplicatesArchived.length} | Partners skipped: ${skippedPartners.length} | Has deal elsewhere: ${skippedHasDeal.length}`);

    // 5. Create deals for true orphans
    for (const orphan of orphans) {
      if (dryRun) {
        dealsCreated.push(`[DRY] ${orphan.email || orphan.name} (${orphan.id})`);
        continue;
      }

      // Distribute to SDR
      let ownerEmail: string | null = null;
      let ownerProfileId: string | null = null;
      const { data: nextOwner } = await supabase.rpc('get_next_lead_owner', { p_origin_id: originId });
      if (nextOwner) {
        ownerEmail = nextOwner;
        const { data: profile } = await supabase
          .from('profiles').select('id').ilike('email', nextOwner).limit(1).maybeSingle();
        ownerProfileId = profile?.id || null;
      }

      const { data: newDeal, error: dealError } = await supabase
        .from('crm_deals')
        .upsert({
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
          data_source: 'backfill',
        }, {
          onConflict: 'contact_id,origin_id',
          ignoreDuplicates: true,
        })
        .select('id')
        .maybeSingle();

      if (dealError) {
        console.error(`❌ Deal error for ${orphan.email}:`, dealError.message);
      } else {
        dealsCreated.push(`${orphan.email || orphan.name} → ${newDeal?.id || 'upsert_ignored'} → owner: ${ownerEmail}`);
        
        // Log activity
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

    const result = {
      success: true,
      dry_run: dryRun,
      since: sinceDateStr,
      total_a010_contacts_checked: a010Contacts?.length || 0,
      orphans_found: orphans.length,
      duplicates_archived: duplicatesArchived.length,
      deals_created: dealsCreated.length,
      partners_skipped: skippedPartners.length,
      has_deal_elsewhere: skippedHasDeal.length,
      details: {
        deals_created: dealsCreated,
        duplicates_archived: duplicatesArchived,
        partners_skipped: skippedPartners,
      },
    };

    console.log("✅ Backfill complete:", JSON.stringify(result, null, 2));

    return new Response(JSON.stringify(result, null, 2), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("❌ Backfill error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
