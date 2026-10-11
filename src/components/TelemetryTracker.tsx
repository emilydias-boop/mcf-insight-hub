import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { logTelemetry, installGlobalErrorTracking } from "@/lib/telemetry";

/** Registra abertura de tela e tempo até a tela ficar pronta (próximo quadro ocioso). */
export function TelemetryTracker() {
  const location = useLocation();
  const first = useRef(true);

  useEffect(() => {
    installGlobalErrorTracking();
  }, []);

  useEffect(() => {
    const route = location.pathname;
    const start = first.current ? 0 : performance.now();
    const isFirst = first.current;
    first.current = false;
    logTelemetry("page_view", { route });
    const done = () => {
      const duration = performance.now() - start;
      logTelemetry("page_load", { route, duration_ms: duration, details: { first_load: isFirst } });
    };
    const w = window as any;
    const id = w.requestIdleCallback ? w.requestIdleCallback(done, { timeout: 10000 }) : setTimeout(done, 0);
    return () => {
      if (w.cancelIdleCallback && w.requestIdleCallback) w.cancelIdleCallback(id);
      else clearTimeout(id);
    };
  }, [location.pathname]);

  return null;
}
