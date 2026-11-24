import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";

const Body = z.object({
  etapa_id: z.string().uuid(),
  decisao: z.enum(["aprovada", "reprovada", "devolvida"]),
  comentario: z.string().max(4000).optional().default(""),
  confirmo: z.literal(true),
  senha: z.string().min(1).max(200).optional(),
});
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Não autenticado" }, 401);
  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data: u, error: ue } = await admin.auth.getUser(token);
  if (ue || !u?.user) return json({ error: "Sessão inválida" }, 401);
  const user = u.user;

  let raw: unknown;
  try { raw = await req.json(); } catch { return json({ error: "JSON inválido" }, 400); }
  const p = Body.safeParse(raw);
  if (!p.success) return json({ error: "Dados inválidos", campos: p.error.flatten().fieldErrors }, 400);
  const b = p.data;

  // Re-authentication: system password, or the authenticated Google account (explicit confirmation required)
  let metodo: "senha" | "google";
  if (b.senha) {
    if (!user.email) return json({ error: "Conta sem e-mail" }, 400);
    const anon = createClient(url, anonKey, { auth: { persistSession: false } });
    const { error } = await anon.auth.signInWithPassword({ email: user.email, password: b.senha });
    if (error) return json({ error: "Senha incorreta" }, 403);
    metodo = "senha";
  } else {
    const providers: string[] = (user.app_metadata?.providers as string[]) ?? [user.app_metadata?.provider as string];
    if (!providers?.includes("google")) return json({ error: "Digite sua senha para assinar" }, 403);
    metodo = "google";
  }

  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("cf-connecting-ip") || null;
  const { data, error } = await admin.rpc("gov_assinatura_decidir_servico", {
    p_etapa: b.etapa_id, p_uid: user.id, p_decisao: b.decisao, p_comentario: b.comentario,
    p_metodo: metodo, p_ip: ip, p_ua: req.headers.get("user-agent") ?? "",
  });
  if (error) return json({ error: error.message }, error.code === "42501" ? 403 : 400);
  return json({ ok: true, resultado: data, metodo });
});
