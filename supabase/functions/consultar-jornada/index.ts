// Consulta pública da Jornada de Pós-Venda por CPF (trilha.mcfcapital.com.br).
import { createClient } from "npm:@supabase/supabase-js@2";

const ORIGIN_POS_VENDA = "b05a0000-0000-4000-8000-000000000002";
const NAO_ACHOU = { erro: "Não encontramos uma jornada com esse CPF." };

const permitido = (o: string) =>
  o === "https://trilha.mcfcapital.com.br" ||
  /^https:\/\/[a-z0-9-]+\.lovable\.app$/.test(o) ||
  /^https:\/\/[a-z0-9-]+\.lovableproject\.com$/.test(o);

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin") ?? "";
  const cors: Record<string, string> = {
    "Access-Control-Allow-Origin": permitido(origin) ? origin : "https://trilha.mcfcapital.com.br",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ erro: "Método não permitido" }, 405);

  let cpf = "";
  try { cpf = String((await req.json())?.cpf ?? "").replace(/\D/g, ""); } catch { /* corpo inválido */ }
  if (cpf.length !== 11) return json(NAO_ACHOU, 404);

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const sel = "id, name, jornada_etapa_atual_id, crm_contacts(name)";
  let { data: deal } = await sb.from("crm_deals").select(sel).eq("origin_id", ORIGIN_POS_VENDA)
    .eq("cpf", cpf).eq("is_archived", false).order("created_at").limit(1).maybeSingle();
  if (!deal) {
    ({ data: deal } = await sb.from("crm_deals").select(sel).eq("origin_id", ORIGIN_POS_VENDA)
      .eq("custom_fields->>cpf", cpf).eq("is_archived", false).order("created_at").limit(1).maybeSingle());
  }
  if (!deal) return json(NAO_ACHOU, 404);

  const [{ data: etapas }, { data: eventos }] = await Promise.all([
    sb.from("jornada_etapas").select("id, ordem, titulo, descricao, icone").eq("ativa", true).order("ordem"),
    sb.from("jornada_eventos").select("etapa_id, ocorrido_em").eq("deal_id", deal.id).order("ocorrido_em", { ascending: false }),
  ]);
  const { data: atual } = deal.jornada_etapa_atual_id
    ? await sb.from("jornada_etapas").select("ordem").eq("id", deal.jornada_etapa_atual_id).maybeSingle()
    : { data: null };
  const ordAtual = atual?.ordem ?? null;
  const dataDe = new Map<string, string>();
  for (const e of eventos ?? []) if (!dataDe.has(e.etapa_id)) dataDe.set(e.etapa_id, e.ocorrido_em);

  // deno-lint-ignore no-explicit-any
  const nome = String((deal as any).crm_contacts?.name || deal.name || "").trim().split(/\s+/)[0] ?? "";
  return json({
    primeiro_nome: nome ? nome[0].toUpperCase() + nome.slice(1).toLowerCase() : "",
    etapas: (etapas ?? []).map((e) => ({
      ordem: e.ordem, titulo: e.titulo, descricao: e.descricao, icone: e.icone,
      status: ordAtual === null ? "futura" : e.ordem < ordAtual ? "concluida" : e.ordem === ordAtual ? "atual" : "futura",
      data: dataDe.get(e.id) ?? null,
    })),
  });
});
