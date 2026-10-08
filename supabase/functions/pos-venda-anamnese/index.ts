// Recebimento da ficha de anamnese (HARVEY) para a BU Pós Venda.
// Separado do encaminhamento GR (crm-externo-encaminhamento), que não é alterado.
// Grava em custom_fields.anamnese_v2 do card da pipeline "Relacionamento - Pós venda";
// se o card ainda não existir, guarda em pos_venda_anamnese_pendente para aplicar depois.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-crm-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const POS_VENDA_ORIGIN_ID = "b05a0000-0000-4000-8000-000000000002";

const texto = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const dataIso = (v: unknown): string | null => {
  const s = texto(v);
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString();
};
const digits = (v?: string | null) => (v ?? "").replace(/\D/g, "");

function extrairAnamneseV2(body: any) {
  const raw = body?.anamnese_estruturada;
  let estruturada: { secoes: any[] } | null = null;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    estruturada = { secoes: Array.isArray(raw.secoes) ? raw.secoes : [] };
  } else if (Array.isArray(raw)) {
    estruturada = { secoes: raw };
  }
  const p = body?.anamnese_preenchida;
  const preenchida = typeof p === "boolean" ? p : p === "true" ? true : p === "false" ? false : null;
  return {
    preenchida,
    pdf_url: texto(body?.anamnese_pdf_url),
    estruturada,
    resumo: texto(body?.anamnese_resumo),
    html: texto(body?.anamnese_html),
    preenchida_em: dataIso(body?.anamnese_preenchida_em),
    atualizada_em: dataIso(body?.anamnese_atualizada_em),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ erro: "metodo_nao_permitido" }, 405);

  const secret = Deno.env.get("CRM_EXTERNO_SECRET");
  if (!secret) return json({ erro: "integracao_nao_configurada" }, 500);
  if (req.headers.get("x-crm-key") !== secret) return json({ erro: "nao_autorizado" }, 401);

  let body: any;
  try { body = await req.json(); } catch { return json({ erro: "json_invalido" }, 400); }

  const cliente = body?.cliente ?? {};
  const email = texto(cliente.email ?? body?.email)?.toLowerCase() ?? null;
  const tel = digits(texto(cliente.telefone ?? cliente.phone ?? body?.telefone));
  const sufixo = tel.length >= 9 ? tel.slice(-9) : null;
  const externalId = texto(body?.external_id);
  if (!email && !sufixo) return json({ erro: "cliente_sem_email_ou_telefone" }, 400);
  if (email && (email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) return json({ erro: "email_invalido" }, 400);

  const anamnese = extrairAnamneseV2(body);
  if (!anamnese.pdf_url && !anamnese.estruturada?.secoes.length && !anamnese.resumo && !anamnese.html && anamnese.preenchida === null) {
    return json({ erro: "anamnese_vazia" }, 400);
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

  try {
    const { data: deals, error } = await supabase
      .from("crm_deals")
      .select("id, custom_fields, crm_contacts!inner(email, phone)")
      .eq("origin_id", POS_VENDA_ORIGIN_ID)
      .eq("is_archived", false)
      .order("created_at", { ascending: true })
      .limit(2000);
    if (error) throw error;

    const alvo = (deals ?? []).find((d: any) => {
      const c = d.crm_contacts;
      const ce = (c?.email ?? "").toLowerCase().trim();
      const cs = digits(c?.phone).slice(-9);
      return (email && ce === email) || (sufixo && cs.length === 9 && cs === sufixo);
    });

    if (alvo) {
      const cf = (alvo.custom_fields as Record<string, unknown>) ?? {};
      const { error: upErr } = await supabase
        .from("crm_deals")
        .update({ custom_fields: { ...cf, anamnese_v2: anamnese, anamnese_fonte: "harvey_pos_venda", anamnese_external_id: externalId } })
        .eq("id", alvo.id);
      if (upErr) throw upErr;
      await supabase.from("deal_activities").insert({
        deal_id: alvo.id, activity_type: "pos_venda_anamnese",
        description: anamnese.preenchida === false ? "Anamnese recebida do HARVEY (não preenchida)" : "Anamnese recebida do HARVEY",
        metadata: { external_id: externalId },
      });
      return json({ ok: true, acao: "aplicada", deal_id: alvo.id });
    }

    const { error: insErr } = await supabase.from("pos_venda_anamnese_pendente").insert({
      email, phone_suffix: sufixo, external_id: externalId, anamnese,
    });
    if (insErr) throw insErr;
    return json({ ok: true, acao: "guardada_ate_cliente_entrar" }, 202);
  } catch (e) {
    console.error("[pos-venda-anamnese]", (e as Error).message);
    return json({ erro: "falha_interna" }, 500);
  }
});
