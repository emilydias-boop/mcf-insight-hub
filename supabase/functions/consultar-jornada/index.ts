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

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) throw new Error("Configuração indisponível");
    const sb = createClient(url, key);
    const sel = "id, contact_id";
    const direto = await sb.from("crm_deals").select(sel).eq("origin_id", ORIGIN_POS_VENDA)
      .eq("cpf", cpf).eq("is_archived", false).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(1).maybeSingle();
    if (direto.error) throw direto.error;
    let deal = direto.data;
    if (!deal) {
      const vinculo = await sb.rpc("jornada_resolver_cpf", { p_cpf: cpf });
      if (vinculo.error) throw vinculo.error;
      const id = vinculo.data?.[0]?.deal_id;
      if (id) {
        const r = await sb.from("crm_deals").select(sel).eq("id", id).eq("origin_id", ORIGIN_POS_VENDA).eq("is_archived", false).maybeSingle();
        if (r.error) throw r.error;
        deal = r.data;
      }
    }
    if (!deal) return json(NAO_ACHOU, 404);
    const compras = await sb.rpc("jornada_compra_cpf", { p_cpf: cpf });
    if (compras.error) throw compras.error;
    const compra = compras.data?.[0];
    let nomeCompleto = String(compra?.comprador_nome ?? "").trim();
    if (!nomeCompleto && deal.contact_id) {
      const c = await sb.from("crm_contacts").select("name").eq("id", deal.contact_id).maybeSingle();
      if (c.error) throw c.error;
      nomeCompleto = c.data?.name ?? "";
    }
    const calculo = await sb.rpc("jornada_calcular", { p_deal_id: deal.id });
    if (calculo.error) throw calculo.error;
    if (!calculo.data) return json(NAO_ACHOU, 404);
    const nome = nomeCompleto.trim().split(/\s+/)[0] ?? "";
    return json({ primeiro_nome: nome ? nome.charAt(0).toUpperCase() + nome.slice(1).toLowerCase() : "",
      data_compra: compra?.data_compra ?? null, etapa_atual: calculo.data.etapa_atual, historico: calculo.data.historico });
  } catch {
    return json({ erro: "Não foi possível consultar a jornada agora. Tente novamente." }, 500);
  }
});
