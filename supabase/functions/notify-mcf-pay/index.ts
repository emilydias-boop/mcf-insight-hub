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
    .select("id, custom_fields, owner_profile_id, original_sdr_email, r1_closer_email, r2_closer_email, contact_id")
    .eq("id", dealId)
    .maybeSingle();
  if (!deal) return null;

  const custom = (deal.custom_fields as Record<string, unknown>) ?? {};
  let closer_code = (custom.mcf_pay_closer_code as string) || null;
  let sdr_code = (custom.mcf_pay_sdr_code as string) || null;
  const transaction_id = (custom.mcf_pay_transaction_id as string) || null;

  const tried: string[] = [];

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
      tried.push(email === deal.r2_closer_email ? "r2_email" : "r1_email");
      const code = profilesByEmail.get(email.toLowerCase())?.mcf_pay_closer_code;
      if (code) { closer_code = code; break; }
    }
  }

  if (!sdr_code && deal.original_sdr_email) {
    tried.push("sdr_email");
    sdr_code = profilesByEmail.get(deal.original_sdr_email.toLowerCase())?.mcf_pay_sdr_code || null;
  }

  // ===== Fallbacks via agenda (meeting_slot_attendees + meeting_slots) =====
  // Necessário quando o deal não tem r1/r2_closer_email/original_sdr_email preenchidos,
  // mas o SDR agendou a reunião no calendário do Closer.
  if (!closer_code || !sdr_code) {
    const { data: attendees } = await supabase
      .from("meeting_slot_attendees")
      .select("booked_by, booked_at, meeting_slot_id")
      .eq("deal_id", dealId)
      .order("booked_at", { ascending: false, nullsFirst: false })
      .limit(10);

    const rows = (attendees ?? []) as any[];

    // Buscar slots relacionados (sem depender de FK definido no PostgREST)
    const slotIds = Array.from(
      new Set(rows.map((r) => r.meeting_slot_id).filter(Boolean) as string[]),
    );
    const slotById = new Map<string, { closer_id: string | null; scheduled_at: string | null }>();
    if (slotIds.length > 0) {
      const { data: slots } = await supabase
        .from("meeting_slots")
        .select("id, closer_id, scheduled_at")
        .in("id", slotIds);
      for (const s of slots ?? []) {
        slotById.set(s.id as string, {
          closer_id: (s as any).closer_id ?? null,
          scheduled_at: (s as any).scheduled_at ?? null,
        });
      }
    }
    for (const r of rows) {
      (r as any).meeting_slots = r.meeting_slot_id ? slotById.get(r.meeting_slot_id) ?? null : null;
    }

    // SDR fallback: booked_by do attendee mais recente → profiles.mcf_pay_sdr_code
    if (!sdr_code) {
      const bookedByIds = Array.from(
        new Set(rows.map((r) => r.booked_by).filter(Boolean) as string[]),
      );
      if (bookedByIds.length > 0) {
        tried.push("slot_booked_by");
        const { data: bookerProfiles } = await supabase
          .from("profiles")
          .select("id, mcf_pay_sdr_code")
          .in("id", bookedByIds);
        const byId = new Map(
          (bookerProfiles ?? []).map((p: any) => [p.id, p.mcf_pay_sdr_code as string | null]),
        );
        for (const r of rows) {
          const code = r.booked_by ? byId.get(r.booked_by) : null;
          if (code) { sdr_code = code; break; }
        }
      }
    }

    // Closer fallback: meeting_slots.closer_id → closers.email → profiles.email → mcf_pay_closer_code
    if (!closer_code) {
      const closerIds = Array.from(
        new Set(
          rows
            .map((r) => (r.meeting_slots?.closer_id as string | null) ?? null)
            .filter(Boolean) as string[],
        ),
      );
      tried.push(`_dbg:rows=${rows.length}/slots=${slotIds.length}/closers=${closerIds.length}`);
      if (closerIds.length > 0) {
        tried.push("slot_closer");
        const { data: closerRows } = await supabase
          .from("closers")
          .select("id, email")
          .in("id", closerIds);
        const closerEmailById = new Map(
          (closerRows ?? []).map((c: any) => [c.id, (c.email as string | null)?.toLowerCase() ?? null]),
        );
        const closerEmails = Array.from(
          new Set(Array.from(closerEmailById.values()).filter(Boolean) as string[]),
        );
        tried.push(`_dbg:closerRows=${(closerRows ?? []).length}/emails=${closerEmails.length}`);
        if (closerEmails.length > 0) {
          const { data: closerProfiles } = await supabase
            .from("profiles")
            .select("email, mcf_pay_closer_code")
            .in("email", closerEmails);
          tried.push(`_dbg:closerProfiles=${(closerProfiles ?? []).length}`);
          const codeByEmail = new Map(
            (closerProfiles ?? []).map((p: any) => [
              (p.email as string).toLowerCase(),
              p.mcf_pay_closer_code as string | null,
            ]),
          );
          // Preferir slot mais recente
          for (const r of rows) {
            const cid = r.meeting_slots?.closer_id as string | null;
            const cemail = cid ? closerEmailById.get(cid) : null;
            const code = cemail ? codeByEmail.get(cemail) : null;
            if (code) { closer_code = code; break; }
          }
        }
      }
    }
  }

  // Owner do deal como último fallback (para closer_code E sdr_code)
  if ((!closer_code || !sdr_code) && deal.owner_profile_id) {
    tried.push("owner");
    const { data: owner } = await supabase
      .from("profiles")
      .select("mcf_pay_closer_code, mcf_pay_sdr_code")
      .eq("id", deal.owner_profile_id)
      .maybeSingle();
    if (!closer_code) closer_code = (owner?.mcf_pay_closer_code as string) || null;
    if (!sdr_code) sdr_code = (owner?.mcf_pay_sdr_code as string) || null;
  }

  // Carregar dados do cliente
  let customer: { name: string | null; email: string | null; phone: string | null } | null = null;
  if (deal.contact_id) {
    const { data: c } = await supabase
      .from("crm_contacts")
      .select("name, email, phone")
      .eq("id", deal.contact_id)
      .maybeSingle();
    if (c) customer = { name: c.name ?? null, email: c.email ?? null, phone: c.phone ?? null };
  }

  return { closer_code, sdr_code, customer, transaction_id, tried };
}

async function dispatch(
  dealId: string | null,
  opts: { test?: boolean; previousAttempt?: number; logId?: string; source?: string; force?: boolean } = {},
) {
  const config = await getConfig();
  if (!config?.is_active || !config?.webhook_url) {
    await supabase.from("mcf_pay_dispatch_logs").insert({
      deal_id: dealId,
      status: "skipped_inactive",
      error_message: "Integração MCF Pay inativa ou sem URL configurada",
      attempt: (opts.previousAttempt ?? 0) + 1,
      source: opts.source ?? "manual",
    });
    return { ok: false, reason: "inactive" };
  }

  // Idempotência: pular se já temos sucesso recente para o mesmo deal
  if (!opts.test && dealId && !opts.force && !opts.logId) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: prior } = await supabase
      .from("mcf_pay_dispatch_logs")
      .select("id")
      .eq("deal_id", dealId)
      .eq("status", "success")
      .gte("created_at", since)
      .limit(1);
    if (prior && prior.length > 0) {
      await supabase.from("mcf_pay_dispatch_logs").insert({
        deal_id: dealId,
        status: "skipped_duplicate",
        error_message: "Já existe disparo bem-sucedido nas últimas 24h",
        attempt: 1,
        source: opts.source ?? "manual",
      });
      return { ok: true, reason: "duplicate_skipped" };
    }
  }

  let payload: Record<string, unknown>;
  let debugTried: string[] = [];
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
        source: opts.source ?? "manual",
      });
      return { ok: false, reason: "deal_not_found" };
    }
    if (!codes.closer_code && !codes.sdr_code) {
      const reason = "both_missing";
      await supabase.from("mcf_pay_dispatch_logs").insert({
        deal_id: dealId,
        status: "skipped_no_codes",
        error_message: `Nenhum closer_code/sdr_code resolvido (${reason}); tried=${(codes.tried ?? []).join(",") || "none"}`,
        attempt: (opts.previousAttempt ?? 0) + 1,
        source: opts.source ?? "manual",
      });
      return { ok: false, reason: "no_codes" };
    }
    if (!codes.closer_code || !codes.sdr_code) {
      // Segue disparo mesmo com um lado ausente, mas registra em log de auditoria
      console.log(
        `[notify-mcf-pay] partial codes for deal ${dealId}: closer=${codes.closer_code ?? "MISSING"} sdr=${codes.sdr_code ?? "MISSING"} tried=${(codes.tried ?? []).join(",")}`,
      );
    }
    payload = {
      event: "deal.paid",
      crm_deal_id: dealId,
      deal_id: dealId,
      closer_code: codes.closer_code ?? undefined,
      sdr_code: codes.sdr_code ?? undefined,
      customer: codes.customer ?? undefined,
      metadata: { crm_deal_id: dealId },
      purchase_ref: codes.transaction_id ? { transaction_id: codes.transaction_id } : {},
    };
    // Guardar `tried` no escopo do dispatch para logar sem poluir o payload enviado
    debugTried = codes.tried ?? [];
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
    response: responseJson && typeof responseJson === "object"
      ? { ...responseJson, _debug_tried: debugTried }
      : { raw: responseJson, _debug_tried: debugTried },
    signature_preview: signature ? signature.slice(0, 16) : null,
    error_message: errorMessage,
    next_retry_at: nextRetryAt,
    sent_at: status === "success" ? new Date().toISOString() : null,
    source: opts.source ?? "manual",
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
    const r = await dispatch(row.deal_id, { previousAttempt: row.attempt, logId: row.id, source: "retry" });
    results.push({ id: row.id, ...r });
  }
  return { processed: results.length, results };
}

async function processSweep() {
  // Pega deals com contract_paid_at nas últimas 72h que não têm disparo success/skipped_duplicate
  const since = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
  const { data: rows } = await supabase
    .from("meeting_slot_attendees")
    .select("deal_id, contract_paid_at")
    .not("deal_id", "is", null)
    .not("contract_paid_at", "is", null)
    .gte("contract_paid_at", since)
    .limit(200);

  const dealIds = Array.from(new Set((rows ?? []).map((r: any) => r.deal_id as string)));
  if (dealIds.length === 0) return { processed: 0, results: [] };

  const { data: existing } = await supabase
    .from("mcf_pay_dispatch_logs")
    .select("deal_id, status")
    .in("deal_id", dealIds)
    .in("status", ["success", "skipped_duplicate", "skipped_no_codes", "skipped_inactive"]);
  const skip = new Set((existing ?? []).map((r: any) => r.deal_id as string));

  const todo = dealIds.filter((id) => !skip.has(id)).slice(0, 25);
  const results = [];
  for (const id of todo) {
    const r = await dispatch(id, { source: "sweep" });
    results.push({ deal_id: id, ...r });
  }
  return { processed: results.length, results };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    if (body.sweep === true) {
      const r = await processSweep();
      return new Response(JSON.stringify(r), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (body.retry_queue) {
      const r = await processRetryQueue();
      return new Response(JSON.stringify(r), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (body.test === true) {
      const r = await dispatch(null, { test: true, source: body.source ?? "manual" });
      return new Response(JSON.stringify(r), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (body.deal_id) {
      const r = await dispatch(body.deal_id, {
        previousAttempt: body.force ? 0 : undefined,
        source: body.source ?? "manual",
        force: Boolean(body.force),
      });
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