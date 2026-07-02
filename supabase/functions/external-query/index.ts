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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // Auth: x-api-key
  const expected = Deno.env.get("EXTERNAL_QUERY_API_KEY");
  const provided = req.headers.get("x-api-key");
  if (!expected || !provided || provided !== expected) {
    return json({ error: "Unauthorized" }, 401);
  }

  // Parse body
  let body: {
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

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

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

  // Audit log (best-effort — never block response)
  const clientName = req.headers.get("x-client-name") ?? "external-query";
  const ipHeader = req.headers.get("x-forwarded-for") ?? "";
  const ip = ipHeader.split(",")[0]?.trim() || null;
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