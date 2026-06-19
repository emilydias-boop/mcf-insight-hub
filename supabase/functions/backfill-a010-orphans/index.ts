import { createClient } from "npm:@supabase/supabase-js@2";
import { createOrUpdateCRMContact } from "../hubla-webhook-handler/index.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const url = new URL(req.url);
  const days = Number(url.searchParams.get("days") ?? "7");

  const sinceIso = new Date(Date.now() - days * 86400_000).toISOString();
  const { data: txs, error: txErr } = await supabase
    .from("hubla_transactions")
    .select("hubla_id, customer_email, customer_phone, customer_name, product_name, net_value, created_at")
    .eq("product_category", "a010")
    .eq("source", "hubla")
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: true });

  if (txErr) {
    return new Response(JSON.stringify({ error: txErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Dedup por email (mantém 1ª transação)
  const byEmail = new Map<string, any>();
  for (const tx of txs ?? []) {
    const email = (tx.customer_email || "").toLowerCase().trim();
    if (!email) continue;
    if (!byEmail.has(email)) byEmail.set(email, tx);
  }

  // Filtrar apenas os que NÃO têm contato no CRM
  const emails = Array.from(byEmail.keys());
  const { data: existing } = await supabase
    .from("crm_contacts")
    .select("email")
    .in("email", emails);
  const existingSet = new Set((existing ?? []).map((c: any) => (c.email || "").toLowerCase().trim()));

  const toProcess = emails.filter((e) => !existingSet.has(e)).map((e) => byEmail.get(e));

  const results: any[] = [];
  for (const tx of toProcess) {
    try {
      await createOrUpdateCRMContact(supabase, {
        email: tx.customer_email,
        phone: tx.customer_phone,
        name: tx.customer_name,
        originName: "A010 Hubla",
        productName: tx.product_name || "A010",
        value: Number(tx.net_value) || 0,
        hublaId: tx.hubla_id,
      });
      results.push({ email: tx.customer_email, ok: true });
    } catch (e) {
      results.push({ email: tx.customer_email, ok: false, error: String(e) });
    }
  }

  return new Response(
    JSON.stringify({
      scanned: txs?.length ?? 0,
      unique_emails: emails.length,
      orphans: toProcess.length,
      processed: results.length,
      ok: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok),
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});