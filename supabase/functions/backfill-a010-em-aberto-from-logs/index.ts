import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function digits(s: string | null | undefined): string {
  return String(s || "").replace(/\D/g, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const url = new URL(req.url);
  const dryRun = url.searchParams.get("dry_run") === "1";

  // 1) load logs
  const { data: logs, error: logsErr } = await supabase
    .from("hubla_webhook_logs")
    .select("id, event_data, created_at")
    .eq("event_type", "lead.abandoned_checkout")
    .order("created_at", { ascending: false })
    .limit(2000);

  if (logsErr) {
    return new Response(JSON.stringify({ error: logsErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 2) build best record per email/phone (most recent first wins)
  type Rec = {
    fullName: string | null;
    email: string | null;
    phone: string | null;
    valueCents: number | null;
    productName: string | null;
  };
  const byEmail = new Map<string, Rec>();
  const byPhone9 = new Map<string, Rec>();

  for (const row of logs || []) {
    const ev = (row.event_data as any)?.event || (row.event_data as any) || {};
    const lead = ev?.lead || {};
    const fullName =
      lead?.fullName ||
      [lead?.firstName, lead?.lastName].filter(Boolean).join(" ").trim() ||
      null;
    const email = (lead?.email || "").toString().toLowerCase().trim() || null;
    const phone = lead?.phone || null;
    const valueCents = typeof lead?.amount?.totalCents === "number"
      ? lead.amount.totalCents
      : null;
    const productName = Array.isArray(ev?.products) && ev.products[0]?.name
      ? ev.products[0].name
      : null;
    const rec: Rec = { fullName, email, phone, valueCents, productName };
    if (email && !byEmail.has(email)) byEmail.set(email, rec);
    const p9 = digits(phone).slice(-9);
    if (p9 && !byPhone9.has(p9)) byPhone9.set(p9, rec);
  }

  // 3) load all A010 Em Aberto deals (find stage id first)
  const { data: stages } = await supabase
    .from("crm_stages")
    .select("id, name")
    .ilike("name", "A010 Em Aberto");
  const stageIds = (stages || []).map((s: any) => s.id);

  let dealsQuery = supabase
    .from("crm_deals")
    .select("id, name, value, contact_id, custom_fields, tags, stage_id")
    .limit(5000);
  if (stageIds.length > 0) {
    dealsQuery = dealsQuery.in("stage_id", stageIds);
  } else {
    dealsQuery = dealsQuery.contains("tags", ["A010 Em Aberto"]);
  }
  const { data: deals, error: dealsErr } = await dealsQuery;
  if (dealsErr) {
    return new Response(JSON.stringify({ error: dealsErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const contactIds = Array.from(new Set((deals || []).map((d: any) => d.contact_id).filter(Boolean)));
  const { data: contacts } = await supabase
    .from("crm_contacts")
    .select("id, name, email, phone")
    .in("id", contactIds);
  const contactById = new Map<string, any>((contacts || []).map((c: any) => [c.id, c]));

  let matched = 0;
  let updatedDeals = 0;
  let updatedContacts = 0;
  let noMatch = 0;
  const sample: any[] = [];

  for (const deal of deals || []) {
    const contact = deal.contact_id ? contactById.get(deal.contact_id) : null;
    const ctEmail = (contact?.email || "").toLowerCase().trim();
    const ctP9 = digits(contact?.phone).slice(-9);
    let rec: Rec | undefined;
    if (ctEmail && byEmail.has(ctEmail)) rec = byEmail.get(ctEmail);
    if (!rec && ctP9 && byPhone9.has(ctP9)) rec = byPhone9.get(ctP9);

    if (!rec) {
      // also try by deal.name (might contain email if no contact)
      noMatch++;
      continue;
    }
    matched++;

    // contact updates: only fill nulls/empty
    if (contact) {
      const ctUpd: any = {};
      if ((!contact.name || contact.name.trim() === "") && rec.fullName) ctUpd.name = rec.fullName;
      if ((!contact.email || contact.email.trim() === "") && rec.email) ctUpd.email = rec.email;
      if ((!contact.phone || contact.phone.trim() === "") && rec.phone) ctUpd.phone = rec.phone;
      if (Object.keys(ctUpd).length > 0) {
        if (!dryRun) {
          const { error: cuErr } = await supabase.from("crm_contacts").update(ctUpd).eq("id", contact.id);
          if (!cuErr) updatedContacts++;
        } else {
          updatedContacts++;
        }
      }
    }

    // deal updates
    const dealUpd: any = {};
    const cf = { ...(deal.custom_fields || {}) };
    let cfChanged = false;

    const looksLikeMissingName = !deal.name || /^-\s*A010$/i.test(deal.name) || deal.name.trim() === "A010" || deal.name.toLowerCase().includes("sem nome");
    if (rec.fullName && looksLikeMissingName) {
      dealUpd.name = `${rec.fullName} - A010`;
    }

    if ((deal.value === null || Number(deal.value) === 0) && rec.valueCents && rec.valueCents > 0) {
      dealUpd.value = rec.valueCents / 100;
    }

    if (rec.productName && !cf.a010_produto) {
      cf.a010_produto = rec.productName;
      cfChanged = true;
    }
    if (!cf.backfill_em_aberto) {
      cf.backfill_em_aberto = true;
      cfChanged = true;
    }
    if (cfChanged) dealUpd.custom_fields = cf;

    if (Object.keys(dealUpd).length > 0) {
      dealUpd.updated_at = new Date().toISOString();
      if (!dryRun) {
        const { error: duErr } = await supabase.from("crm_deals").update(dealUpd).eq("id", deal.id);
        if (!duErr) updatedDeals++;
      } else {
        updatedDeals++;
      }
      if (sample.length < 10) sample.push({ deal_id: deal.id, applied: dealUpd });
    }
  }

  return new Response(JSON.stringify({
    dry_run: dryRun,
    logs_scanned: logs?.length || 0,
    unique_by_email: byEmail.size,
    unique_by_phone9: byPhone9.size,
    deals_total: deals?.length || 0,
    matched,
    no_match: noMatch,
    updated_deals: updatedDeals,
    updated_contacts: updatedContacts,
    sample,
  }, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});