import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const RETRY_DELAYS_MIN = [1, 5, 30]; // attempts 1,2,3 -> next delay
const MAX_ATTEMPTS = 3;
const BATCH_SIZE = 25;

async function hmacSignature(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  const hex = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `sha256=${hex}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // Pull pending jobs ready to send
  const { data: jobs, error } = await supabase
    .from("outbound_webhook_queue")
    .select("*, outbound_webhook_configs(*)")
    .eq("status", "pending")
    .lte("next_retry_at", new Date().toISOString())
    .order("next_retry_at", { ascending: true })
    .limit(BATCH_SIZE);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results: any[] = [];

  for (const job of jobs ?? []) {
    const cfg = (job as any).outbound_webhook_configs;
    if (!cfg || !cfg.is_active) {
      await supabase.from("outbound_webhook_queue").update({ status: "failed", last_error: "config inactive or missing" }).eq("id", job.id);
      continue;
    }

    // Mark processing
    await supabase.from("outbound_webhook_queue").update({ status: "processing" }).eq("id", job.id);

    const body = JSON.stringify(job.payload);
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(cfg.headers || {}),
    };
    if (cfg.secret_token) {
      headers["X-Signature"] = await hmacSignature(cfg.secret_token, body);
    }

    const startedAt = Date.now();
    let respStatus = 0;
    let respBody = "";
    let success = false;
    let errMsg: string | null = null;

    try {
      const resp = await fetch(cfg.url, {
        method: cfg.method || "POST",
        headers,
        body,
        signal: AbortSignal.timeout(15000),
      });
      respStatus = resp.status;
      respBody = (await resp.text()).slice(0, 4000);
      success = resp.ok;
      if (!success) errMsg = `HTTP ${resp.status}`;
    } catch (e) {
      errMsg = (e as Error).message?.slice(0, 1000) ?? "fetch failed";
    }

    const duration = Date.now() - startedAt;
    const attempts = (job.attempts ?? 0) + 1;

    // Log
    await supabase.from("outbound_webhook_logs").insert({
      config_id: cfg.id,
      event: job.event,
      transaction_id: job.transaction_id,
      payload: job.payload,
      response_status: respStatus || null,
      response_body: respBody || null,
      duration_ms: duration,
      success,
      error_message: errMsg,
    });

    if (success) {
      await supabase.from("outbound_webhook_queue").update({
        status: "sent",
        attempts,
        sent_at: new Date().toISOString(),
        response_status: respStatus,
        response_body: respBody,
      }).eq("id", job.id);

      await supabase.from("outbound_webhook_configs").update({
        success_count: (cfg.success_count ?? 0) + 1,
        last_triggered_at: new Date().toISOString(),
        last_error: null,
      }).eq("id", cfg.id);
    } else if (attempts >= MAX_ATTEMPTS) {
      await supabase.from("outbound_webhook_queue").update({
        status: "failed",
        attempts,
        last_error: errMsg,
        response_status: respStatus || null,
        response_body: respBody || null,
      }).eq("id", job.id);

      await supabase.from("outbound_webhook_configs").update({
        error_count: (cfg.error_count ?? 0) + 1,
        last_error: errMsg,
      }).eq("id", cfg.id);
    } else {
      const delayMin = RETRY_DELAYS_MIN[attempts - 1] ?? 30;
      const next = new Date(Date.now() + delayMin * 60_000).toISOString();
      await supabase.from("outbound_webhook_queue").update({
        status: "pending",
        attempts,
        next_retry_at: next,
        last_error: errMsg,
        response_status: respStatus || null,
        response_body: respBody || null,
      }).eq("id", job.id);
    }

    results.push({ id: job.id, success, status: respStatus, error: errMsg });
  }

  return new Response(JSON.stringify({ processed: results.length, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});