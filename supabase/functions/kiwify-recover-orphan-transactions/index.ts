import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PIPELINE_INSIDE_SALES_ORIGIN = "PIPELINE INSIDE SALES";
const PARTNER_PATTERNS = [
  "A001", "A002", "A003", "A004", "A005", "A006", "A007", "A008", "A009",
  "R001", "INCORPORADOR", "ANTICRISE",
];

function normalizePhone(phone?: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("55") && digits.length >= 12) return `+${digits}`;
  if (digits.length === 10 || digits.length === 11) return `+55${digits}`;
  return `+${digits}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let body: any = {};
  try { body = await req.json(); } catch (_) {}
  const url = new URL(req.url);
  const dryRun = (body.dry_run ?? url.searchParams.get("dry_run") === "true") === true;
  const hublaIds: string[] | undefined = body.hubla_ids;
  const since: string | undefined = body.since ?? url.searchParams.get("since") ?? undefined;
  const until: string | undefined = body.until ?? url.searchParams.get("until") ?? undefined;
  const limit: number = Number(body.limit ?? url.searchParams.get("limit") ?? 50);

  console.log(`🔁 kiwify-recover-orphan | dry_run=${dryRun} ids=${hublaIds?.length ?? 0} since=${since} until=${until}`);

  // 1. Pick target transactions
  let q = supabase
    .from("hubla_transactions")
    .select("id, hubla_id, customer_name, customer_email, customer_phone, product_name, product_code, sale_date, sale_status, source, linked_deal_id")
    .eq("source", "kiwify")
    .eq("sale_status", "completed")
    .is("linked_deal_id", null)
    .limit(limit);

  if (hublaIds && hublaIds.length > 0) {
    q = q.in("hubla_id", hublaIds);
  } else {
    if (since) q = q.gte("sale_date", since);
    if (until) q = q.lte("sale_date", until);
  }

  const { data: txs, error: txErr } = await q;
  if (txErr) {
    return new Response(JSON.stringify({ error: txErr.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  if (!txs || txs.length === 0) {
    return new Response(JSON.stringify({ success: true, message: "Nenhuma transação órfã encontrada", processed: 0 }, null, 2), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // 2. Resolve origin + stage
  const { data: origin } = await supabase
    .from("crm_origins").select("id").ilike("name", PIPELINE_INSIDE_SALES_ORIGIN)
    .order("created_at", { ascending: true }).limit(1).maybeSingle();
  const originId = origin?.id;
  if (!originId) {
    return new Response(JSON.stringify({ error: "Origin PIPELINE INSIDE SALES não encontrado" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  const { data: stages } = await supabase
    .from("crm_stages").select("id, origin_id, stage_name").eq("origin_id", originId);
  const stageId = (stages || []).find((s: any) => /novo lead/i.test(s.stage_name))?.id ?? null;

  const results: any[] = [];

  for (const tx of txs) {
    const email = (tx.customer_email || "").toLowerCase().trim();
    if (!email) {
      results.push({ hubla_id: tx.hubla_id, status: "skipped", reason: "no_email" });
      continue;
    }

    // Partner check
    const { data: partnerTxs } = await supabase
      .from("hubla_transactions").select("product_name")
      .ilike("customer_email", email).eq("sale_status", "completed").limit(30);
    const isPartner = (partnerTxs || []).some((t: any) => {
      const up = (t.product_name || "").toUpperCase();
      return PARTNER_PATTERNS.some(p => up.includes(p));
    });
    if (isPartner) {
      results.push({ hubla_id: tx.hubla_id, email, status: "skipped", reason: "partner" });
      continue;
    }

    if (dryRun) {
      results.push({ hubla_id: tx.hubla_id, email, status: "would_create" });
      continue;
    }

    const normalizedPhone = normalizePhone(tx.customer_phone);

    // Find/create contact
    let contactId: string | null = null;
    const { data: existing } = await supabase
      .from("crm_contacts").select("id")
      .ilike("email", email).eq("is_archived", false)
      .order("created_at", { ascending: true }).limit(1).maybeSingle();
    if (existing) {
      contactId = existing.id;
    } else if (normalizedPhone) {
      const digits = normalizedPhone.replace(/\D/g, "");
      const suffix = digits.slice(-9);
      const { data: byPhone } = await supabase
        .from("crm_contacts").select("id, phone")
        .ilike("phone", `%${suffix}`).eq("is_archived", false)
        .order("created_at", { ascending: true }).limit(1).maybeSingle();
      if (byPhone) contactId = byPhone.id;
    }

    if (!contactId) {
      const { data: newContact, error: cErr } = await supabase
        .from("crm_contacts").insert({
          clint_id: `kiwify-recover-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name: tx.customer_name || "Cliente A010",
          email,
          phone: normalizedPhone,
          origin_id: originId,
          tags: ["A010", "A010 Kiwify"],
          custom_fields: { source: "kiwify-recovery", product: tx.product_name, hubla_id: tx.hubla_id },
        }).select("id").single();
      if (cErr) {
        // Parse duplicate_contact:phone:<suffix>:<uuid>
        const m = cErr.message.match(/duplicate_contact:[^:]+:[^:]+:([0-9a-f-]{36})/i);
        if (m) {
          contactId = m[1];
        } else {
          results.push({ hubla_id: tx.hubla_id, email, status: "error", reason: `contact: ${cErr.message}` });
          continue;
        }
      } else {
        contactId = newContact?.id || null;
      }
    }
    if (!contactId) {
      results.push({ hubla_id: tx.hubla_id, email, status: "error", reason: "no_contact_id" });
      continue;
    }

    // Reuse deal in this origin if exists
    const { data: existDeal } = await supabase
      .from("crm_deals").select("id, tags")
      .eq("contact_id", contactId).eq("origin_id", originId)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();

    let dealId: string | null = existDeal?.id || null;

    if (!dealId) {
      let ownerEmail: string | null = null;
      let ownerProfileId: string | null = null;
      const { data: nextOwner } = await supabase.rpc("get_next_lead_owner", { p_origin_id: originId });
      if (nextOwner) {
        ownerEmail = nextOwner;
        const { data: profile } = await supabase
          .from("profiles").select("id").ilike("email", nextOwner).limit(1).maybeSingle();
        ownerProfileId = profile?.id || null;
      }

      const { data: newDeal, error: dErr } = await supabase
        .from("crm_deals").insert({
          clint_id: `kiwify-recover-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name: `${tx.customer_name || "Cliente"} - A010`,
          contact_id: contactId,
          origin_id: originId,
          stage_id: stageId,
          value: 0,
          owner_id: ownerEmail,
          owner_profile_id: ownerProfileId,
          tags: ["A010", "A010 Kiwify"],
          custom_fields: { source: "kiwify-recovery", product: tx.product_name, hubla_id: tx.hubla_id },
          data_source: "webhook",
        }).select("id").single();
      if (dErr) {
        results.push({ hubla_id: tx.hubla_id, email, status: "error", reason: `deal: ${dErr.message}` });
        continue;
      }
      dealId = newDeal?.id || null;

      if (dealId) {
        await supabase.from("deal_activities").insert({
          deal_id: dealId,
          activity_type: "owner_change",
          description: `Lead A010 (recovery Kiwify) distribuído para ${ownerEmail || "n/a"}`,
          metadata: { owner_email: ownerEmail, source: "kiwify-recover-orphan", hubla_id: tx.hubla_id },
        });
      }
    } else {
      // ensure tags
      const tags: string[] = existDeal?.tags || [];
      const nextTags = Array.from(new Set([...tags, "A010", "A010 Kiwify"]));
      await supabase.from("crm_deals").update({ tags: nextTags }).eq("id", dealId);
    }

    // Link transaction
    if (dealId) {
      const { error: linkErr } = await supabase
        .from("hubla_transactions")
        .update({ linked_deal_id: dealId, linked_at: new Date().toISOString(), linked_method: "manual" })
        .eq("id", tx.id);
      if (linkErr) {
        results.push({ hubla_id: tx.hubla_id, email, status: "linked_failed", deal_id: dealId, reason: linkErr.message });
      } else {
        results.push({ hubla_id: tx.hubla_id, email, status: existDeal ? "linked_existing_deal" : "created", deal_id: dealId });
      }
    }
  }

  const summary = {
    success: true,
    dry_run: dryRun,
    processed: txs.length,
    created: results.filter(r => r.status === "created").length,
    linked_existing: results.filter(r => r.status === "linked_existing_deal").length,
    would_create: results.filter(r => r.status === "would_create").length,
    skipped: results.filter(r => r.status === "skipped").length,
    errors: results.filter(r => r.status === "error" || r.status === "linked_failed").length,
    results,
  };

  console.log("✅ recovery:", JSON.stringify(summary, null, 2));
  return new Response(JSON.stringify(summary, null, 2), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
});