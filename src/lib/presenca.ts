import { supabase } from "@/integrations/supabase/client";

/**
 * Presença/ociosidade: registra apenas QUE houve interação e quando.
 * Nunca envia teclas, texto digitado ou posição do mouse.
 */
type Evento = "heartbeat" | "session_start" | "session_end";

const HEARTBEAT_MS = 45_000;
const THROTTLE_MS = 5_000;
const FN_URL = `${import.meta.env.VITE_SUPABASE_URL ?? `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co`}/functions/v1/telemetry-proxy`;

let installed = false;
let lastInteraction = Date.now();
let lastMark = 0;
let token: string | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let ativo = false;
let nomes: Map<string, string> | null = null;

function sessionId() {
  const k = "mcf_telemetry_session_id";
  let id = sessionStorage.getItem(k);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(k, id);
  }
  return id;
}

async function carregarNomes() {
  if (nomes) return;
  try {
    const m = await import("@/components/layout/AppSidebar");
    const map = new Map<string, string>();
    const add = (url?: string, title?: string) => { if (url && title) map.set(url, title); };
    for (const i of (m.menuItems ?? []) as any[]) {
      add(i.url, i.title);
      for (const s of i.items ?? []) {
        add(s.url, s.title);
        for (const ss of s.items ?? []) add(ss.url, ss.title);
      }
    }
    nomes = map;
  } catch {
    nomes = new Map();
  }
}

export function nomeDaTela(path: string): string | null {
  if (!nomes) return null;
  if (nomes.has(path)) return nomes.get(path)!;
  let best: string | null = null, len = 0;
  for (const [url, t] of nomes) {
    if (url.length > 1 && path.startsWith(url + "/") && url.length > len) { best = t; len = url.length; }
  }
  return best;
}

function payload(event: Evento) {
  const route = window.location.pathname;
  return {
    event,
    session_id: sessionId(),
    route,
    screen_name: nomeDaTela(route),
    last_interaction_at: new Date(lastInteraction).toISOString(),
    tab_visible: document.visibilityState === "visible",
  };
}

let lastSent = 0;

function enviar(event: Evento, beacon = false) {
  try {
    if (!token) return;
    const body = payload(event);
    lastSent = Date.now();
    if (beacon && navigator.sendBeacon) {
      const blob = new Blob([JSON.stringify({ ...body, access_token: token })], { type: "text/plain" });
      if (navigator.sendBeacon(FN_URL, blob)) return;
    }
    fetch(FN_URL, {
      method: "POST",
      keepalive: true,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify(body),
    }).catch(() => {});
  } catch {
    /* silencioso de propósito */
  }
}

function marcar() {
  const now = Date.now();
  if (now - lastMark < THROTTLE_MS) return;
  lastMark = now;
  lastInteraction = now;
}

async function iniciar() {
  if (ativo) return;
  ativo = true;
  lastInteraction = Date.now();
  await carregarNomes();
  enviar("session_start");
  timer = setInterval(() => enviar("heartbeat"), HEARTBEAT_MS);
}

function parar(beacon: boolean) {
  if (!ativo) return;
  enviar("session_end", beacon);
  ativo = false;
  if (timer) clearInterval(timer);
  timer = null;
}

export function installPresenceTracking() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  const opts = { passive: true, capture: true } as AddEventListenerOptions;
  for (const ev of ["mousemove", "keydown", "click", "scroll", "touchstart"]) window.addEventListener(ev, marcar, opts);
  document.addEventListener("visibilitychange", () => {
    if (ativo && Date.now() - lastSent > 6000) enviar("heartbeat");
  });
  window.addEventListener("beforeunload", () => parar(true));

  supabase.auth.getSession().then(({ data }) => {
    token = data.session?.access_token ?? null;
    if (token) iniciar();
  });
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT") {
      parar(false); // usa o último token conhecido
      token = null;
      return;
    }
    token = session?.access_token ?? null;
    if (token) iniciar();
  });
}
