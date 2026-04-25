import { useEffect, useRef } from 'react';
import { toast } from 'sonner';

interface UseInactivityLogoutOptions {
  /** Tempo em ms até logout automático. Default: 3 horas */
  timeoutMs?: number;
  /** Tempo em ms antes do logout para exibir aviso. Default: 5 min */
  warningMs?: number;
  /** Callback executado quando o tempo expira */
  onTimeout: () => void;
  /** Se false, o timer não é ativado */
  enabled?: boolean;
}

const DEFAULT_TIMEOUT = 3 * 60 * 60 * 1000; // 3 horas
const DEFAULT_WARNING = 5 * 60 * 1000; // 5 minutos
const STORAGE_KEY = 'mcf:lastActivity';

/**
 * Monitora atividade do usuário (mouse/teclado/touch) e dispara `onTimeout`
 * após o período de inatividade configurado. Sincroniza entre abas via
 * localStorage para que atividade em qualquer aba reinicie o timer.
 */
export function useInactivityLogout({
  timeoutMs = DEFAULT_TIMEOUT,
  warningMs = DEFAULT_WARNING,
  onTimeout,
  enabled = true,
}: UseInactivityLogoutOptions) {
  const timeoutRef = useRef<number | null>(null);
  const warningRef = useRef<number | null>(null);
  const warnedRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    const clearTimers = () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      if (warningRef.current) window.clearTimeout(warningRef.current);
      timeoutRef.current = null;
      warningRef.current = null;
    };

    const scheduleTimers = () => {
      clearTimers();
      warnedRef.current = false;

      warningRef.current = window.setTimeout(() => {
        warnedRef.current = true;
        toast.warning('Sua sessão será encerrada em 5 minutos por inatividade.', {
          duration: 10000,
        });
      }, Math.max(0, timeoutMs - warningMs));

      timeoutRef.current = window.setTimeout(() => {
        onTimeout();
      }, timeoutMs);
    };

    const recordActivity = () => {
      try {
        localStorage.setItem(STORAGE_KEY, Date.now().toString());
      } catch {
        /* ignore */
      }
      scheduleTimers();
    };

    // Atividade em outras abas reinicia o timer também
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) scheduleTimers();
    };

    const events: Array<keyof WindowEventMap> = [
      'mousemove',
      'mousedown',
      'keydown',
      'touchstart',
      'scroll',
      'wheel',
      'click',
    ];

    events.forEach((evt) => window.addEventListener(evt, recordActivity, { passive: true }));
    window.addEventListener('storage', onStorage);

    // Inicia contagem ao montar
    scheduleTimers();

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, recordActivity));
      window.removeEventListener('storage', onStorage);
      clearTimers();
    };
  }, [enabled, timeoutMs, warningMs, onTimeout]);
}