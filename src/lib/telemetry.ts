import { supabase } from "@/integrations/supabase/client";

type EventType = "error" | "page_view" | "page_load";

let sentErrors = 0;
const MAX_ERRORS_PER_SESSION = 50;

/** Grava um registro de medição. Nunca lança erro nem trava a tela. */
export async function logTelemetry(
  event_type: EventType,
  data: { route?: string; message?: string; details?: Record<string, unknown>; duration_ms?: number } = {}
) {
  try {
    if (event_type === "error") {
      if (sentErrors >= MAX_ERRORS_PER_SESSION) return;
      sentErrors++;
    }
    const { data: s } = await supabase.auth.getSession();
    if (!s.session) return;
    await (supabase as any).from("app_telemetry").insert({
      event_type,
      route: data.route ?? window.location.pathname,
      message: data.message?.slice(0, 2000) ?? null,
      details: data.details ?? null,
      duration_ms: data.duration_ms != null ? Math.round(data.duration_ms) : null,
    });
  } catch {
    /* silencioso de propósito */
  }
}

let installed = false;
export function installGlobalErrorTracking() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  window.addEventListener("error", (e) => {
    logTelemetry("error", { message: e.message, details: { source: "window.error", stack: e.error?.stack?.slice(0, 1500) } });
  });
  window.addEventListener("unhandledrejection", (e) => {
    const r: any = e.reason;
    logTelemetry("error", {
      message: String(r?.message ?? r ?? "unhandledrejection"),
      details: { source: "unhandledrejection", stack: r?.stack?.slice(0, 1500) },
    });
  });
}
