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
    const modo = body?.modo == null || body.modo === "" ? "preview" : body.modo;
    if (modo !== "preview" && modo !== "video") return json({ erro: "Modo inválido" }, 400);
    const formato = body?.formato == null || body.formato === "" ? "MOBILE_FEED_STANDARD" : body.formato;
    if (typeof formato !== "string" || !FORMATOS.includes(formato)) return json({ erro: "Formato inválido" }, 400);

    const { data: ent } = await admin.from("ads_entities").select("ad_id, video_id, creative_id, account_id").eq("platform", "meta").eq("ad_id", adId).maybeSingle();
    if (!ent) return json({ erro: "Anúncio não encontrado" }, 404);

    const token = Deno.env.get("META_ADS_TOKEN");
    if (!token) return json({ erro: "Integração da Meta não configurada" }, 500);

    if (modo === "video") {
      const limpa = (s: unknown) => String(s ?? "").replaceAll(token, "").replaceAll(encodeURIComponent(token), "");
      class MetaErr extends Error { code: number | null; constructor(m: string, c: number | null) { super(m); this.code = c; } }
      const getMeta = async (path: string, query: string) => {
        const r = await fetch(`https://graph.facebook.com/v21.0/${path}?${query}&access_token=${encodeURIComponent(token)}`);
        const d = await r.json().catch(() => ({}));
        if (!r.ok || d?.error) throw new MetaErr(limpa(d?.error?.message ?? "Falha ao consultar a Meta"), d?.error?.code ?? null);
        return d;
      };
      const log = (video_id: string | null, etapa: string, ok: boolean, e?: unknown) => {
        const me = e instanceof MetaErr ? e : null;
        console.log(JSON.stringify({ fn: "meta-ad-preview", ad_id: adId, video_id, etapa, ok,
          erro_meta_code: me?.code ?? null, erro_meta_msg: e ? limpa(e instanceof Error ? e.message : e) : null }));
      };
      const absFb = (p: string | null | undefined) => p ? (p.startsWith("/") ? `https://www.facebook.com${p}` : p) : null;

      let video_src: string | null = null, poster: string | null = null, fb_url: string | null = null, ig_url: string | null = null, aviso: string | null = null;
      const e0 = ent as any;
      const videoId = e0.video_id ? String(e0.video_id) : null;
      const creativeId = e0.creative_id ? String(e0.creative_id) : null;
      const accountId = e0.account_id ? String(e0.account_id).replace(/^act_/, "") : null;

      const tentarVideo = async (vid: string, etapaDireta: string) => {
        try {
          const v = await getMeta(encodeURIComponent(vid), "fields=source,permalink_url,picture");
          if (v?.source) video_src = v.source;
          poster = poster ?? v?.picture ?? null;
          fb_url = fb_url ?? absFb(v?.permalink_url);
          log(vid, etapaDireta, !!v?.source, v?.source ? undefined : "sem source");
        } catch (e) { aviso = limpa((e as Error).message); log(vid, etapaDireta, false, e); }
        if (video_src || !accountId) return;
        try {
          const filtro = encodeURIComponent(JSON.stringify([{ field: "id", operator: "IN", value: [vid] }]));
          const d = await getMeta(`act_${encodeURIComponent(accountId)}/advideos`, `fields=id,source,picture,permalink_url&filtering=${filtro}`);
          const v = d?.data?.[0];
          if (v?.source) video_src = v.source;
          poster = poster ?? v?.picture ?? null;
          fb_url = fb_url ?? absFb(v?.permalink_url);
          log(vid, "advideos", !!v?.source, v?.source ? undefined : "sem source");
        } catch (e) { aviso = limpa((e as Error).message); log(vid, "advideos", false, e); }
      };

      if (videoId) await tentarVideo(videoId, "video_direto");

      if (!video_src) {
        try {
          const a = await getMeta(encodeURIComponent(adId),
            "fields=" + encodeURIComponent("creative{video_id,object_story_spec{video_data{video_id}},asset_feed_spec{videos{video_id}}}"));
          const cr = a?.creative ?? {};
          const ids = [cr.video_id, cr.object_story_spec?.video_data?.video_id, ...((cr.asset_feed_spec?.videos ?? []).map((x: any) => x?.video_id))]
            .filter((x: unknown) => x).map(String);
          const extras = [...new Set(ids)].filter((x) => x !== videoId).slice(0, 2);
          log(videoId, "creative_alt", extras.length > 0, extras.length ? undefined : "sem video_id alternativo");
          for (const vid of extras) {
            if (video_src) break;
            await tentarVideo(vid, "creative_alt");
          }
        } catch (e) { aviso = limpa((e as Error).message); log(videoId, "creative_alt", false, e); }
      }

      if (creativeId) {
        try {
          const c = await getMeta(encodeURIComponent(creativeId), "fields=effective_object_story_id,instagram_permalink_url");
          ig_url = c?.instagram_permalink_url ?? null;
          if (!fb_url && c?.effective_object_story_id) fb_url = `https://www.facebook.com/${c.effective_object_story_id}`;
        } catch { /* independente */ }
      }
      if (!video_src && !poster && !fb_url && !ig_url) return json({ erro: aviso ?? "Vídeo indisponível para este anúncio" }, 422);
      return json({ video_src, poster, fb_url, ig_url, aviso });
    }


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
