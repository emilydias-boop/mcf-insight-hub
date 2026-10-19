// Prévia oficial da Meta para um anúncio (Painel Marketing). Nunca expõe o token.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const FORMATOS = ["MOBILE_FEED_STANDARD", "INSTAGRAM_STANDARD", "INSTAGRAM_REELS", "INSTAGRAM_STORY", "FACEBOOK_REELS_MOBILE"];

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ erro: "Método não permitido" }, 405);
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ erro: "Não autenticado" }, 401);

    const url = Deno.env.get("SUPABASE_URL")!;
    const usuario = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: auth } = await usuario.auth.getUser();
    if (!auth?.user) return json({ erro: "Não autenticado" }, 401);

    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: pode, error: permErr } = await admin.rpc("mkt_can_view", { _uid: auth.user.id });
    if (permErr || pode !== true) return json({ erro: "Sem permissão" }, 403);

    const body = await req.json().catch(() => ({}));
    const adId = typeof body?.ad_id === "string" ? body.ad_id.trim() : "";
    if (!/^\d{1,25}$/.test(adId)) return json({ erro: "ad_id inválido" }, 400);
    const formato = body?.formato == null || body.formato === "" ? "MOBILE_FEED_STANDARD" : body.formato;
    if (typeof formato !== "string" || !FORMATOS.includes(formato)) return json({ erro: "Formato inválido" }, 400);

    const { data: ent } = await admin.from("ads_entities").select("ad_id").eq("platform", "meta").eq("ad_id", adId).maybeSingle();
    if (!ent) return json({ erro: "Anúncio não encontrado" }, 404);

    const token = Deno.env.get("META_ADS_TOKEN");
    if (!token) return json({ erro: "Integração da Meta não configurada" }, 500);

    const resp = await fetch(
      `https://graph.facebook.com/v21.0/${adId}/previews?ad_format=${formato}&access_token=${encodeURIComponent(token)}`,
    );
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || data?.error) return json({ erro: data?.error?.message ?? "A Meta não devolveu a prévia" }, 422);

    const html: string = data?.data?.[0]?.body ?? "";
    const m = html.match(/src="([^"]+)"/i);
    if (!m) return json({ erro: "Prévia indisponível para este formato" }, 422);
    const src = m[1].replace(/&amp;/g, "&");
    return json({ src, formato });
  } catch (e) {
    console.error("meta-ad-preview erro:", e instanceof Error ? e.message : "desconhecido");
    return json({ erro: "Erro interno" }, 500);
  }
});
