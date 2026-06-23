import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { isDiaUtil } from "@/lib/businessDays";
import { SdrGamificationDialog } from "./SdrGamificationDialog";

const STORAGE_KEY_PREFIX = "gamification:sdr:lastShownAt:";
const BUSINESS_HOUR_START = 9;
const BUSINESS_HOUR_END = 19; // inclusive last popup at 19:00
const HIDDEN_ROUTES = ["/auth", "/reset-password"];
const AUTO_DISMISS_MS = 30_000;

function currentHourKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}-${d.getHours()}`;
}

function isWithinBusinessHours(d: Date) {
  if (!isDiaUtil(d)) return false;
  const h = d.getHours();
  return h >= BUSINESS_HOUR_START && h <= BUSINESS_HOUR_END;
}

export function GamificationScheduler() {
  const { user } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  const storageKey = user?.id ? `${STORAGE_KEY_PREFIX}${user.id}` : null;
  const routeBlocked = HIDDEN_ROUTES.some((r) => location.pathname.startsWith(r));

  // Try to show every minute (cheap check).
  useEffect(() => {
    if (!storageKey || routeBlocked) return;

    const tryShow = () => {
      if (routeBlocked) return;
      const now = new Date();
      if (!isWithinBusinessHours(now)) return;
      const hourKey = currentHourKey(now);
      const last = localStorage.getItem(storageKey);
      if (last === hourKey) return;
      localStorage.setItem(storageKey, hourKey);
      setOpen(true);
    };

    // Initial check shortly after mount (gives query client time to settle).
    const initial = window.setTimeout(tryShow, 4_000);
    const interval = window.setInterval(tryShow, 60_000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
    };
  }, [storageKey, routeBlocked]);

  // Auto-dismiss after a while so it doesn't block the screen.
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => setOpen(false), AUTO_DISMISS_MS);
    return () => window.clearTimeout(t);
  }, [open]);

  if (!storageKey) return null;
  return <SdrGamificationDialog open={open} onOpenChange={setOpen} />;
}