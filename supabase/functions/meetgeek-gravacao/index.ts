// Gera o link para assistir a gravacao de uma reuniao.
// O link do MeetGeek e PUBLICO para quem o tiver, entao a permissao e
// checada aqui antes de devolver qualquer coisa.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const API_BASE = Deno.env.get("MEETGEEK_API_BASE") ?? "https://api.meetgeek.ai";
// Margem antes do vencimento real: link que expira no meio do clique e pior
// que gerar de novo.
const MARGEM_SEGURANCA_MS = 5 * 60 * 1000;

function jsonResp(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const token = Deno.env.get("MEETGEEK_API_KEY");
  if (!token) return jsonResp({ erro: "MEETGEEK_API_KEY nao configurada" }, 500);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return jsonResp({ erro: "nao autenticado" }, 401);

  // Cliente COM o token do usuario: as policies de SELECT decidem se ele
  // enxerga esta gravacao. Sem service role aqui - e a checagem de permissao.
  const supabaseUsuario = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: auth } = await supabaseUsuario.auth.getUser();
  if (!auth?.user) return jsonResp({ erro: "nao autenticado" }, 401);

  const body = await req.json().catch(() => ({}));
  const recordingId = body?.recording_id;
  if (!recordingId) return jsonResp({ erro: "recording_id obrigatorio" }, 400);

  // Se o RLS barrar, isso volta vazio - e a resposta e 403, nao 500.
  const { data: rec, error: recErr } = await supabaseUsuario
    .from("meeting_recordings")
    .select("id, meetgeek_meeting_id, download_link, download_expires_at, ingest_status")
    .eq("id", recordingId)
    .maybeSingle();

  if (recErr) return jsonResp({ erro: recErr.message }, 500);
  if (!rec) return jsonResp({ erro: "gravacao nao encontrada ou sem permissao" }, 403);

  // Cache ainda valido: devolve sem gastar quota da API.
  if (rec.download_link && rec.download_expires_at) {
    const validoAte = new Date(rec.download_expires_at).getTime();
    if (validoAte - MARGEM_SEGURANCA_MS > Date.now()) {
      return jsonResp({
        link: rec.download_link,
        expira_em: rec.download_expires_at,
        do_cache: do_cache: true,
      });
    }
  }

  const res = await fetch(`${API_BASE}/v1/meetings/${rec.meetgeek_meeting_id}/download`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });

  if (res.status === 410) {
    return jsonResp({ erro: "gravacao_expirada", mensagem: "A gravacao nao esta mais disponivel no MeetGeek." }, 410);
  }
  if (res.status === 404) {
    return jsonResp({ erro: "nao_encontrada", mensagem: "O MeetGeek nao tem essa gravacao." }, 404);
  }
  if (res.status === 429) {
    // Pode ser quota da API ou o teto de 5 downloads simultaneos na mesma reuniao.
    return jsonResp({ erro: "limite", mensagem: "Limite atingido. Tente de novo em alguns minutos." }, 429);
  }
  if (!res.ok) {
    console.error("[meetgeek-gravacao] falha", rec.meetgeek_meeting_id, res.status);
    return jsonResp({ erro: `meetgeek ${res.status}` }, 502);
  }

  const d = await res.json();
  const link = d?.download_link;
  if (!link) return jsonResp({ erro: "resposta sem download_link" }, 502);

  const expiraEm = new Date(Date.now() + (Number(d?.expires_in) || 14400) * 1000).toISOString();

  // Grava o cache com service role: o usuario tem permissao de LER, nao de escrever.
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  await supabaseAdmin.from("meeting_recordings")
    .update({ download_link: link, download_expires_at: expiraEm })
    .eq("id", rec.id);

  // Nao logamos o link: quem tiver ele baixa a gravacao.
  console.log("[meetgeek-gravacao] link gerado", rec.meetgeek_meeting_id);

  return jsonResp({ link, expira_em: expiraEm, do_cache: false });
});
