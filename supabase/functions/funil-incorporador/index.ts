// Somente leitura. Expõe os totais do Painel Comercial do Incorporador para o
// FinanceHub (adm.mcfcapital.com.br). O número nasce aqui e viaja pronto: esta
// função NÃO recalcula nada, apenas devolve o JSON da RPC
// public.painel_incorporador_totais(p_ini, p_fim).
import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  "https://adm.mcfcapital.com.br",
  "https://mcfadministrativo.lovable.app",
];

function corsFor(origin: string | null): Record<string, string> {
  const allowed = origin && (
    ALLOWED_ORIGINS.includes(origin) ||
    /^https:\/\/[a-z0-9-]*mcfadministrativo[a-z0-9.-]*\.lovable\.app$/i.test(origin) ||
    /^https:\/\/id-preview--[a-z0-9-]+\.lovable\.app$/i.test(origin)
  );
  return {
    "Access-Control-Allow-Origin": allowed ? origin! : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers": "content-type, x-mcf-key",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    Vary: "Origin",
  };
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function mesCorrenteBRT(): { ini: string; fim: string } {
  const hoje = new Date(Date.now() - 3 * 60 * 60 * 1000); // America/Sao_Paulo
  const y = hoje.getUTCFullYear();
  const m = hoje.getUTCMonth();
  const p = (n: number) => String(n).padStart(2, "0");
  const ultimo = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return { ini: `${y}-${p(m + 1)}-01`, fim: `${y}-${p(m + 1)}-${p(ultimo)}` };
}

Deno.serve(async (req) => {
  const cors = corsFor(req.headers.get("origin"));
  const json = (body: unknown, status: number) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });

  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "GET") return json({ erro: "método não permitido" }, 405);

  const esperado = Deno.env.get("FUNIL_INCORPORADOR_KEY");
  if (!esperado) return json({ erro: "segredo não configurado no servidor" }, 500);
  if (req.headers.get("x-mcf-key") !== esperado) return json({ erro: "não autorizado" }, 401);

  const url = new URL(req.url);
  const padrao = mesCorrenteBRT();
  const ini = url.searchParams.get("ini") ?? padrao.ini;
  const fim = url.searchParams.get("fim") ?? padrao.fim;
  if (!DATE_RE.test(ini) || !DATE_RE.test(fim)) {
    return json({ erro: "parâmetros ini/fim devem estar no formato YYYY-MM-DD" }, 400);
  }
  if (ini > fim) return json({ erro: "ini não pode ser maior que fim" }, 400);

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data, error } = await supabase.rpc("painel_incorporador_totais", {
      p_ini: ini,
      p_fim: fim,
    });
    if (error) {
      console.error("[funil-incorporador] rpc error", error);
      return json({ erro: `falha ao consultar os totais: ${error.message}` }, 500);
    }
    return json(data, 200);
  } catch (e) {
    console.error("[funil-incorporador] exception", e);
    return json({ erro: e instanceof Error ? e.message : "erro inesperado" }, 500);
  }
});
