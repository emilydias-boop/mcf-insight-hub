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

// Regra de negócio (Matheus, 28/09/2026): SÓ a compra do contrato (A000) é "contrato pago".
// Qualquer outro produto comprado pelo MCF Pay (A003 Anticrise, A005 P2, A001, A009,
// Construir Para Morar, Consórcio...) é VENDA DIRETA: não marca contract_paid na agenda,
// não marca refunded_at na agenda e não gera refund_mcf_pay (que é a contagem oficial de
// estorno de contrato).
const CONTRACT_PRODUCT_IDS = new Set(["59ea1243-14a3-4400-af39-555a24f12f34"]);
const CONTRACT_NAME_RE = /(^|\W)(A000|contrato)(\W|$)/i;

function isContractPurchase(data: any): { contract: boolean; products: string[]; known: boolean } {
  const list = Array.isArray(data?.products) ? data.products : null;
  if (!list || list.length === 0) {
    // Payload antigo sem lista de produtos: mantém o comportamento anterior (trata como contrato).
    return { contract: true, products: [], known: false };
  }
  const names = list.map((p: any) => String(p?.name ?? "")).filter(Boolean);
  const contract = list.some(
    (p: any) => CONTRACT_PRODUCT_IDS.has(String(p?.id ?? "")) || CONTRACT_NAME_RE.test(String(p?.name ?? "")),
  );
  return { contract, products: names, known: true };
}

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
    .replace(/[̀-ͯ]/g, "")
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

  // Fallback: se ainda não achou nada mas temos email, tentar recuperar
  // telefone/nome via hubla_transactions do mesmo cliente e refazer o match.
  if (contactIds.size === 0 && email) {
    const { data: hublaRows } = await supabase
      .from("hubla_transactions")
      .select("customer_phone, customer_name")
      .ilike("customer_email", email)
      .not("customer_phone", "is", null)
      .limit(10);
    const phonesTried = new Set<string>();
    for (const row of hublaRows ?? []) {
      const p9 = normalizePhone(row.customer_phone);
      if (p9 && !phonesTried.has(p9)) {
        phonesTried.add(p9);
        const { data: byPhone } = await supabase
          .from("crm_contacts")
          .select("id, phone")
          .ilike("phone", `%${p9}%`)
          .limit(200);
        for (const c of byPhone ?? []) {
          if (normalizePhone(c.phone) === p9) contactIds.add(c.id);
        }
      }
      if (contactIds.size === 0) {
        const nm = normalizeName(row.customer_name);
        if (nm && nm.length >= 5) {
          const { data: byName } = await supabase
            .from("crm_contacts")
            .select("id, name")
            .ilike("name", `%${row.customer_name}%`)
            .limit(50);
          for (const c of byName ?? []) {
            if (normalizeName(c.name) === nm) contactIds.add(c.id);
          }
        }
      }
      if (contactIds.size > 0) break;
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

async function registrarHistoricoAR(
  data: any, isPaid: boolean, transactionId: string | null, amount: number | null,
  effectivePaidAt: string, resolvedDealId: string, event: string,
) {
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
  const purchase = isContractPurchase(data);

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

  const effectivePaidAt = paidAt ?? new Date().toISOString();
  const currentCustom = (deal.custom_fields as Record<string, unknown>) ?? {};

  // ===== VENDA DIRETA (produto que não é contrato) =====
  // Registra no negócio, mas NÃO toca na agenda (contract_paid / refunded_at) nem gera
  // refund_mcf_pay. A venda em si já entra pelo webhook de vendas (hubla_transactions).
  if (!purchase.contract) {
    const prevList = Array.isArray(currentCustom.mcf_pay_vendas_diretas)
      ? (currentCustom.mcf_pay_vendas_diretas as unknown[])
      : [];
    const entry = {
      transaction_id: transactionId,
      produtos: purchase.products,
      amount,
      paid_at: isPaid ? effectivePaidAt : null,
      refunded_at: isRefunded ? new Date().toISOString() : null,
      event,
      recebido_em: new Date().toISOString(),
    };
    const newCustomVd = {
      ...currentCustom,
      mcf_pay_vendas_diretas: [...prevList, entry].slice(-20),
      mcf_pay_last_event_at: new Date().toISOString(),
    };
    await supabase.from("crm_deals").update({ custom_fields: newCustomVd as never }).eq("id", resolvedDealId);

    try {
      await supabase.from("deal_activities").insert({
        deal_id: resolvedDealId,
        activity_type: isRefunded ? "venda_direta_estornada" : "venda_direta_mcf_pay",
        description: isRefunded
          ? `MCF PAY estornou venda direta: ${purchase.products.join(" + ")} (tx ${transactionId ?? "s/id"})`
          : `Venda direta pelo MCF PAY: ${purchase.products.join(" + ")} — não é contrato pago (tx ${transactionId ?? "s/id"})`,
        metadata: { source: "mcf_pay", transaction_id: transactionId, amount, event, produtos: purchase.products },
      } as never);
    } catch (err) {
      console.warn("[mcf-pay-callback] falha ao registrar venda direta:", err);
    }

    await log({
      deal_id: dealId,
      event,
      status: "success",
      http_status: 200,
      payload: body,
      response: {
        ok: true,
        applied: isPaid ? "venda_direta" : "venda_direta_estornada",
        contrato: false,
        produtos: purchase.products,
        match_strategy: matchStrategy,
        resolved_deal_id: resolvedDealId,
        candidates: resolved.candidates ?? null,
      },
      signature_preview: expected.slice(0, 16),
    });

    await registrarHistoricoAR(data, isPaid, transactionId, amount, effectivePaidAt, resolvedDealId, event);

    return json({
      ok: true,
      deal_id: dealId,
      resolved_deal_id: resolvedDealId,
      applied: isPaid ? "venda_direta" : "venda_direta_estornada",
      match_strategy: matchStrategy,
    });
  }

  // ===== CONTRATO (A000) =====
  // 1º: attendee de R1 mais recente do deal (não cancelado/reagendado).
  // Só sem nenhuma R1 no deal cai no attendee mais recente (comportamento antigo).
  let attendeeCriterio: "r1" | "fallback_mais_recente" = "r1";
  const { data: r1Attendees } = await supabase
    .from("meeting_slot_attendees")
    .select("id, contract_paid_at, status, meeting_slot_id, meeting_slot:meeting_slots!inner(meeting_type, status)")
    .eq("deal_id", resolvedDealId)
    .eq("meeting_slot.meeting_type", "r1")
    .not("status", "in", "(cancelled,rescheduled)")
    .not("meeting_slot.status", "in", "(canceled,cancelled,rescheduled)")
    .order("created_at", { ascending: false })
    .limit(1);
  let attendee: { id: string; contract_paid_at: string | null; status: string | null; meeting_slot_id: string | null } | null =
    (r1Attendees?.[0] as never) ?? null;
  if (!attendee) {
    attendeeCriterio = "fallback_mais_recente";
    const { data: attendees } = await supabase
      .from("meeting_slot_attendees")
      .select("id, contract_paid_at, status, meeting_slot_id")
      .eq("deal_id", resolvedDealId)
      .order("created_at", { ascending: false })
      .limit(1);
    attendee = attendees?.[0] ?? null;
  }

  const alreadyPaid = Boolean(attendee?.contract_paid_at);
  // Preserva contract_paid_at existente (fonte de verdade da venda manual).
  const finalContractPaidAt = attendee?.contract_paid_at ?? effectivePaidAt;
  const keptExisting = alreadyPaid;

  // Atualiza custom_fields no deal (fonte mcf_pay)
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

  if (attendee && isPaid) {
    await supabase
      .from("meeting_slot_attendees")
      .update({
        contract_paid_at: finalContractPaidAt,
        status: "contract_paid",
      })
      .eq("id", attendee.id);
  }

  // Reembolso de contrato: a RPC marca refunded_at na linha do contrato pago + R1/R2
  // mais recentes e grava custom_fields.contrato_reembolsado_em. Não mexe em status/etapa.
  let reemb: unknown = null;
  if (isRefunded) {
    const { data: reembData, error: reembErr } = await supabase.rpc("marcar_reembolso_contrato", {
      p_deal_id: resolvedDealId,
      p_refunded_at: new Date().toISOString(),
      p_fonte: "mcf_pay",
      p_transaction_id: transactionId,
    });
    if (reembErr) console.error("[mcf-pay-callback] marcar_reembolso_contrato error:", reembErr);
    reemb = reembData;
  }

  // === Registra atividade canônica de reembolso (fonte oficial de contagem) ===
  if (isRefunded) {
    try {
      const refundedAtIso = new Date().toISOString();
      const { error: actErr } = await supabase.from("deal_activities").insert({
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
      if (actErr) {
        console.error("[mcf-pay-callback] deal_activities insert error:", actErr);
      }
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
      attendee_criterio: attendeeCriterio,
      applied: isPaid ? "paid" : "refunded",
      contrato: true,
      reembolso_contrato: reemb ?? null,
      produtos_informados: purchase.known,
      already_paid: alreadyPaid,
      kept_existing_contract_paid_at: keptExisting,
      match_strategy: matchStrategy,
      resolved_deal_id: resolvedDealId,
      candidates: resolved.candidates ?? null,
    },
    signature_preview: expected.slice(0, 16),
  });

  await registrarHistoricoAR(data, isPaid, transactionId, amount, effectivePaidAt, resolvedDealId, event);

  return json({
    ok: true,
    deal_id: dealId,
    resolved_deal_id: resolvedDealId,
    attendee_id: attendee?.id ?? null,
    already_paid: alreadyPaid,
    match_strategy: matchStrategy,
  });
});
