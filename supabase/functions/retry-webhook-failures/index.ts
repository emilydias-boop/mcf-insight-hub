import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_ATTEMPTS = 5;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Pega falhas pendentes (max 50 por execução)
  const { data: failures, error } = await supabase
    .from("webhook_ingest_failures")
    .select("*")
    .in("status", ["pending", "retrying"])
    .lt("attempts", MAX_ATTEMPTS)
    .order("created_at", { ascending: true })
    .limit(50);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!failures || failures.length === 0) {
    return new Response(JSON.stringify({ success: true, processed: 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Agrupa por source — atualmente só kiwify usa esta fila
  const kiwifyIds = failures.filter(f => f.source === "kiwify" && f.hubla_id).map(f => f.hubla_id);

  const results: any[] = [];

  if (kiwifyIds.length > 0) {
    // Reusa kiwify-recover-orphan-transactions para resolver os hubla_ids pendentes
    try {
      const { data: recRes, error: recErr } = await supabase.functions.invoke(
        "kiwify-recover-orphan-transactions",
        { body: { dry_run: false, hubla_ids: kiwifyIds } },
      );
      if (recErr) throw recErr;

      const detail = (recRes?.results || []) as Array<any>;
      const byId: Record<string, any> = {};
      for (const r of detail) {
        if (r.hubla_id) byId[r.hubla_id] = r;
      }

      for (const f of failures.filter(f => f.source === "kiwify")) {
        const r = byId[f.hubla_id || ""];
        const newAttempts = (f.attempts || 0) + 1;
        if (r && (r.status === "created" || r.status === "linked_existing_deal") && r.deal_id) {
          await supabase.from("webhook_ingest_failures").update({
            status: "resolved",
            attempts: newAttempts,
            resolved_at: new Date().toISOString(),
            resolved_deal_id: r.deal_id,
            last_error: null,
          }).eq("id", f.id);
          results.push({ id: f.id, status: "resolved", deal_id: r.deal_id });
        } else {
          const reason = r?.reason || "no_match";
          const status = newAttempts >= MAX_ATTEMPTS ? "abandoned" : "retrying";
          await supabase.from("webhook_ingest_failures").update({
            status, attempts: newAttempts, last_error: reason,
          }).eq("id", f.id);
          results.push({ id: f.id, status, reason });
        }
      }
    } catch (e) {
      console.error("[retry-webhook-failures] erro chamando recovery:", e);
      for (const f of failures.filter(f => f.source === "kiwify")) {
        const newAttempts = (f.attempts || 0) + 1;
        await supabase.from("webhook_ingest_failures").update({
          status: newAttempts >= MAX_ATTEMPTS ? "abandoned" : "retrying",
          attempts: newAttempts,
          last_error: (e as Error)?.message || String(e),
        }).eq("id", f.id);
      }
    }
  }

  const summary = {
    success: true,
    picked: failures.length,
    resolved: results.filter(r => r.status === "resolved").length,
    retrying: results.filter(r => r.status === "retrying").length,
    abandoned: results.filter(r => r.status === "abandoned").length,
    results,
  };
  console.log("✅ retry-webhook-failures:", JSON.stringify(summary));
  return new Response(JSON.stringify(summary, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});