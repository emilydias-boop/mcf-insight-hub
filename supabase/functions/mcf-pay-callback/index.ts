import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-mcf-pay-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SECRET = Deno.env.get("MCF_PAY_CALLBACK_SECRET") ?? "";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

async function hmacHex(body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function constEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function log(
  row: {
    deal_id: string | null;
    event: string;
    status: string;
    http_status: number;
    payload: unknown;
    response: unknown;
    error_message?: string | null;
    signature_preview?: string | null;
  },
) {
  await supabase.from("mcf_pay_dispatch_logs").insert({
    deal_id: row.deal_id,
    event: row.event,
    status: row.status,
    attempt: 1,
    http_status: row.http_status,
    payload: row.payload as never,
    response: row.response as never,
    error_message: row.error_message ?? null,
    signature_preview: row.signature_preview ?? null,
    direction: "inbound",
    sent_at: row.status === "success" ? new Date().toISOString() : null,
  } as never);
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);

  const rawBody = await req.text();
  const sigHeader = req.headers.get("x-mcf-pay-signature") ?? "";

  if (!SECRET) {
    return json({ ok: false, error: "callback_secret_not_configured" }, 500);
  }

  // Validar assinatura
  let expected = "";
  try {
    expected = await hmacHex(rawBody);
  } catch {
    return json({ ok: false, error: "signature_compute_failed" }, 500);
  }
  const provided = sigHeader.toLowerCase().replace(/^sha256=/, "");
  if (!provided || !constEq(provided, expected)) {
    // Telemetria de debug (sem vazar o segredo): fingerprint do secret usado no CRM,
    // primeiros chars das duas assinaturas, content-type e tamanho do corpo.
    const secretFp = SECRET ? (await sha256Hex(SECRET)).slice(0, 8) : "empty";
    const debug = {
      provided_preview: provided.slice(0, 16) || null,
      expected_preview: expected.slice(0, 16),
      crm_secret_fingerprint: secretFp,
      body_length: rawBody.length,
      content_type: req.headers.get("content-type"),
      header_present: Boolean(sigHeader),
    };
    await log({
      deal_id: null,
      event: "callback",
      status: "failed",
      http_status: 401,
      payload: { raw: rawBody.slice(0, 2000) },
      response: debug,
      error_message: "invalid_signature",
      signature_preview: provided.slice(0, 16) || null,
    });
    return json({ ok: false, error: "invalid_signature", debug }, 401);
  }

  // Parse payload
  let body: any;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  const event: string = body?.event ?? "";
  const data = body?.data ?? {};
  const dealId: string | null = data?.deal_id ?? null;
  const status: string = data?.status ?? "";
  const paidAt: string | null = data?.paid_at ?? null;
  const amount: number | null = typeof data?.amount === "number" ? data.amount : null;
  const transactionId: string | null = data?.transaction_id ?? null;

  if (!dealId || !event) {
    await log({
      deal_id: dealId,
      event: event || "callback",
      status: "failed",
      http_status: 400,
      payload: body,
      response: null,
      error_message: "missing_deal_id_or_event",
      signature_preview: expected.slice(0, 16),
    });
    return json({ ok: false, error: "missing_deal_id_or_event" }, 400);
  }

  // Buscar deal
  let { data: deal } = await supabase
    .from("crm_deals")
    .select("id, custom_fields")
    .eq("id", dealId)
    .maybeSingle();

  // Fallback 1: dealId pode ser o transaction_id (MCF Pay enviou invoice.id como deal_id)
  let resolvedDealId = dealId;
  if (!deal && transactionId) {
    const { data: byTx } = await supabase
      .from("crm_deals")
      .select("id, custom_fields")
      .eq("custom_fields->>mcf_pay_transaction_id", transactionId)
      .maybeSingle();
    if (byTx) {
      deal = byTx;
      resolvedDealId = byTx.id;
    }
  }
  // Fallback 2: tentar usar o próprio dealId como transaction_id em custom_fields
  if (!deal) {
    const { data: byInvoice } = await supabase
      .from("crm_deals")
      .select("id, custom_fields")
      .eq("custom_fields->>mcf_pay_transaction_id", dealId)
      .maybeSingle();
    if (byInvoice) {
      deal = byInvoice;
      resolvedDealId = byInvoice.id;
    }
  }

  if (!deal) {
    await log({
      deal_id: dealId,
      event,
      status: "failed",
      http_status: 404,
      payload: body,
      response: null,
      error_message: "deal_not_found",
      signature_preview: expected.slice(0, 16),
    });
    return json({ ok: false, error: "deal_not_found" }, 404);
  }

  const isPaid = event === "payment.confirmed" || status === "paid";
  const isRefunded = event === "payment.refunded" || status === "refunded";

  if (!isPaid && !isRefunded) {
    await log({
      deal_id: dealId,
      event,
      status: "failed",
      http_status: 400,
      payload: body,
      response: null,
      error_message: `unsupported_event_status:${event}/${status}`,
      signature_preview: expected.slice(0, 16),
    });
    return json({ ok: false, error: "unsupported_event" }, 400);
  }

  // Localizar attendee mais recente do deal
  const { data: attendees } = await supabase
    .from("meeting_slot_attendees")
    .select("id, contract_paid_at, status, meeting_slot_id")
    .eq("deal_id", resolvedDealId)
    .order("created_at", { ascending: false })
    .limit(1);
  const attendee = attendees?.[0] ?? null;

  const effectivePaidAt = paidAt ?? new Date().toISOString();

  // Atualiza custom_fields no deal (fonte mcf_pay)
  const currentCustom = (deal.custom_fields as Record<string, unknown>) ?? {};
  const newCustom = {
    ...currentCustom,
    payment_source: isRefunded ? "mcf_pay_refunded" : "mcf_pay",
    mcf_pay_paid_at: isPaid ? effectivePaidAt : currentCustom.mcf_pay_paid_at ?? null,
    mcf_pay_amount: isPaid ? amount : currentCustom.mcf_pay_amount ?? null,
    mcf_pay_transaction_id: transactionId ?? currentCustom.mcf_pay_transaction_id ?? null,
    mcf_pay_last_event_at: new Date().toISOString(),
  };
  await supabase.from("crm_deals").update({ custom_fields: newCustom as never }).eq("id", resolvedDealId);

  if (attendee) {
    if (isPaid) {
      await supabase
        .from("meeting_slot_attendees")
        .update({
          contract_paid_at: effectivePaidAt,
          status: "contract_paid",
        })
        .eq("id", attendee.id);
    } else if (isRefunded) {
      await supabase
        .from("meeting_slot_attendees")
        .update({
          contract_paid_at: null,
          // mantemos status atual para investigação manual em reembolso
        })
        .eq("id", attendee.id);
    }
  }

  await log({
    deal_id: dealId,
    event,
    status: "success",
    http_status: 200,
    payload: body,
    response: { ok: true, attendee_id: attendee?.id ?? null, applied: isPaid ? "paid" : "refunded" },
    signature_preview: expected.slice(0, 16),
  });

  return json({ ok: true, deal_id: dealId, attendee_id: attendee?.id ?? null });
});