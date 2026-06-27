import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SECRET = Deno.env.get("MCF_PAY_WEBHOOK_SECRET") ?? "";

const RETRY_MINUTES = [5, 30, 120];
const MAX_ATTEMPTS = 3;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

async function sign(body: string): Promise<string> {
  if (!SECRET) return "";
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

async function getConfig() {
  const { data } = await supabase.from("mcf_pay_config").select("*").eq("id", true).maybeSingle();
  return data as { webhook_url: string | null; is_active: boolean } | null;
}

async function resolveCodesForDeal(dealId: string) {
  const { data: deal } = await supabase
    .from("crm_deals")
    .select("id, custom_fields, owner_profile_id, original_sdr_email, r1_closer_email, r2_closer_email")
    .eq("id", dealId)
    .maybeSingle();
  if (!deal) return null;

  const custom = (deal.custom_fields as Record<string, unknown>) ?? {};
  let closer_code = (custom.mcf_pay_closer_code as string) || null;
  let sdr_code = (custom.mcf_pay_sdr_code as string) || null;

  const emails = new Set<string>();
  if (deal.r2_closer_email) emails.add(deal.r2_closer_email.toLowerCase());
  if (deal.r1_closer_email) emails.add(deal.r1_closer_email.toLowerCase());
  if (deal.original_sdr_email) emails.add(deal.original_sdr_email.toLowerCase());

  const profilesByEmail = new Map<string, { mcf_pay_closer_code: string | null; mcf_pay_sdr_code: string | null }>();
  if (emails.size > 0) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("email, mcf_pay_closer_code, mcf_pay_sdr_code")
      .in("email", Array.from(emails));
    for (const p of profs ?? []) {
      if (p.email) profilesByEmail.set(p.email.toLowerCase(), p as any);
    }
  }

  if (!closer_code) {
    for (const email of [deal.r2_closer_email, deal.r1_closer_email].filter(Boolean) as string[]) {
      const code = profilesByEmail.get(email.toLowerCase())?.mcf_pay_closer_code;
      if (code) { closer_code = code; break; }
    }
    if (!closer_code && deal.owner_profile_id) {
      const { data: owner } = await supabase
        .from("profiles")
        .select("mcf_pay_closer_code")
        .eq("id", deal.owner_profile_id)
        .maybeSingle();
      closer_code = (owner?.mcf_pay_closer_code as string) || null;
    }
  }

  if (!sdr_code && deal.original_sdr_email) {
    sdr_code = profilesByEmail.get(deal.original_sdr_email.toLowerCase())?.mcf_pay_sdr_code || null;
  }

  return { closer_code, sdr_code };
}

async function dispatch(dealId: string | null, opts: { test?: boolean; previousAttempt?: number; logId?: string } = {}) {
  const config = await getConfig();
  if (!config?.is_active || !config?.webhook_url) {
    await supabase.from("mcf_pay_dispatch_logs").insert({
      deal_id: dealId,
      status: "skipped_inactive",
      error_message: "Integração MCF Pay inativa ou sem URL configurada",
      attempt: (opts.previousAttempt ?? 0) + 1,
    });
    return { ok: false, reason: "inactive" };
  }

  let payload: Record<string, unknown>;
  if (opts.test) {
    payload = {
      event: "deal.paid",
      crm_deal_id: `test-${crypto.randomUUID()}`,
      closer_code: "CL-TEST",
      sdr_code: "SDR-TEST",
      purchase_ref: {},
      _test: true,
    };
  } else {
    if (!dealId) return { ok: false, reason: "missing_deal_id" };
    const codes = await resolveCodesForDeal(dealId);
    if (!codes) {
      await supabase.from("mcf_pay_dispatch_logs").insert({
        deal_id: dealId,
        status: "failed",
        error_message: "Deal não encontrado",
        attempt: (opts.previousAttempt ?? 0) + 1,
      });
      return { ok: false, reason: "deal_not_found" };
    }
    if (!codes.closer_code && !codes.sdr_code) {
      await supabase.from("mcf_pay_dispatch_logs").insert({
        deal_id: dealId,
        status: "skipped_no_codes",
        error_message: "Nenhum closer_code/sdr_code resolvido",
        attempt: (opts.previousAttempt ?? 0) + 1,
      });
      return { ok: false, reason: "no_codes" };
    }
    payload = {
      event: "deal.paid",
      crm_deal_id: dealId,
      closer_code: codes.closer_code ?? undefined,
      sdr_code: codes.sdr_code ?? undefined,
      purchase_ref: {},
    };
  }

  const rawBody = JSON.stringify(payload);
  const signature = await sign(rawBody);
  const attempt = (opts.previousAttempt ?? 0) + 1;

  let httpStatus = 0;
  let responseJson: any = null;
  let errorMessage: string | null = null;
  let status: "success" | "pending" | "failed" = "failed";
  let nextRetryAt: string | null = null;

  try {
    const resp = await fetch(config.webhook_url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-crm-signature": signature },
      body: rawBody,
      signal: AbortSignal.timeout(15000),
    });
    httpStatus = resp.status;
    const text = await resp.text();
    try { responseJson = JSON.parse(text); } catch { responseJson = { raw: text.slice(0, 2000) }; }

    if (resp.status === 200 && responseJson?.ok === true) {
      status = "success";
    } else if (resp.status === 200 && responseJson?.ok === false) {
      const reason = responseJson?.reason;
      if (reason === "purchase_not_found_yet" || reason === "purchase_not_paid_yet") {
        if (attempt >= MAX_ATTEMPTS) {
          status = "failed";
          errorMessage = `Reason ${reason} após ${attempt} tentativas`;
        } else {
          status = "pending";
          const minutes = RETRY_MINUTES[attempt - 1] ?? 120;
          nextRetryAt = new Date(Date.now() + minutes * 60_000).toISOString();
        }
      } else {
        status = "failed";
        errorMessage = `Reason ${reason ?? "unknown"}`;
      }
    } else if (resp.status === 400 && /assinatura/i.test(responseJson?.error ?? "")) {
      status = "failed";
      errorMessage = "Assinatura inválida — não reenviar";
    } else if (attempt < MAX_ATTEMPTS) {
      status = "pending";
      const minutes = RETRY_MINUTES[attempt - 1] ?? 120;
      nextRetryAt = new Date(Date.now() + minutes * 60_000).toISOString();
      errorMessage = `HTTP ${resp.status}`;
    } else {
      status = "failed";
      errorMessage = `HTTP ${resp.status} após ${attempt} tentativas`;
    }
  } catch (e) {
    errorMessage = (e as Error).message?.slice(0, 500) ?? "fetch failed";
    if (attempt < MAX_ATTEMPTS) {
      status = "pending";
      const minutes = RETRY_MINUTES[attempt - 1] ?? 120;
      nextRetryAt = new Date(Date.now() + minutes * 60_000).toISOString();
    }
  }

  const logRow = {
    deal_id: opts.test ? null : dealId,
    event: "deal.paid",
    status,
    attempt,
    http_status: httpStatus || null,
    payload,
    response: responseJson,
    signature_preview: signature ? signature.slice(0, 16) : null,
    error_message: errorMessage,
    next_retry_at: nextRetryAt,
    sent_at: status === "success" ? new Date().toISOString() : null,
  };

  if (opts.logId) {
    await supabase.from("mcf_pay_dispatch_logs").update(logRow).eq("id", opts.logId);
  } else {
    await supabase.from("mcf_pay_dispatch_logs").insert(logRow);
  }

  return { ok: status === "success", status, httpStatus, response: responseJson, error: errorMessage };
}

async function processRetryQueue() {
  const { data: queued } = await supabase
    .from("mcf_pay_dispatch_logs")
    .select("id, deal_id, attempt")
    .eq("status", "pending")
    .lte("next_retry_at", new Date().toISOString())
    .limit(20);
  const results = [];
  for (const row of queued ?? []) {
    if (!row.deal_id) continue;
    const r = await dispatch(row.deal_id, { previousAttempt: row.attempt, logId: row.id });
    results.push({ id: row.id, ...r });
  }
  return { processed: results.length, results };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    if (body.retry_queue) {
      const r = await processRetryQueue();
      return new Response(JSON.stringify(r), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (body.test === true) {
      const r = await dispatch(null, { test: true });
      return new Response(JSON.stringify(r), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (body.deal_id) {
      const r = await dispatch(body.deal_id, { previousAttempt: body.force ? 0 : undefined });
      return new Response(JSON.stringify(r), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ error: "missing deal_id, test or retry_queue" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});