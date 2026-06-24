import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RETENTION_DAYS = 30;
// Statuses que NUNCA são purgados, mesmo com >30 dias (falhas não resolvidas / em curso).
const PROTECTED_STATUSES = ["error", "processing", "partial", "failed", "retry"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const url = new URL(req.url);
  let dryRun = url.searchParams.get("dry_run") !== "0"; // default: dry-run ligado
  let retentionDays = Number(url.searchParams.get("retention_days") || RETENTION_DAYS);

  if (req.method === "POST") {
    try {
      const body = await req.json().catch(() => ({}));
      if (typeof body?.dry_run === "boolean") dryRun = body.dry_run;
      if (typeof body?.retention_days === "number") retentionDays = body.retention_days;
    } catch (_) { /* ignore */ }
  }

  if (!Number.isFinite(retentionDays) || retentionDays < 7) {
    return new Response(
      JSON.stringify({ error: "retention_days inválido (mínimo 7)" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const cutoff = new Date(Date.now() - retentionDays * 86_400_000).toISOString();
  const startedAt = Date.now();

  // Contagem do que seria afetado (sempre roda, mesmo em delete real)
  const { count: wouldDelete, error: countErr } = await supabase
    .from("hubla_webhook_logs")
    .select("id", { count: "exact", head: true })
    .lt("created_at", cutoff)
    .not("status", "in", `(${PROTECTED_STATUSES.join(",")})`);

  if (countErr) {
    return new Response(
      JSON.stringify({ error: countErr.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  let deleted = 0;
  if (!dryRun && (wouldDelete ?? 0) > 0) {
    // Delete em lotes para não estourar timeout / WAL
    const BATCH = 5000;
    while (true) {
      const { data: batch, error: selErr } = await supabase
        .from("hubla_webhook_logs")
        .select("id")
        .lt("created_at", cutoff)
        .not("status", "in", `(${PROTECTED_STATUSES.join(",")})`)
        .limit(BATCH);
      if (selErr) {
        return new Response(
          JSON.stringify({ error: selErr.message, deleted_so_far: deleted }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (!batch || batch.length === 0) break;
      const ids = batch.map((r: any) => r.id);
      const { error: delErr } = await supabase
        .from("hubla_webhook_logs")
        .delete()
        .in("id", ids);
      if (delErr) {
        return new Response(
          JSON.stringify({ error: delErr.message, deleted_so_far: deleted }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      deleted += batch.length;
      if (batch.length < BATCH) break;
    }
  }

  const result = {
    dry_run: dryRun,
    retention_days: retentionDays,
    cutoff,
    protected_statuses: PROTECTED_STATUSES,
    would_delete: wouldDelete ?? 0,
    deleted,
    duration_ms: Date.now() - startedAt,
  };
  console.log("[purge-old-webhook-logs]", result);

  return new Response(JSON.stringify(result), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
