import { useEffect, useState } from 'react';

/** Tick de tempo para reavaliar janelas/prazos na UI. Padrão: 60s. */
export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
