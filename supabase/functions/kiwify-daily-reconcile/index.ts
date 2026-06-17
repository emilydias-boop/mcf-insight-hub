import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

// ============================================================
// Reconciliador diário Kiwify
// - Busca vendas dos últimos N dias na API Kiwify (OAuth2)
// - Insere transações ausentes em hubla_transactions
// - Para A010 primeira parcela: cria deal em PIPELINE INSIDE SALES
//   usando MESMA lógica do kiwify-webhook-handler
// - Loga execução em hubla_webhook_logs (event_type=kiwify:reconcile)
// ============================================================

const KIWIFY_OAUTH_URL = "https://public-api.kiwify.com/v1/oauth/token";
const KIWIFY_SALES_URL = "https://public-api.kiwify.com/v1/sales";
const PIPELINE_INSIDE_SALES_ORIGIN = "PIPELINE INSIDE SALES";
const DEFAULT_LOOKBACK_DAYS = 3;

const PRODUCT_MAPPING: Record<string, string> = {
  A010: "a010", A011: "a010", A012: "a010",
  A000: "incorporador", A001: "incorporador", A002: "incorporador",
  A003: "incorporador", A004: "incorporador", A005: "incorporador",
  A008: "incorporador", A009: "incorporador",
  R001: "incorporador", R004: "incorporador", R005: "incorporador",
  R006: "incorporador", R009: "incorporador", R21: "incorporador",
  Contrato: "contrato", CONTRATO: "contrato",
  OB: "orderbump",
  "Imersão Presencial": "ob_evento",
  "Acesso Vitalício": "ob_acesso",
  "Construir Para Alugar": "ob_construir",
};

function mapProductCategory(productName: string, productCode?: string): string {
  if (!productName) return "outros";
  const upperName = productName.toUpperCase();
  if (productCode) {
    for (const [key, value] of Object.entries(PRODUCT_MAPPING)) {
      if (productCode.toUpperCase().includes(key.toUpperCase())) return value;
    }
  }
  if (/A01[012]/.test(upperName)) return "a010";
  if (upperName.includes("CONTRATO") || upperName.includes("A000")) return "contrato";
  if (upperName.includes("MCF") || upperName.includes("INCORPORADOR") || upperName.includes("ANTICRISE")) return "incorporador";
  if (upperName.includes("ORDER BUMP") || upperName.includes("OB ")) return "orderbump";
  if (upperName.includes("IMERSÃO PRESENCIAL")) return "ob_evento";
  if (upperName.includes("ACESSO VITALÍCIO")) return "ob_acesso";
  if (upperName.includes("CONSTRUIR PARA ALUGAR")) return "ob_construir";
  return "outros";
}

function normalizePhone(phone: string | null): string | null {
  if (!phone) return null;
  let clean = phone.replace(/\D/g, "");
  if (!clean) return null;
  if (clean.startsWith("0")) clean = clean.substring(1);
  if (!clean.startsWith("55") && clean.length <= 11) clean = "55" + clean;
  return "+" + clean;
}

function convertKiwifyDateToUTC(dateStr: string): string {
  if (!dateStr) return new Date().toISOString();
  if (dateStr.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(dateStr)) {
    return new Date(dateStr).toISOString();
  }
  const dateWithTz = `${dateStr.replace(" ", "T")}-03:00`;
  return new Date(dateWithTz).toISOString();
}

async function checkIfPartner(supabase: any, email: string | null) {
  if (!email) return { isPartner: false, product: null as string | null };
  const PARTNER_PRODUCTS = ["A001", "A002", "A003", "A004", "A009"];
  const { data: transactions } = await supabase
    .from("hubla_transactions")
    .select("product_name")
    .ilike("customer_email", email)
    .eq("sale_status", "completed")
    .limit(50);
  if (!transactions?.length) return { isPartner: false, product: null };
  for (const tx of transactions) {
    const name = (tx.product_name || "").toUpperCase();
    for (const code of PARTNER_PRODUCTS) {
      if (name.includes(code)) return { isPartner: true, product: code };
    }
    if (name.includes("INCORPORADOR") && !name.includes("CONTRATO") && !name.includes("A010")) {
      return { isPartner: true, product: "MCF Incorporador" };
    }
    if (name.includes("ANTICRISE") && !name.includes("CONTRATO")) {
      return { isPartner: true, product: "Anticrise" };
    }
  }
  return { isPartner: false, product: null };
}

// Replica createOrUpdateKiwifyCRMContact do webhook handler (versão reconcile:
// usa sale_date como base para custom_fields.a010_data quando fornecida)
async function createOrUpdateKiwifyCRMContact(
  supabase: any,
  data: {
    email: string | null;
    phone: string | null;
    name: string | null;
    productName: string;
    value: number;
    saleDate: string;
    extraTags?: string[];
  },
): Promise<{ dealId: string | null }> {
  if (!data.email && !data.phone) return { dealId: null };

  const partnerCheck = await checkIfPartner(supabase, data.email);
  if (partnerCheck.isPartner) {
    let contactId: string | null = null;
    if (data.email) {
      const { data: contact } = await supabase
        .from("crm_contacts")
        .select("id")
        .ilike("email", data.email)
        .limit(1)
        .maybeSingle();
      contactId = contact?.id || null;
    }
    await supabase.from("partner_returns").insert({
      contact_id: contactId,
      contact_email: data.email,
      contact_name: data.name,
      partner_product: partnerCheck.product,
      return_source: "kiwify_a010_reconcile",
      return_product: data.productName,
      return_value: data.value || 0,
      blocked: true,
    });
    return { dealId: null };
  }

  const normalizedPhone = normalizePhone(data.phone);
  const targetStageName = "Novo Lead";
  const targetTags = data.extraTags?.length ? data.extraTags : ["A010", "A010 Kiwify"];

  // origem
  let originId: string | null = null;
  const { data: existingOrigins } = await supabase
    .from("crm_origins")
    .select("id")
    .ilike("name", PIPELINE_INSIDE_SALES_ORIGIN)
    .order("created_at", { ascending: true })
    .limit(1);
  if (existingOrigins?.length) originId = existingOrigins[0].id;

  if (!originId) return { dealId: null };

  // contato
  let contactId: string | null = null;
  let existingContact: any = null;

  if (data.email) {
    const { data: allByEmail } = await supabase
      .from("crm_contacts")
      .select("id, phone")
      .ilike("email", data.email)
      .eq("is_archived", false)
      .order("created_at", { ascending: true })
      .limit(20);
    if (allByEmail?.length) {
      for (const c of allByEmail) {
        const { data: dealForContact } = await supabase
          .from("crm_deals")
          .select("id")
          .eq("contact_id", c.id)
          .eq("origin_id", originId)
          .limit(1)
          .maybeSingle();
        if (dealForContact) {
          contactId = c.id;
          existingContact = c;
          break;
        }
      }
      if (!contactId) {
        contactId = allByEmail[0].id;
        existingContact = allByEmail[0];
      }
    }
  }

  if (!contactId && normalizedPhone) {
    const phoneDigits = normalizedPhone.replace(/\D/g, "");
    const { data: byPhone } = await supabase
      .from("crm_contacts")
      .select("id, email, phone")
      .or(`phone.eq.${normalizedPhone},phone.eq.+${phoneDigits},phone.eq.${phoneDigits}`)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (byPhone) {
      existingContact = byPhone;
      contactId = byPhone.id;
    }
  }

  if (existingContact && normalizedPhone && existingContact.phone !== normalizedPhone) {
    await supabase
      .from("crm_contacts")
      .update({ phone: normalizedPhone, updated_at: new Date().toISOString() })
      .eq("id", existingContact.id);
  }

  if (!contactId) {
    const { data: newContact } = await supabase
      .from("crm_contacts")
      .insert({
        clint_id: `kiwify-reconcile-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        name: data.name || "Cliente A010",
        email: data.email,
        phone: normalizedPhone,
        origin_id: originId,
        tags: targetTags,
        custom_fields: { source: "kiwify", product: data.productName, via: "reconcile" },
      })
      .select("id")
      .single();
    contactId = newContact?.id || null;
  }

  if (!contactId) return { dealId: null };

  // deal existente?
  let existingDeal: any = null;
  const { data: dealByContactOrigin } = await supabase
    .from("crm_deals")
    .select("id, tags, value, custom_fields, stage_id")
    .eq("contact_id", contactId)
    .eq("origin_id", originId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (dealByContactOrigin) existingDeal = dealByContactOrigin;

  if (existingDeal) {
    const currentTags: string[] = existingDeal.tags || [];
    const newTags = currentTags.filter((t) => !/^a010 em aberto$/i.test(t));
    if (!newTags.includes("A010")) newTags.push("A010");
    if (!newTags.includes("A010 Kiwify")) newTags.push("A010 Kiwify");

    const updatedCustomFields = {
      ...(existingDeal.custom_fields || {}),
      a010_compra: true,
      a010_produto: data.productName,
      a010_data: data.saleDate,
      source: "kiwify",
      via_reconcile: true,
    };
    const newValue = Math.max(existingDeal.value || 0, data.value || 0);

    let promotedStageId: string | null = null;
    if (existingDeal.stage_id) {
      const { data: currentStage } = await supabase
        .from("crm_stages")
        .select("stage_name")
        .eq("id", existingDeal.stage_id)
        .maybeSingle();
      if (currentStage && /a010 em aberto/i.test(currentStage.stage_name || "")) {
        const { data: novoLead } = await supabase
          .from("crm_stages")
          .select("id")
          .eq("origin_id", originId)
          .eq("stage_name", "Novo Lead")
          .limit(1)
          .maybeSingle();
        if (novoLead) promotedStageId = novoLead.id;
      }
    }

    const updatePayload: any = {
      tags: newTags,
      value: newValue,
      custom_fields: updatedCustomFields,
      updated_at: new Date().toISOString(),
    };
    if (promotedStageId) {
      updatePayload.stage_id = promotedStageId;
      updatePayload.stage_moved_at = new Date().toISOString();
    }
    await supabase.from("crm_deals").update(updatePayload).eq("id", existingDeal.id);
    return { dealId: existingDeal.id };
  }

  // stage Novo Lead
  let stageId: string | null = null;
  const { data: targetStage } = await supabase
    .from("crm_stages")
    .select("id")
    .eq("origin_id", originId)
    .eq("stage_name", targetStageName)
    .limit(1)
    .maybeSingle();
  if (targetStage) stageId = targetStage.id;
  else {
    const { data: fallbackStage } = await supabase
      .from("crm_stages")
      .select("id")
      .eq("origin_id", originId)
      .order("stage_order", { ascending: true })
      .limit(1)
      .maybeSingle();
    stageId = fallbackStage?.id || null;
  }

  // owner — distribuição
  let distributedOwnerId: string | null = null;
  let distributedOwnerProfileId: string | null = null;
  let wasDistributed = false;
  try {
    const { data: distConfig } = await supabase
      .from("lead_distribution_config")
      .select("id")
      .eq("origin_id", originId)
      .eq("is_active", true)
      .limit(1);
    if (distConfig?.length) {
      const { data: nextOwnerEmail } = await supabase.rpc("get_next_lead_owner", { p_origin_id: originId });
      if (nextOwnerEmail) {
        distributedOwnerId = nextOwnerEmail;
        wasDistributed = true;
        const { data: ownerProfile } = await supabase
          .from("profiles")
          .select("id")
          .ilike("email", distributedOwnerId)
          .maybeSingle();
        if (ownerProfile) distributedOwnerProfileId = ownerProfile.id;
      }
    }
  } catch (e) {
    console.error("[Reconcile] dist erro:", e);
  }

  let inheritedOwnerId: string | null = null;
  let inheritedOwnerProfileId: string | null = null;
  if (!wasDistributed) {
    const { data: dealWithOwner } = await supabase
      .from("crm_deals")
      .select("owner_id, owner_profile_id")
      .eq("contact_id", contactId)
      .not("owner_id", "is", null)
      .limit(1)
      .maybeSingle();
    if (dealWithOwner?.owner_id) {
      inheritedOwnerId = dealWithOwner.owner_id;
      inheritedOwnerProfileId = dealWithOwner.owner_profile_id;
    }
  }

  const finalOwnerId = wasDistributed ? distributedOwnerId : inheritedOwnerId;
  const finalOwnerProfileId = wasDistributed ? distributedOwnerProfileId : inheritedOwnerProfileId;

  // IMPORTANTE: created_at = saleDate (preserva a data real da venda)
  const dealData: any = {
    clint_id: `kiwify-reconcile-deal-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    name: `${data.name || "Cliente"} - A010`,
    value: data.value || 0,
    contact_id: contactId,
    origin_id: originId,
    stage_id: stageId,
    owner_id: finalOwnerId,
    owner_profile_id: finalOwnerProfileId,
    product_name: data.productName,
    tags: targetTags,
    custom_fields: {
      source: "kiwify",
      product: data.productName,
      a010_compra: true,
      a010_data: data.saleDate,
      via_reconcile: true,
      ...(wasDistributed ? { distributed: true } : {}),
    },
    data_source: "reconcile",
    stage_moved_at: data.saleDate,
    created_at: data.saleDate,
  };

  const { data: newDeal, error: dealError } = await supabase
    .from("crm_deals")
    .insert(dealData)
    .select("id")
    .maybeSingle();

  if (dealError) {
    if (dealError.code === "23505" || dealError.message?.includes("duplicate")) return { dealId: null };
    console.error("[Reconcile] erro criar deal:", dealError);
    return { dealId: null };
  }
  return { dealId: newDeal?.id || null };
}

// ============================================================
// Kiwify API helpers
// ============================================================
async function getKiwifyAccessToken(clientId: string, clientSecret: string): Promise<string> {
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "client_credentials",
  });
  const resp = await fetch(KIWIFY_OAUTH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const text = await resp.text();
  if (!resp.ok) throw new Error(`OAuth Kiwify falhou (${resp.status}): ${text}`);
  const json = JSON.parse(text);
  if (!json.access_token) throw new Error(`OAuth Kiwify sem access_token: ${text}`);
  return json.access_token as string;
}

async function fetchKiwifySales(
  token: string,
  accountId: string | null,
  startDate: string,
  endDate: string,
): Promise<any[]> {
  const all: any[] = [];
  let page = 1;
  const pageSize = 100;
  // Paginação simples — Kiwify aceita page/page_size em /v1/sales
  while (page <= 50) {
    const params = new URLSearchParams({
      start_date: startDate,
      end_date: endDate,
      status: "paid",
      page_size: String(pageSize),
      page_number: String(page),
    });
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    };
    if (accountId) headers["x-kiwify-account-id"] = accountId;

    const resp = await fetch(`${KIWIFY_SALES_URL}?${params.toString()}`, { headers });
    const text = await resp.text();
    if (!resp.ok) throw new Error(`GET /v1/sales falhou (${resp.status}): ${text.slice(0, 500)}`);
    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error(`Resposta Kiwify não é JSON: ${text.slice(0, 200)}`);
    }
    const items: any[] = Array.isArray(json) ? json : json.data || json.sales || json.items || [];
    if (!items.length) break;
    all.push(...items);
    if (items.length < pageSize) break;
    page++;
  }
  return all;
}

function extractOrderId(sale: any): string | null {
  return (
    sale.order_id ||
    sale.id ||
    sale.Order?.order_id ||
    sale.order?.order_id ||
    null
  );
}

function pickFirst(...vals: any[]): any {
  for (const v of vals) if (v !== undefined && v !== null && v !== "") return v;
  return null;
}

// ============================================================
// HANDLER
// ============================================================
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startedAt = Date.now();
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const clientId = Deno.env.get("KIWIFY_CLIENT_ID");
  const clientSecret = Deno.env.get("KIWIFY_CLIENT_SECRET");
  const accountId = Deno.env.get("KIWIFY_ACCOUNT_ID") || null;

  // log inicial
  const { data: logEntry } = await supabase
    .from("hubla_webhook_logs")
    .insert({ event_type: "kiwify:reconcile", event_data: {}, status: "processing" })
    .select("id")
    .single();
  const logId = logEntry?.id;

  const counters = { fetched: 0, inserted: 0, dealsCreated: 0, skipped: 0, errors: 0 };
  const recovered: any[] = [];
  const errorSamples: any[] = [];

  try {
    if (!clientId || !clientSecret) {
      throw new Error("KIWIFY_CLIENT_ID / KIWIFY_CLIENT_SECRET não configurados");
    }

    // Parse params
    let lookbackDays = DEFAULT_LOOKBACK_DAYS;
    try {
      if (req.method === "POST") {
        const body = await req.json().catch(() => ({}));
        if (body?.lookbackDays && Number.isFinite(body.lookbackDays)) {
          lookbackDays = Math.max(1, Math.min(30, Number(body.lookbackDays)));
        }
      }
    } catch { /* ignore */ }

    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - lookbackDays * 24 * 60 * 60 * 1000);
    const fmt = (d: Date) => d.toISOString().split("T")[0];

    console.log(`[Reconcile] Janela: ${fmt(startDate)} → ${fmt(endDate)}`);

    const token = await getKiwifyAccessToken(clientId, clientSecret);
    const sales = await fetchKiwifySales(token, accountId, fmt(startDate), fmt(endDate));
    counters.fetched = sales.length;
    console.log(`[Reconcile] Recebidas ${sales.length} vendas da Kiwify`);

    for (const sale of sales) {
      try {
        const orderId = extractOrderId(sale);
        if (!orderId) {
          counters.skipped++;
          continue;
        }
        const kiwifyId = `kiwify_${orderId}`;

        // Já existe?
        const { data: existing } = await supabase
          .from("hubla_transactions")
          .select("id, linked_deal_id, product_category")
          .eq("hubla_id", kiwifyId)
          .maybeSingle();

        if (existing) {
          counters.skipped++;
          continue;
        }

        const commissions = sale.Commissions || sale.commissions || {};
        const customer = sale.Customer || sale.customer || {};
        const product = sale.Product || sale.product || {};
        const subscription = sale.Subscription || sale.subscription || {};

        const grossCents = pickFirst(commissions.charge_amount, commissions.product_base_price, sale.charge_amount, 0);
        const netCents = pickFirst(commissions.my_commission, commissions.net_amount, grossCents);
        const grossValue = Number(grossCents) / 100;
        const netValue = Number(netCents) / 100;

        const productName = pickFirst(product.product_name, product.name, sale.product_name, "Produto Kiwify");
        const productCode = pickFirst(product.product_id, product.id, sale.product_id, "");
        const productCategory = mapProductCategory(productName, productCode);

        const subscriptionCharges = subscription.charges?.length || 0;
        const installmentNumber = subscriptionCharges > 0
          ? subscriptionCharges
          : pickFirst(sale.installment_number, sale.installment, 1);
        const totalInstallments = pickFirst(subscription.plan?.charges_limit, sale.total_installments, 1);

        const customerName = pickFirst(customer.full_name, customer.name, "");
        const customerEmail = pickFirst(customer.email, "");
        const customerPhone = pickFirst(customer.mobile, customer.phone, "");

        const rawSaleDate = pickFirst(sale.approved_date, sale.paid_at, sale.created_at);
        const saleDate = convertKiwifyDateToUTC(rawSaleDate);

        const { data: inserted, error: insError } = await supabase
          .from("hubla_transactions")
          .insert({
            hubla_id: kiwifyId,
            event_type: "kiwify.purchase_approved",
            product_name: productName,
            product_code: productCode,
            product_category: productCategory,
            product_price: grossValue,
            net_value: netValue,
            customer_name: customerName,
            customer_email: customerEmail,
            customer_phone: customerPhone,
            sale_date: saleDate,
            sale_status: "completed",
            installment_number: installmentNumber,
            total_installments: totalInstallments,
            source: "kiwify",
            raw_data: { ...sale, _via: "reconcile" },
          })
          .select("id")
          .single();

        if (insError) {
          if (insError.code === "23505") {
            counters.skipped++;
            continue;
          }
          throw insError;
        }

        counters.inserted++;
        const transactionId = inserted?.id;

        // A010 primeira parcela → cria deal + a010_sales
        let dealId: string | null = null;
        if (productCategory === "a010" && installmentNumber === 1 && customerName) {
          await supabase.from("a010_sales").insert({
            customer_name: customerName,
            customer_email: customerEmail || null,
            customer_phone: customerPhone || null,
            net_value: netValue,
            sale_date: saleDate.split("T")[0],
            status: "completed",
          });

          const crmResult = await createOrUpdateKiwifyCRMContact(supabase, {
            email: customerEmail || null,
            phone: customerPhone || null,
            name: customerName,
            productName,
            value: grossValue,
            saleDate,
            extraTags: ["A010", "A010 Kiwify"],
          });
          dealId = crmResult.dealId;

          if (dealId && transactionId) {
            await supabase.from("hubla_transactions").update({ linked_deal_id: dealId }).eq("id", transactionId);
            counters.dealsCreated++;
          }
        }

        recovered.push({
          order_id: orderId,
          email: customerEmail,
          product: productName,
          category: productCategory,
          sale_date: saleDate,
          deal_id: dealId,
          transaction_id: transactionId,
        });
      } catch (e) {
        counters.errors++;
        errorSamples.push({
          order_id: extractOrderId(sale),
          error: (e as Error).message,
        });
        console.error("[Reconcile] erro processando venda:", e);
      }
    }

    const processingTime = Date.now() - startedAt;
    const summary = {
      window: { start: fmt(startDate), end: fmt(endDate), lookbackDays },
      counters,
      recovered_sample: recovered.slice(0, 20),
      error_sample: errorSamples.slice(0, 10),
    };

    if (logId) {
      await supabase
        .from("hubla_webhook_logs")
        .update({
          status: counters.errors > 0 ? "partial" : "success",
          processed_at: new Date().toISOString(),
          processing_time_ms: processingTime,
          event_data: summary,
        })
        .eq("id", logId);
    }

    return new Response(
      JSON.stringify({ success: true, ...summary, processingTime }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const msg = (error as Error).message;
    console.error("[Reconcile] FATAL:", error);
    if (logId) {
      await supabase
        .from("hubla_webhook_logs")
        .update({
          status: "error",
          processed_at: new Date().toISOString(),
          processing_time_ms: Date.now() - startedAt,
          event_data: { error: msg, counters },
        })
        .eq("id", logId);
    }
    return new Response(
      JSON.stringify({ success: false, error: msg, counters }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});