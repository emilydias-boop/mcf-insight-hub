import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const IGNORED_PREFIXES = ["/auth", "/login", "/reset-password", "/bi/", "/tv", "/checkin"];

/**
 * Fire-and-forget registro de acesso por página (só pathname, sem query string).
 * Nunca bloqueia render nem quebra a navegação.
 */
export function usePageAccessLog() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    if (lastPath.current === pathname) return;
    if (IGNORED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p))) return;
    lastPath.current = pathname;

    void supabase
      .from("page_access_log")
      .insert({ user_id: user.id, path: pathname })
      .then(() => undefined, () => undefined);
  }, [pathname, user?.id]);
}
