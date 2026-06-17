import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Reconciliação diária A010: compara compras pagas em hubla_transactions
 * com deals criados no CRM no mesmo dia. Se houver divergência, registra
 * um alerta para os admins.
 *
 * Roda às 06:00 BRT diariamente (cron schedule).
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Janela: ontem 00:00 → ontem 23:59:59 (BRT)
  const now = new Date();
  const brtOffsetMs = -3 * 60 * 60 * 1000;
  const yesterdayBRT = new Date(now.getTime() + brtOffsetMs);
  yesterdayBRT.setUTCDate(yesterdayBRT.getUTCDate() - 1);
  const dayStr = yesterdayBRT.toISOString().slice(0, 10); // YYYY-MM-DD
  const startISO = `${dayStr}T00:00:00-03:00`;
  const endISO = `${dayStr}T23:59:59-03:00`;

  // Reconciliação via view
  const { data: recRows, error: recErr } = await supabase
    .from("v_a010_reconciliation")
    .select("*")
    .eq("day", dayStr);

  if (recErr) {
    console.error("[reconcile] erro view:", recErr);
    return new Response(JSON.stringify({ error: recErr.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let totalTx = 0, totalOrphan = 0;
  const bySource: Record<string, any> = {};
  for (const r of recRows || []) {
    totalTx += Number(r.transactions || 0);
    totalOrphan += Number(r.transactions_orphan || 0);
    bySource[r.source] = {
      transactions: r.transactions,
      with_deal: r.transactions_with_deal,
      orphan: r.transactions_orphan,
    };
  }

  // Lista hubla_ids órfãos do dia
  const { data: orphans } = await supabase
    .from("hubla_transactions")
    .select("hubla_id, customer_email, customer_name, product_name, sale_date")
    .gte("sale_date", startISO)
    .lte("sale_date", endISO)
    .eq("sale_status", "completed")
    .or("product_name.ilike.A010%,product_code.eq.1475bb20-12e7-11ef-9e36-f58d9f9c7ab9")
    .is("linked_deal_id", null)
    .not("hubla_id", "ilike", "newsale-%")
    .limit(100);

  // Pega admins ativos para receber o alerta
  const { data: admins } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin");

  const adminIds = Array.from(new Set((admins || []).map((r: any) => r.user_id).filter(Boolean)));
  let alertsCreated = 0;

  if (totalOrphan > 0 && adminIds.length > 0) {
    const titulo = `Reconciliação A010 ${dayStr}: ${totalOrphan} compra(s) sem deal`;
    const descricao = `Detectadas ${totalOrphan} compra(s) A010 em ${dayStr} sem deal vinculado no CRM. Verifique webhook_ingest_failures e o painel de webhooks.`;
    const rows = adminIds.map((uid) => ({
      user_id: uid,
      tipo: "reconciliacao_a010",
      titulo,
      descricao,
      metadata: {
        day: dayStr,
        total_transactions: totalTx,
        total_orphan: totalOrphan,
        by_source: bySource,
        orphan_sample: (orphans || []).slice(0, 20),
      },
      lido: false,
      resolvido: false,
    }));
    const { error: alertErr } = await supabase.from("alertas").insert(rows);
    if (alertErr) {
      console.error("[reconcile] erro insert alertas:", alertErr);
    } else {
      alertsCreated = rows.length;
    }
  }

  const summary = {
    success: true,
    day: dayStr,
    total_transactions: totalTx,
    total_orphan: totalOrphan,
    by_source: bySource,
    alerts_created: alertsCreated,
    orphan_count: orphans?.length || 0,
  };
  console.log("✅ daily-a010-reconcile:", JSON.stringify(summary));
  return new Response(JSON.stringify(summary, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});