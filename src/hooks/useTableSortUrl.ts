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
  /** sufixo dos parâmetros, para telas com DUAS tabelas (`ordA`/`dirA`/`qA`) */
  sufixo?: string;
}): {
  field: F;
  dir: SortDir;
  toggle: (field: F) => void;
  setSort: (field: F, dir: SortDir) => void;
  q: string;
  setQ: (valor: string) => void;
} {
  const { campos, inicial, ativa = true, sufixo = '' } = opts;
  const [searchParams, setSearchParams] = useSearchParams();
  const kOrd = `ord${sufixo}`;
  const kDir = `dir${sufixo}`;
  const kQ = `q${sufixo}`;

  const ordParam = searchParams.get(kOrd);
  const dirParam = searchParams.get(kDir);

  const field = useMemo<F>(
    () => (ordParam && (campos as readonly string[]).includes(ordParam) ? (ordParam as F) : inicial.field),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ordParam, campos, inicial.field],
  );
  const dir: SortDir = dirParam === 'asc' || dirParam === 'desc' ? dirParam : inicial.dir;

  const q = searchParams.get(kQ) || '';

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
      escrever({ [kOrd]: ehDefault ? null : f, [kDir]: ehDefault ? null : d });
    },
    [ativa, escrever, inicial.field, inicial.dir, kOrd, kDir],
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
      escrever({ [kQ]: valor.trim() ? valor : null });
    },
    [ativa, escrever, kQ],
  );

  return { field, dir, toggle, setSort, q, setQ };
}
