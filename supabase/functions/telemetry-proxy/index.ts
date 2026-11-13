import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";

const MAX_BYTES = 4096;
const Body = z.object({
  event: z.enum(["heartbeat", "session_start", "session_end"]),
  session_id: z.string().min(8).max(64),
  route: z.string().max(300).nullable().optional(),
  screen_name: z.string().max(200).nullable().optional(),
  last_interaction_at: z.string().datetime().nullable().optional(),
  tab_visible: z.boolean().nullable().optional(),
  // sendBeacon não envia header: token pode vir no corpo
  access_token: z.string().max(4000).optional(),
});

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const raw = await req.text();
  if (raw.length > MAX_BYTES) return json({ error: "Payload too large" }, 413);
  let parsedJson: unknown;
  try { parsedJson = JSON.parse(raw); } catch { return json({ error: "Invalid JSON" }, 400); }
  const parsed = Body.safeParse(parsedJson);
  if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);
  const b = parsed.data;

  const auth = req.headers.get("Authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : b.access_token;
  if (!token) return json({ error: "Unauthorized" }, 401);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!);
  const { data: c, error: cErr } = await anon.auth.getClaims(token);
  if (cErr || !c?.claims?.sub) return json({ error: "Unauthorized" }, 401);
  const userId = c.claims.sub as string;
  const email = String(c.claims.email ?? "").toLowerCase();

  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { error: insErr } = await admin.from("app_telemetry").insert({
    user_id: userId,
    event_type: b.event,
    route: b.route ?? null,
    screen_name: b.screen_name ?? null,
    session_id: b.session_id,
    last_interaction_at: b.last_interaction_at ?? null,
    tab_visible: b.tab_visible ?? null,
  });
  if (insErr) console.error("telemetry-proxy insert:", insErr.message);

  const ingest = Deno.env.get("CENTRO_INGEST_URL");
  const key = Deno.env.get("CENTRO_APP_KEY");
  if (!ingest || !key) {
    console.warn("telemetry-proxy: CENTRO_INGEST_URL/CENTRO_APP_KEY não configurados; repasse ignorado");
  } else if (email.endsWith("@minhacasafinanciada.com")) {
    try {
      const r = await fetch(ingest, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-app-key": key },
        body: JSON.stringify({
          email, session_id: b.session_id, route: b.route ?? null, screen_name: b.screen_name ?? null,
          last_interaction_at: b.last_interaction_at ?? null, tab_visible: b.tab_visible ?? null, event: b.event,
        }),
        signal: AbortSignal.timeout(3000),
      });
      if (!r.ok) console.error("telemetry-proxy Centro status:", r.status);
    } catch (e) {
      console.error("telemetry-proxy Centro falhou:", (e as Error).message);
    }
  }
  return json({ ok: true });
});