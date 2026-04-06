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

  console.log(`🔍 Backfill orphan A010 (v3 - prioritized) | dry_run=${dryRun} | limit=${limitParam} | since=${sinceDateStr}`);

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

    // 2. Get all A010 buyer emails from transactions
    let a010Emails: string[] = [];
    const PAGE_SIZE = 500;
    let page = 0;
    let hasMore = true;

    while (hasMore) {
      const { data: txRows, error: txErr } = await supabase
        .from('hubla_transactions')
        .select('customer_email')
        .eq('product_category', 'a010')
        .eq('sale_status', 'completed')
        .gte('created_at', sinceDateStr)
        .not('customer_email', 'is', null)
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (txErr) { console.error("❌ tx error:", txErr.message); break; }
      const emails = (txRows || []).map((t: any) => t.customer_email?.toLowerCase()).filter(Boolean);
      a010Emails.push(...emails);
      hasMore = (txRows || []).length === PAGE_SIZE;
      page++;
    }

    const uniqueA010Emails = [...new Set(a010Emails)];
    console.log(`📧 ${uniqueA010Emails.length} unique A010 buyer emails`);

    if (uniqueA010Emails.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "No A010 transactions found", orphans: 0 }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 3. For each email, check if ANY contact with that email has a deal in this origin
    // Group contacts by email and classify
    const emailsWithDeal = new Set<string>();
    const emailToContacts = new Map<string, any[]>();
    const CHUNK = 50;

    for (let i = 0; i < uniqueA010Emails.length; i += CHUNK) {
      const emailChunk = uniqueA010Emails.slice(i, i + CHUNK);

      // Get all non-archived contacts for these emails
      const { data: contacts } = await supabase
        .from('crm_contacts')
        .select('id, email, name, phone, created_at')
        .in('email', emailChunk)
        .eq('is_archived', false)
        .order('created_at', { ascending: true });

      if (!contacts || contacts.length === 0) continue;

      // Group by email
      for (const c of contacts) {
        const em = c.email?.toLowerCase();
        if (!em) continue;
        if (!emailToContacts.has(em)) emailToContacts.set(em, []);
        emailToContacts.get(em)!.push(c);
      }

      // Check which emails already have deals (via any contact)
      const contactIds = contacts.map(c => c.id);
      for (let j = 0; j < contactIds.length; j += 50) {
        const batch = contactIds.slice(j, j + 50);
        const { data: deals } = await supabase
          .from('crm_deals')
          .select('contact_id, crm_contacts!inner(email)')
          .eq('origin_id', originId)
          .in('contact_id', batch);

        for (const d of (deals || [])) {
          const dealEmail = (d as any).crm_contacts?.email?.toLowerCase();
          if (dealEmail) emailsWithDeal.add(dealEmail);
        }
      }
    }

    // Also check emails where the contact with deal might be a different contact_id
    // (contact A has deal, contact B is orphan, same email)
    for (let i = 0; i < uniqueA010Emails.length; i += CHUNK) {
      const emailChunk = uniqueA010Emails.slice(i, i + CHUNK);
      const { data: dealsViaEmail } = await supabase
        .from('crm_deals')
        .select('crm_contacts!inner(email)')
        .eq('origin_id', originId)
        .in('crm_contacts.email', emailChunk);

      for (const d of (dealsViaEmail || [])) {
        const em = (d as any).crm_contacts?.email?.toLowerCase();
        if (em) emailsWithDeal.add(em);
      }
    }

    // Classify
    const trueOrphanEmails: string[] = [];
    const duplicateEmails: string[] = [];

    for (const [email, contacts] of emailToContacts.entries()) {
      if (emailsWithDeal.has(email)) {
        duplicateEmails.push(email);
      } else {
        trueOrphanEmails.push(email);
      }
    }

    console.log(`✅ True orphans (no deal at all): ${trueOrphanEmails.length} emails`);
    console.log(`🔄 Duplicates (email has deal elsewhere): ${duplicateEmails.length} emails`);

    const results = {
      deals_created: [] as string[],
      duplicates_archived: [] as string[],
      partners_skipped: [] as string[],
      errors: [] as string[],
    };
    let processed = 0;

    // ===== PHASE 1: True orphans — create deals =====
    for (const email of trueOrphanEmails) {
      if (processed >= limitParam) break;

      const contacts = emailToContacts.get(email) || [];
      if (contacts.length === 0) continue;

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
        processed++;
        continue;
      }

      // Pick oldest contact as primary
      const primary = contacts[0]; // already sorted by created_at ASC

      if (dryRun) {
        results.deals_created.push(`[DRY] ${email} (${primary.id})`);
        // Archive duplicates
        for (let k = 1; k < contacts.length; k++) {
          results.duplicates_archived.push(`[DRY] ${email} (${contacts[k].id} → ${primary.id})`);
        }
      } else {
        // Get owner
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
          name: `${primary.name || 'Cliente'} - A010`,
          contact_id: primary.id,
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
          .upsert(dealPayload, { onConflict: 'contact_id,origin_id', ignoreDuplicates: true })
          .select('id')
          .maybeSingle();

        if (dealError) {
          results.errors.push(`${email}: ${dealError.message}`);
        } else if (!newDeal) {
          results.errors.push(`${email}: upsert skip (already exists)`);
        } else {
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

        // Archive duplicate contacts of same email
        for (let k = 1; k < contacts.length; k++) {
          await supabase.from('crm_contacts').update({
            is_archived: true,
            merged_into_contact_id: primary.id,
          }).eq('id', contacts[k].id);
          results.duplicates_archived.push(`${email} (${contacts[k].id} → ${primary.id})`);
        }
      }
      processed++;
    }

    // ===== PHASE 2: Duplicate orphans — just archive =====
    for (const email of duplicateEmails) {
      if (processed >= limitParam) break;

      const contacts = emailToContacts.get(email) || [];
      if (contacts.length === 0) continue;

      // Find the contact that has the deal
      let primaryId: string | null = null;
      for (const c of contacts) {
        const { data: hasDeal } = await supabase
          .from('crm_deals')
          .select('id')
          .eq('origin_id', originId)
          .eq('contact_id', c.id)
          .limit(1)
          .maybeSingle();
        if (hasDeal) { primaryId = c.id; break; }
      }

      // If no contact in our list has the deal, find it externally
      if (!primaryId) {
        const { data: extContact } = await supabase
          .from('crm_contacts')
          .select('id, crm_deals!inner(id)')
          .ilike('email', email)
          .eq('crm_deals.origin_id', originId)
          .limit(1)
          .maybeSingle();
        primaryId = extContact?.id || null;
      }

      if (!primaryId) continue;

      for (const c of contacts) {
        if (c.id === primaryId) continue;
        if (!dryRun) {
          await supabase.from('crm_contacts').update({
            is_archived: true,
            merged_into_contact_id: primaryId,
          }).eq('id', c.id);
        }
        results.duplicates_archived.push(`${dryRun ? '[DRY] ' : ''}${email} (${c.id} → ${primaryId})`);
      }
      processed++;
    }

    const result = {
      success: true,
      dry_run: dryRun,
      since: sinceDateStr,
      a010_buyer_emails: uniqueA010Emails.length,
      true_orphan_emails: trueOrphanEmails.length,
      duplicate_emails: duplicateEmails.length,
      processed,
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
