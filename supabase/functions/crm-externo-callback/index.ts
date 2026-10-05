// Aviso de mudança de status do cartão para o app de origem (área "admissao").
// Disparado pelo trigger de mudança de etapa em crm_deals. Só lê o estado atual do banco
// e envia para o callback_url gravado no encaminhamento, assinado com HMAC (x-mcf-signature).
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function hmac(secret: string, body: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const UUID = /^[0-9a-f-]{36}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const secret = Deno.env.get("CRM_EXTERNO_SECRET");
  if (!secret) return json({ erro: "integracao_nao_configurada" }, 500);

  const body = await req.json().catch(() => null);
  const dealId = String(body?.deal_id ?? "");
  const operadorId = body?.operador_profile_id ? String(body.operador_profile_id) : null;
  if (!UUID.test(dealId)) return json({ erro: "deal_id_invalido" }, 400);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: enc } = await supabase
    .from("crm_externo_encaminhamentos")
    .select("id, external_id, area, callback_url")
    .eq("deal_id", dealId)
    .eq("area", "admissao")
    .maybeSingle();
  if (!enc || !enc.callback_url) return json({ ok: true, ignorado: true });

  const { data: deal } = await supabase
    .from("crm_deals")
    .select("stage_id, crm_stages!crm_deals_stage_id_fkey(stage_name)")
    .eq("id", dealId)
    .maybeSingle();
  const status = (deal as any)?.crm_stages?.stage_name ?? null;

  let operador: string | null = null;
  if (operadorId && UUID.test(operadorId)) {
    const { data: p } = await supabase.from("profiles").select("full_name, email").eq("id", operadorId).maybeSingle();
    operador = p?.full_name ?? p?.email ?? null;
  }

  const encaminhamentoId = String(enc.external_id).replace(/^admissao:/, "");
  const payload = JSON.stringify({
    encaminhamento_id: encaminhamentoId,
    status,
    operador,
    observacao: status ? `Cartão movido para "${status}"` : null,
  });

  let respStatus = 0;
  let erro: string | null = null;
  try {
    const r = await fetch(enc.callback_url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-mcf-signature": await hmac(secret, payload) },
      body: payload,
      signal: AbortSignal.timeout(15000),
    });
    respStatus = r.status;
    if (!r.ok) erro = `HTTP ${r.status}`;
  } catch (e) {
    erro = (e as Error).message;
  }

  await supabase
    .from("crm_externo_encaminhamentos")
    .update({ status: status ?? undefined, responsavel_nome: operador ?? undefined, status_atualizado_em: new Date().toISOString() })
    .eq("id", enc.id);

  if (erro) console.error("[crm-externo-callback]", enc.id, erro);
  return json({ ok: !erro, status_http: respStatus, erro });
});
