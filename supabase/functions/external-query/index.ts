import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key, x-client-name",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// Whitelist of allowed public tables to prevent arbitrary access.
// Extend as needed.
const ALLOWED_TABLES = new Set<string>([
  "hubla_transactions",
  "crm_deals",
  "crm_contacts",
  "consortium_cards",
  "consortium_payments",
  "consortium_installments",
  "consorcio_proposals",
  "profiles",
  "employees",
  "billing_history",
  "billing_installments",
  "billing_subscriptions",
  "transactions",
  "a010_sales",
  "sdr_month_payout",
  "consorcio_closer_payout",
]);

// ============================================================
// Pricing logic — mirrored from src/lib/incorporadorPricing.ts
// and src/components/incorporador/TransactionGroupRow.tsx
// Keep in sync when the frontend logic changes.
// ============================================================
const FIXED_GROSS_PRICES_FALLBACK: { pattern: string; price: number }[] = [
  { pattern: "a005 - mcf p2", price: 0 },
  { pattern: "a009 - mcf incorporador completo + the club", price: 19500 },
  { pattern: "a001 - mcf incorporador completo", price: 14500 },
  { pattern: "a000 - contrato", price: 497 },
  { pattern: "a010", price: 47 },
  { pattern: "plano construtor básico", price: 997 },
  { pattern: "a004 - mcf plano anticrise básico", price: 5500 },
  { pattern: "a003 - mcf plano anticrise completo", price: 7500 },
];

const getFixedGrossPrice = (productName: string | null, originalPrice: number): number => {
  if (!productName) return originalPrice;
  const n = productName.toLowerCase().trim();
  for (const { pattern, price } of FIXED_GROSS_PRICES_FALLBACK) {
    if (n.includes(pattern)) return price;
  }
  return originalPrice;
};

interface Tx {
  id: string;
  hubla_id: string | null;
  product_name: string | null;
  product_price: number | null;
  net_value: number | null;
  installment_number: number | null;
  gross_override: number | null;
  reference_price: number | null;
  customer_email: string | null;
  sale_date: string;
}

const getDeduplicatedGross = (tx: Tx, isFirst: boolean): number => {
  const installment = tx.installment_number || 1;
  if (installment > 1) return 0;
  if (tx.gross_override !== null && tx.gross_override !== undefined) return Number(tx.gross_override);
  if (!isFirst) return 0;
  if (tx.product_name?.toLowerCase().trim() === "parceria") return Number(tx.product_price || 0);
  if (tx.reference_price !== null && tx.reference_price !== undefined) return Number(tx.reference_price);
  return getFixedGrossPrice(tx.product_name, Number(tx.product_price || 0));
};

const normalizeProductKey = (productName: string | null): string => {
  if (!productName) return "unknown";
  const u = productName.toUpperCase().trim();
  if (u.includes("A009")) return "A009";
  if (u.includes("A005")) return "A005";
  if (u.includes("A004")) return "A004";
  if (u.includes("A003")) return "A003";
  if (u.includes("A001")) return "A001";
  if (u.includes("A010")) return "A010";
  if (u.includes("A000") || u.includes("CONTRATO")) return "A000";
  if (u.includes("PLANO CONSTRUTOR")) return "PLANO_CONSTRUTOR";
  return u.substring(0, 40);
};

const clientProductKey = (email: string | null, product: string | null) =>
  `${(email || "unknown").toLowerCase().trim()}|${normalizeProductKey(product)}`;

const computeFirstIdsJS = (txs: Tx[]): Set<string> => {
  const first = new Map<string, { id: string; date: number }>();
  for (const tx of txs) {
    const key = clientProductKey(tx.customer_email, tx.product_name);
    const d = new Date(tx.sale_date).getTime();
    const ex = first.get(key);
    if (!ex || d < ex.date) first.set(key, { id: tx.id, date: d });
  }
  return new Set(Array.from(first.values()).map(v => v.id));
};

async function computeBUTotals(
  supabase: ReturnType<typeof createClient>,
  bu: string,
  startDate: string,
  endDate: string,
) {
  const { data: rows, error } = await supabase.rpc("get_hubla_transactions_by_bu", {
    p_bu: bu,
    p_search: null,
    p_start_date: startDate,
    p_end_date: endDate,
    p_limit: 5000,
  });
  if (error) throw error;
  const txs = (rows ?? []) as Tx[];

  // First IDs: prefer authoritative RPC for incorporador; JS fallback for other BUs.
  let firstIds: Set<string>;
  if (bu === "incorporador") {
    const { data: firstRows, error: fErr } = await supabase.rpc("get_first_transaction_ids");
    if (fErr) throw fErr;
    firstIds = new Set(((firstRows ?? []) as { id: string }[]).map(r => r.id));
  } else {
    firstIds = computeFirstIdsJS(txs);
  }

  // Group by base hubla_id (strip -offer-N) to match groupTransactionsByPurchase
  type Group = { hasBumps: boolean; bumps: Tx[]; all: Tx[]; gross: number };
  const groups = new Map<string, Group>();
  for (const tx of txs) {
    const baseId = tx.hubla_id?.replace(/-offer-\d+$/, "") || tx.id;
    const isBump = !!tx.hubla_id?.includes("-offer-");
    let g = groups.get(baseId);
    if (!g) { g = { hasBumps: false, bumps: [], all: [], gross: 0 }; groups.set(baseId, g); }
    g.all.push(tx);
    if (isBump) { g.bumps.push(tx); g.hasBumps = true; }
    g.gross += getDeduplicatedGross(tx, firstIds.has(tx.id));
  }

  let bruto = 0;
  let liquido = 0;
  for (const g of groups.values()) {
    if (g.hasBumps) {
      // With bumps: net = sum of bumps only (main = cart total, would double-count)
      liquido += g.bumps.reduce((s, t) => s + Number(t.net_value || 0), 0);
      // Gross: prefer bumps-only if non-zero, else keep full group gross
      const bumpsGross = g.bumps.reduce(
        (s, t) => s + getDeduplicatedGross(t, firstIds.has(t.id)),
        0,
      );
      bruto += bumpsGross > 0 ? bumpsGross : g.gross;
    } else {
      bruto += g.gross;
      liquido += g.all.reduce((s, t) => s + Number(t.net_value || 0), 0);
    }
  }

  return { bruto, liquido, total_transacoes: txs.length };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // Auth: x-api-key (trim defensivo para tolerar espaços/CR do secret)
  const expected = (Deno.env.get("EXTERNAL_QUERY_API_KEY") ?? "").trim();
  const provided = (req.headers.get("x-api-key") ?? "").trim();
  if (!expected) {
    console.error("EXTERNAL_QUERY_API_KEY não está configurado no ambiente");
    return json({ error: "Server misconfigured" }, 500);
  }
  if (!provided || provided !== expected) {
    return json({ error: "Unauthorized" }, 401);
  }

  // Parse body
  let body: {
    action?: string;
    bu?: string;
    start_date?: string;
    end_date?: string;
    table?: string;
    filters?: Record<string, unknown>;
    select?: string;
    limit?: number;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const clientName = req.headers.get("x-client-name") ?? "external-query";
  const ipHeader = req.headers.get("x-forwarded-for") ?? "";
  const ip = ipHeader.split(",")[0]?.trim() || null;

  // ---- Action: get_bu_totals ----
  if (body.action === "get_bu_totals") {
    const bu = (body.bu ?? "").toString().trim().toLowerCase();
    const startDate = (body.start_date ?? "").toString().trim();
    const endDate = (body.end_date ?? "").toString().trim();
    const allowedBUs = new Set(["incorporador", "consorcio", "credito"]);
    if (!allowedBUs.has(bu)) return json({ error: "Invalid or missing 'bu'" }, 400);
    if (!startDate || !endDate) return json({ error: "Missing 'start_date' or 'end_date'" }, 400);

    try {
      const totals = await computeBUTotals(supabase, bu, startDate, endDate);
      try {
        await supabase.from("audit_logs").insert({
          action: "external_query_get_bu_totals",
          table_name: "hubla_transactions",
          new_data: { client: clientName, bu, start_date: startDate, end_date: endDate, ...totals },
          ip_address: ip,
          user_agent: req.headers.get("user-agent"),
        });
      } catch (e) { console.error("audit_logs insert failed", e); }
      return json(totals);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return json({ error: msg }, 400);
    }
  }

  // ---- Action: get_metas_equipe_mensal ----
  // Payload: { action, mes: 1-12, ano: 2026 }
  // Reutiliza a RPC public.get_sdr_metrics_from_agenda (bu_filter='incorporador')
  // + conta contract_paid a partir de meeting_slot_attendees.contract_paid_at
  //   (mesma lógica de useCloserContractsList, escopada por closers.bu='incorporador').
  if (body.action === "get_metas_equipe_mensal") {
    const mes = Number((body as any).mes);
    const ano = Number((body as any).ano);
    if (!Number.isInteger(mes) || mes < 1 || mes > 12) return json({ error: "Invalid 'mes'" }, 400);
    if (!Number.isInteger(ano) || ano < 2000 || ano > 2100) return json({ error: "Invalid 'ano'" }, 400);

    const pad = (n: number) => String(n).padStart(2, "0");
    const startDate = `${ano}-${pad(mes)}-01`;
    const lastDay = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
    const endDate = `${ano}-${pad(mes)}-${pad(lastDay)}`;

    try {
      const { data: rpcData, error: rpcErr } = await supabase.rpc("get_sdr_metrics_from_agenda", {
        start_date: startDate,
        end_date: endDate,
        sdr_email_filter: null,
        bu_filter: "incorporador",
      });
      if (rpcErr) throw rpcErr;

      const metrics = ((rpcData as any)?.metrics ?? []) as Array<{
        agendamentos?: number;
        r1_agendada?: number;
        r1_realizada?: number;
        no_shows?: number;
      }>;

      let agendamento = 0, r1_agendada = 0, r1_realizada = 0, no_show = 0;
      for (const m of metrics) {
        agendamento += Number(m.agendamentos || 0);
        r1_agendada += Number(m.r1_agendada || 0);
        r1_realizada += Number(m.r1_realizada || 0);
        no_show += Number(m.no_shows || 0);
      }

      // Contrato Pago: mesma fonte do Painel Comercial (useR1CloserMetrics).
      // Ancoragem por contract_paid_at (BRT = UTC-3 -> janela shift +3h),
      // filtrada por meeting_type='r1', is_partner=false, closers da BU incorporador.
      // Fallback: status='contract_paid' sem contract_paid_at, ancorado por scheduled_at.
      const { data: closers, error: cErr } = await supabase
        .from("closers")
        .select("id")
        .eq("bu", "incorporador");
      if (cErr) throw cErr;
      const closerIds = new Set((closers ?? []).map((c: any) => c.id));

      // Janela BRT: soma 3h em ambos os extremos para casar UTC do timestamp
      const startUTC = new Date(`${startDate}T00:00:00-03:00`).toISOString();
      const endUTC = new Date(`${endDate}T23:59:59-03:00`).toISOString();

      let contrato_pago = 0;
      const counted = new Set<string>();

      // Primary: contract_paid_at no intervalo
      const { data: primary, error: pErr } = await supabase
        .from("meeting_slot_attendees")
        .select("id, meeting_slot:meeting_slots!inner(closer_id, meeting_type)")
        .eq("meeting_slot.meeting_type", "r1")
        .eq("is_partner", false)
        .not("contract_paid_at", "is", null)
        .gte("contract_paid_at", startUTC)
        .lte("contract_paid_at", endUTC);
      if (pErr) throw pErr;
      for (const att of (primary ?? []) as any[]) {
        const closerId = att.meeting_slot?.closer_id;
        if (closerId && closerIds.has(closerId) && !counted.has(att.id)) {
          counted.add(att.id);
          contrato_pago += 1;
        }
      }

      // Fallback: status='contract_paid' sem timestamp, ancorado por scheduled_at
      const { data: fallback, error: fbErr } = await supabase
        .from("meeting_slot_attendees")
        .select("id, meeting_slot:meeting_slots!inner(closer_id, meeting_type, scheduled_at)")
        .eq("status", "contract_paid")
        .eq("meeting_slot.meeting_type", "r1")
        .eq("is_partner", false)
        .is("contract_paid_at", null)
        .gte("meeting_slot.scheduled_at", startUTC)
        .lte("meeting_slot.scheduled_at", endUTC);
      if (fbErr) throw fbErr;
      for (const att of (fallback ?? []) as any[]) {
        const closerId = att.meeting_slot?.closer_id;
        if (closerId && closerIds.has(closerId) && !counted.has(att.id)) {
          counted.add(att.id);
          contrato_pago += 1;
        }
      }

      const result = { agendamento, r1_agendada, r1_realizada, no_show, contrato_pago };
      try {
        await supabase.from("audit_logs").insert({
          action: "external_query_get_metas_equipe_mensal",
          table_name: "meeting_slot_attendees",
          new_data: { client: clientName, mes, ano, start_date: startDate, end_date: endDate, ...result },
          ip_address: ip,
          user_agent: req.headers.get("user-agent"),
        });
      } catch (e) { console.error("audit_logs insert failed", e); }
      return json(result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return json({ error: msg }, 400);
    }
  }

  const table = (body.table ?? "").toString().trim();
  const select = typeof body.select === "string" && body.select.trim() ? body.select : "*";
  const limit = Math.min(Math.max(Number(body.limit ?? 100), 1), 1000);
  const filters = (body.filters ?? {}) as Record<string, unknown>;

  if (!table) return json({ error: "Missing 'table'" }, 400);
  if (!/^[a-z0-9_]+$/i.test(table)) return json({ error: "Invalid table name" }, 400);
  if (!ALLOWED_TABLES.has(table)) {
    return json({ error: `Table '${table}' is not allowed` }, 403);
  }
  if (!/^[a-z0-9_,\s\*\(\)\.:]+$/i.test(select)) {
    return json({ error: "Invalid select expression" }, 400);
  }

  // Build query. Supports scalar equality, arrays (IN) and simple operator objects:
  // { gte: x, lte: y, like: '%foo%', in: [1,2] }
  let query = supabase.from(table).select(select).limit(limit);
  for (const [col, val] of Object.entries(filters)) {
    if (!/^[a-z0-9_]+$/i.test(col)) {
      return json({ error: `Invalid filter column '${col}'` }, 400);
    }
    if (val === null) {
      query = query.is(col, null);
    } else if (Array.isArray(val)) {
      query = query.in(col, val as never[]);
    } else if (typeof val === "object") {
      for (const [op, v] of Object.entries(val as Record<string, unknown>)) {
        switch (op) {
          case "eq": query = query.eq(col, v as never); break;
          case "neq": query = query.neq(col, v as never); break;
          case "gt": query = query.gt(col, v as never); break;
          case "gte": query = query.gte(col, v as never); break;
          case "lt": query = query.lt(col, v as never); break;
          case "lte": query = query.lte(col, v as never); break;
          case "like": query = query.like(col, String(v)); break;
          case "ilike": query = query.ilike(col, String(v)); break;
          case "in": query = query.in(col, v as never[]); break;
          case "is": query = query.is(col, v as never); break;
          default: return json({ error: `Unsupported operator '${op}'` }, 400);
        }
      }
    } else {
      query = query.eq(col, val as never);
    }
  }

  const { data, error } = await query;

  try {
    await supabase.from("audit_logs").insert({
      action: error ? "external_query_error" : "external_query",
      table_name: table,
      new_data: {
        client: clientName,
        select,
        limit,
        filters,
        row_count: data?.length ?? 0,
        error: error?.message ?? null,
      },
      ip_address: ip,
      user_agent: req.headers.get("user-agent"),
    });
  } catch (e) {
    console.error("audit_logs insert failed", e);
  }

  if (error) return json({ error: error.message }, 400);
  return json({ data, count: data?.length ?? 0 });
});