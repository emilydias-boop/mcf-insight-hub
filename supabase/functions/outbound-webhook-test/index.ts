import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

function samplePayload() {
  return {
    event: "sale.created",
    occurred_at: new Date().toISOString(),
    transaction_id: "00000000-0000-0000-0000-000000000000",
    source: "hubla",
    external_id: "test_external_id",
    product: {
      name: "A010 - Consultoria (TESTE)",
      category: "a010",
      code: "A010",
      type: "course",
      offer_name: "Oferta Padrão",
      offer_id: "off_123",
    },
    values: {
      gross_system: 47.0,
      gross_product: 47.0,
      gross_override: null,
      net: 41.32,
      currency: "BRL",
    },
    payment: {
      method: "credit_card",
      installment_number: 1,
      total_installments: 1,
      is_recurring: false,
      is_first_installment: true,
    },
    customer: {
      name: "Cliente Teste",
      email: "teste@exemplo.com",
      phone: "+5511999999999",
      cpf: "12345678900",
    },
    sale_date: new Date().toISOString(),
    sale_status: "paid",
    sale_origin: "hubla",
    utm: { source: "test", medium: "test", campaign: "test", content: null },
    _test: true,
  };
}

function consorcioSamplePayload() {
  const now = new Date().toISOString();
  return {
    // Schema raiz compatível com webhook-consorcio (Grima)
    grupo: "TEST",
    cota: "9999",
    valor_credito: 100000,
    prazo_meses: 180,
    tipo_produto: "select",
    tipo_contrato: "normal",
    parcelas_pagas_empresa: 0,
    data_contratacao: now.split("T")[0],
    dia_vencimento: 10,
    origem: "outros",
    origem_detalhe: "TESTE - Webhook Saída",
    tipo_pessoa: "pf",
    nome_completo: "Cliente Teste (PING)",
    cpf: "00000000000",
    email: "teste@exemplo.com",
    telefone: "+5511999999999",
    razao_social: null,
    cnpj: null,
    vendedor_email: null,
    vendedor_name: "Vendedor Teste",

    // Metadados estendidos
    event: "consorcio.venda.criada",
    source: "consorcio",
    external_id: "00000000-0000-0000-0000-000000000000",
    occurred_at: now,
    status: "ativo",
    _test: true,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { config_id } = await req.json();
    if (!config_id) {
      return new Response(JSON.stringify({ error: "config_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: cfg, error } = await supabase
      .from("outbound_webhook_configs")
      .select("*")
      .eq("id", config_id)
      .single();

    if (error || !cfg) {
      return new Response(JSON.stringify({ error: error?.message || "config not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = samplePayload();
    const body = JSON.stringify(payload);
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

    await supabase.from("outbound_webhook_logs").insert({
      config_id: cfg.id,
      event: "test.ping",
      transaction_id: null,
      payload,
      response_status: respStatus || null,
      response_body: respBody || null,
      duration_ms: duration,
      success,
      error_message: errMsg,
    });

    return new Response(
      JSON.stringify({
        success,
        status: respStatus,
        body: respBody,
        duration_ms: duration,
        error: errMsg,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});