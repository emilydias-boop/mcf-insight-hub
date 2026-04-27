import { useState, useEffect, useRef, useCallback } from "react";
import { RefreshCw, X } from "lucide-react";

const CHECK_INTERVAL_MS = 60_000; // 60 seconds

/**
 * Só ativa o checker no domínio publicado (produção).
 * Em preview da Lovable (id-preview--*.lovable.app) e em dev local,
 * o index.html é regenerado a cada hot-reload, gerando falsos positivos.
 */
function isProductionHost(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  // Domínio customizado de produção
  if (host === "mcfgestao.com" || host.endsWith(".mcfgestao.com")) return true;
  // App publicado em *.lovable.app, mas NÃO o preview (id-preview--*)
  if (host.endsWith(".lovable.app") && !host.startsWith("id-preview--")) return true;
  return false;
}

function useUpdateChecker() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const initialHash = useRef<string | null>(null);

  const computeHash = useCallback(async (text: string) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }, []);

  useEffect(() => {
    // Skip entirely in preview/dev — evita banner falso a cada rebuild
    if (!isProductionHost()) return;

    let timer: ReturnType<typeof setInterval>;

    const check = async () => {
      try {
        const res = await fetch("/index.html", {
          cache: "no-store",
          headers: { "Cache-Control": "no-cache" },
        });
        if (!res.ok) return;

        const text = await res.text();
        const hash = await computeHash(text);

        if (initialHash.current === null) {
          initialHash.current = hash;
        } else if (hash !== initialHash.current) {
          setUpdateAvailable(true);
        }
      } catch {
        // silently ignore network errors
      }
    };

    // First check after a short delay to get baseline
    const initialTimer = setTimeout(check, 5_000);
    timer = setInterval(check, CHECK_INTERVAL_MS);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(timer);
    };
  }, [computeHash]);

  return updateAvailable;
}

export function UpdateNotifier() {
  const updateAvailable = useUpdateChecker();
  const [dismissed, setDismissed] = useState(false);

  if (!updateAvailable || dismissed) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-center gap-3 bg-primary px-4 py-2.5 text-primary-foreground text-sm shadow-lg animate-in slide-in-from-top duration-300">
      <RefreshCw className="h-4 w-4 animate-spin" />
      <span className="font-medium">Nova versão disponível!</span>
      <button
        onClick={() => window.location.reload()}
        className="ml-1 rounded-md bg-primary-foreground/20 px-3 py-1 text-xs font-semibold hover:bg-primary-foreground/30 transition-colors"
      >
        Atualizar agora
      </button>
      <button
        onClick={() => setDismissed(true)}
        className="ml-1 rounded-md p-1 hover:bg-primary-foreground/20 transition-colors"
        aria-label="Fechar"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
