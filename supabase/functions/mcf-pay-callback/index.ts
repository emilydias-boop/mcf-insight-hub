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

function normalizePhone(input: string | null | undefined): string | null {
  if (!input) return null;
  const digits = String(input).replace(/\D+/g, "");
  if (digits.length < 8) return null;
  return digits.slice(-9);
}

function normalizeName(input: string | null | undefined): string | null {
  if (!input) return null;
  return String(input)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim() || null;
}

type ResolveResult = {
  deal: any | null;
  strategy: string;
  candidates?: Array<{ id: string; name: string | null; contact_email: string | null; contact_phone: string | null }>;
};

async function resolveDeal(data: any): Promise<ResolveResult> {
  const tryById = async (id: string | null | undefined, strategy: string) => {
    if (!id || typeof id !== "string") return null;
    const { data: d } = await supabase
      .from("crm_deals")
      .select("id, custom_fields, contact_id")
      .eq("id", id)
      .maybeSingle();
    return d ? { deal: d, strategy } : null;
  };

  // 1. crm_deal_id explícito
  let r = await tryById(data?.crm_deal_id, "crm_deal_id");
  if (r) return r;
  // 2. data.deal_id direto
  r = await tryById(data?.deal_id, "deal_id");
  if (r) return r;
  // 3. metadata.crm_deal_id
  r = await tryById(data?.metadata?.crm_deal_id, "metadata.crm_deal_id");
  if (r) return r;

  // 4. transaction_id em custom_fields
  const txId: string | null = data?.transaction_id ?? null;
  if (txId) {
    const { data: byTx } = await supabase
      .from("crm_deals")
      .select("id, custom_fields, contact_id")
      .eq("custom_fields->>mcf_pay_transaction_id", txId)
      .maybeSingle();
    if (byTx) return { deal: byTx, strategy: "transaction_id" };
  }

  // 5. Cliente: email / telefone / nome
  const customer = data?.customer ?? {};
  const email = (customer.email ?? data?.customer_email ?? null)?.toString().toLowerCase().trim() || null;
  const phoneRaw = customer.phone ?? data?.customer_phone ?? null;
  const nameRaw = customer.name ?? data?.customer_name ?? null;
  const phone9 = normalizePhone(phoneRaw);
  const nameNorm = normalizeName(nameRaw);

  const contactIds = new Set<string>();

  if (email) {
    const { data: byEmail } = await supabase
      .from("crm_contacts")
      .select("id")
      .ilike("email", email)
      .limit(50);
    for (const c of byEmail ?? []) contactIds.add(c.id);
  }
  if (phone9) {
    const { data: byPhone } = await supabase
      .from("crm_contacts")
      .select("id, phone")
      .ilike("phone", `%${phone9}%`)
      .limit(200);
    for (const c of byPhone ?? []) {
      if (normalizePhone(c.phone) === phone9) contactIds.add(c.id);
    }
  }
  if (contactIds.size === 0 && nameNorm && nameNorm.length >= 5) {
    const { data: byName } = await supabase
      .from("crm_contacts")
      .select("id, name")
      .ilike("name", `%${nameRaw}%`)
      .limit(50);
    for (const c of byName ?? []) {
      if (normalizeName(c.name) === nameNorm) contactIds.add(c.id);
    }
  }

  if (contactIds.size === 0) {
    return { deal: null, strategy: "no_match" };
  }

  const { data: deals } = await supabase
    .from("crm_deals")
    .select("id, custom_fields, contact_id, updated_at, created_at")
    .in("contact_id", Array.from(contactIds))
    .is("archived_at", null)
    .order("updated_at", { ascending: false })
    .limit(20);

  if (!deals || deals.length === 0) {
    return { deal: null, strategy: "contact_no_deal" };
  }

  if (deals.length === 1) {
    const strat = email ? "customer_email" : phone9 ? "customer_phone" : "customer_name";
    return { deal: deals[0], strategy: strat };
  }

  // Múltiplos: se já existir attendee marcado como contract_paid (provável
  // vínculo manual), priorizar esse deal; caso contrário, preferir o mais
  // recente sem contract_paid_at.
  const dealIds = deals.map((d) => d.id);
  const { data: attendees } = await supabase
    .from("meeting_slot_attendees")
    .select("deal_id, contract_paid_at, created_at")
    .in("deal_id", dealIds)
    .order("created_at", { ascending: false });
  const paid = (attendees ?? []).find((a) => a.contract_paid_at);
  const unpaid = (attendees ?? []).find((a) => !a.contract_paid_at);
  const picked = paid
    ? deals.find((d) => d.id === paid.deal_id) ?? deals[0]
    : unpaid
      ? deals.find((d) => d.id === unpaid.deal_id) ?? deals[0]
      : deals[0];

  // Carregar contatos para mostrar candidatos no log
  const contactRows = new Map<string, { email: string | null; phone: string | null }>();
  if (contactIds.size > 0) {
    const { data: cs } = await supabase
      .from("crm_contacts")
      .select("id, email, phone")
      .in("id", Array.from(contactIds));
    for (const c of cs ?? []) contactRows.set(c.id, { email: c.email, phone: c.phone });
  }

  return {
    deal: picked,
    strategy: (email ? "customer_email" : phone9 ? "customer_phone" : "customer_name") + "_ambiguous_resolved",
    candidates: deals.map((d: any) => ({
      id: d.id,
      name: null,
      contact_email: contactRows.get(d.contact_id)?.email ?? null,
      contact_phone: contactRows.get(d.contact_id)?.phone ?? null,
    })),
  };
}

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

  if (!event) {
    await log({
      deal_id: dealId,
      event: "callback",
      status: "failed",
      http_status: 400,
      payload: body,
      response: null,
      error_message: "missing_event",
      signature_preview: expected.slice(0, 16),
    });
    return json({ ok: false, error: "missing_event" }, 400);
  }

  // Resolver deal por múltiplas estratégias (id, transaction_id, cliente)
  const resolved = await resolveDeal(data);
  let deal: any = resolved.deal;
  let matchStrategy = resolved.strategy;
  let resolvedDealId = deal?.id ?? dealId;

  if (!deal) {
    await log({
      deal_id: dealId,
      event,
      status: "failed",
      http_status: 404,
      payload: body,
      response: {
        match_strategy: matchStrategy,
        tried: {
          crm_deal_id: data?.crm_deal_id ?? null,
          deal_id: data?.deal_id ?? null,
          transaction_id: transactionId,
          customer_email: data?.customer?.email ?? data?.customer_email ?? null,
          customer_phone: data?.customer?.phone ?? data?.customer_phone ?? null,
          customer_name: data?.customer?.name ?? data?.customer_name ?? null,
        },
      },
      error_message: "deal_not_found",
      signature_preview: expected.slice(0, 16),
    });
    return json({ ok: false, error: "deal_not_found", match_strategy: matchStrategy }, 404);
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
  const alreadyPaid = Boolean(attendee?.contract_paid_at);
  // Preserva contract_paid_at existente (fonte de verdade da venda manual).
  const finalContractPaidAt = attendee?.contract_paid_at ?? effectivePaidAt;
  const keptExisting = alreadyPaid;

  // Atualiza custom_fields no deal (fonte mcf_pay)
  const currentCustom = (deal.custom_fields as Record<string, unknown>) ?? {};
  const newCustom = {
    ...currentCustom,
    payment_source: isRefunded ? "mcf_pay_refunded" : "mcf_pay",
    mcf_pay_paid_at: isPaid ? effectivePaidAt : currentCustom.mcf_pay_paid_at ?? null,
    mcf_pay_amount: isPaid ? amount : currentCustom.mcf_pay_amount ?? null,
    mcf_pay_transaction_id: transactionId ?? currentCustom.mcf_pay_transaction_id ?? null,
    mcf_pay_last_event_at: new Date().toISOString(),
    mcf_pay_refunded_at: isRefunded
      ? new Date().toISOString()
      : currentCustom.mcf_pay_refunded_at ?? null,
  };
  await supabase.from("crm_deals").update({ custom_fields: newCustom as never }).eq("id", resolvedDealId);

  if (attendee) {
    if (isPaid) {
      await supabase
        .from("meeting_slot_attendees")
        .update({
          contract_paid_at: finalContractPaidAt,
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

  // === Registra atividade canônica de reembolso (fonte oficial de contagem) ===
  if (isRefunded) {
    try {
      const refundedAtIso = new Date().toISOString();
      await supabase.from("deal_activities").insert({
        deal_id: resolvedDealId,
        activity_type: "refund_mcf_pay",
        description: `MCF PAY estornou pagamento (tx ${transactionId ?? "s/id"})`,
        metadata: {
          source: "mcf_pay",
          refunded_at: refundedAtIso,
          transaction_id: transactionId,
          amount,
          event,
        },
      } as never);
    } catch (err) {
      console.warn("[mcf-pay-callback] falha ao registrar deal_activities refund_mcf_pay:", err);
    }
  }

  await log({
    deal_id: dealId,
    event,
    status: "success",
    http_status: 200,
    payload: body,
    response: {
      ok: true,
      attendee_id: attendee?.id ?? null,
      applied: isPaid ? "paid" : "refunded",
      already_paid: alreadyPaid,
      kept_existing_contract_paid_at: keptExisting,
      match_strategy: matchStrategy,
      resolved_deal_id: resolvedDealId,
      candidates: resolved.candidates ?? null,
    },
    signature_preview: expected.slice(0, 16),
  });

  // === Registro no módulo Financeiro > À Receber (não altera parcelas — só histórico) ===
  try {
    const arEmail =
      (data?.customer?.email ?? data?.customer_email ?? null)?.toString().toLowerCase().trim() || null;
    if (arEmail) {
      const { data: titulos } = await supabase
        .from("ar_titulos")
        .select("id")
        .eq("customer_email", arEmail)
        .in("product_code", ["A001", "A002", "A003", "A004", "A009"])
        .neq("status", "cancelado");
      if (titulos && titulos.length > 0) {
        const rows = titulos.map((t: any) => ({
          titulo_id: t.id,
          tipo: isPaid ? "mcf_pay_confirmacao" : "mcf_pay_reembolso",
          descricao: isPaid
            ? `MCF PAY confirmou recebimento (tx ${transactionId ?? "s/id"})`
            : `MCF PAY estornou pagamento (tx ${transactionId ?? "s/id"})`,
          valor: amount ?? null,
          metadata: {
            transaction_id: transactionId,
            paid_at: effectivePaidAt,
            deal_id: resolvedDealId,
            event,
          },
        }));
        await supabase.from("ar_historico").insert(rows as never);
      }
    }
  } catch (err) {
    console.warn("[ar_historico] falha ao registrar evento MCF PAY:", err);
  }

  return json({
    ok: true,
    deal_id: dealId,
    resolved_deal_id: resolvedDealId,
    attendee_id: attendee?.id ?? null,
    already_paid: alreadyPaid,
    match_strategy: matchStrategy,
  });
});