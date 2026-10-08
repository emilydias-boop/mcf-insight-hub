// Link da gravação MeetGeek para reuniões da agenda do Pós Venda.
// Separada de meetgeek-gravacao para não mexer nas permissões das gravações dos closers.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const API_BASE = Deno.env.get("MEETGEEK_API_BASE") ?? "https://api.meetgeek.ai";
const MARGEM_MS = 5 * 60 * 1000;

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const token = Deno.env.get("MEETGEEK_API_KEY");
  if (!token) return json({ erro: "MEETGEEK_API_KEY nao configurada" }, 500);
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ erro: "nao autenticado" }, 401);

  const body = await req.json().catch(() => ({}));
  const reuniaoId = typeof body?.reuniao_id === "string" ? body.reuniao_id : null;
  const recordingId = typeof body?.recording_id === "string" ? body.recording_id : null;
  if (!reuniaoId || !recordingId) return json({ erro: "reuniao_id e recording_id obrigatorios" }, 400);

  const usuario = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: auth } = await usuario.auth.getUser();
  if (!auth?.user) return json({ erro: "nao autenticado" }, 401);

  // A RPC já checa admin/gerente_relacionamento e o vínculo por e-mail + horário.
  const { data: lista, error } = await usuario.rpc("pos_venda_gravacoes_da_reuniao", { p_reuniao_id: reuniaoId });
  if (error) return json({ erro: error.message }, 500);
  if (!(lista ?? []).some((r: { id: string }) => r.id === recordingId)) return json({ erro: "sem permissao" }, 403);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: rec } = await admin.from("meeting_recordings")
    .select("id, meetgeek_meeting_id, download_link, download_expires_at").eq("id", recordingId).maybeSingle();
  if (!rec) return json({ erro: "nao encontrada" }, 404);

  if (rec.download_link && rec.download_expires_at &&
      new Date(rec.download_expires_at).getTime() - MARGEM_MS > Date.now()) {
    return json({ link: rec.download_link, expira_em: rec.download_expires_at });
  }

  const res = await fetch(`${API_BASE}/v1/meetings/${rec.meetgeek_meeting_id}/download`, {
    method: "POST", headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (res.status === 410) return json({ erro: "gravacao_expirada", mensagem: "A gravação não está mais disponível no MeetGeek." }, 410);
  if (res.status === 404) return json({ erro: "nao_encontrada", mensagem: "O MeetGeek não tem essa gravação." }, 404);
  if (res.status === 429) return json({ erro: "limite", mensagem: "Limite atingido. Tente de novo em alguns minutos." }, 429);
  if (!res.ok) return json({ erro: `meetgeek ${res.status}` }, 502);

  const d = await res.json();
  if (!d?.download_link) return json({ erro: "resposta sem download_link" }, 502);
  const expira = new Date(Date.now() + (Number(d?.expires_in) || 14400) * 1000).toISOString();
  await admin.from("meeting_recordings").update({ download_link: d.download_link, download_expires_at: expira }).eq("id", rec.id);
  return json({ link: d.download_link, expira_em: expira });
});
