import { useEffect, useState } from 'react';

/** Atrasa a propagação de `valor` em `ms`. Usado em buscas server-side. */
export function useDebounce<T>(valor: T, ms = 300): T {
  const [debounced, setDebounced] = useState<T>(valor);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(valor), ms);
    return () => clearTimeout(t);
  }, [valor, ms]);
  return debounced;
}
