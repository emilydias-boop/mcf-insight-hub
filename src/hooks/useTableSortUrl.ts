import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { SortDir } from '@/lib/ordenacaoTabela';

/**
 * Persiste ordenação e busca na URL (`?ord=`, `?dir=`, `?q=`), usando o MESMO
 * mecanismo que a página já usa (useSearchParams + setSearchParams replace).
 *
 * `ord` é lido/escrito por aba: cada aba declara suas colunas em `campos`, e um
 * `ord` inválido ou vindo de outra aba cai no default em vez de quebrar.
 */
export function useTableSortUrl<F extends string>(opts: {
  /** colunas ordenáveis desta aba */
  campos: readonly F[];
  inicial: { field: F; dir: SortDir };
  /** true quando esta aba é a visível — abas inativas não escrevem na URL */
  ativa?: boolean;
}): {
  field: F;
  dir: SortDir;
  toggle: (field: F) => void;
  setSort: (field: F, dir: SortDir) => void;
  q: string;
  setQ: (valor: string) => void;
} {
  const { campos, inicial, ativa = true } = opts;
  const [searchParams, setSearchParams] = useSearchParams();

  const ordParam = searchParams.get('ord');
  const dirParam = searchParams.get('dir');

  const field = useMemo<F>(
    () => (ordParam && (campos as readonly string[]).includes(ordParam) ? (ordParam as F) : inicial.field),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ordParam, campos, inicial.field],
  );
  const dir: SortDir = dirParam === 'asc' || dirParam === 'desc' ? dirParam : inicial.dir;

  const q = searchParams.get('q') || '';

  const escrever = useCallback(
    (mudancas: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams);
      Object.entries(mudancas).forEach(([k, v]) => {
        if (v === null || v === '') next.delete(k);
        else next.set(k, v);
      });
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const setSort = useCallback(
    (f: F, d: SortDir) => {
      if (!ativa) return;
      const ehDefault = f === inicial.field && d === inicial.dir;
      escrever({ ord: ehDefault ? null : f, dir: ehDefault ? null : d });
    },
    [ativa, escrever, inicial.field, inicial.dir],
  );

  const toggle = useCallback(
    (f: F) => {
      if (f === field) setSort(f, dir === 'asc' ? 'desc' : 'asc');
      else setSort(f, 'asc'); // campo novo começa em asc
    },
    [field, dir, setSort],
  );

  const setQ = useCallback(
    (valor: string) => {
      if (!ativa) return;
      escrever({ q: valor.trim() ? valor : null });
    },
    [ativa, escrever],
  );

  return { field, dir, toggle, setSort, q, setQ };
}
