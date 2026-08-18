import { useMemo, useState, useCallback } from 'react';
import { ordenarPor, type SortDir } from '@/lib/ordenacaoTabela';

export type { SortDir };

/**
 * Ordenação de tabela em memória.
 *
 * O mapa `extratores` é o que resolve colunas DERIVADAS: a tabela passa a
 * função que devolve o valor real (data calculada, soma de comissão, dias em
 * atraso) — a ordenação nunca compara o texto formatado exibido na tela.
 */
export function useTableSort<T, F extends string>(
  rows: T[],
  extratores: Record<F, (row: T) => unknown>,
  inicial: { field: F; dir: SortDir },
): {
  rows: T[];
  field: F;
  dir: SortDir;
  toggle: (field: F) => void;
  setSort: (field: F, dir: SortDir) => void;
} {
  // Estado único: um updater não pode ter efeito colateral (StrictMode chama o
  // updater duas vezes em dev e a direção inverteria duas vezes).
  const [estado, setEstado] = useState<{ field: F; dir: SortDir }>(inicial);
  const { field, dir } = estado;

  const toggle = useCallback((next: F) => {
    setEstado((atual) =>
      atual.field === next
        ? { field: atual.field, dir: atual.dir === 'asc' ? 'desc' : 'asc' }
        : { field: next, dir: 'asc' }, // campo novo começa em asc
    );
  }, []);

  const setSort = useCallback((f: F, d: SortDir) => {
    setEstado({ field: f, dir: d });
  }, []);

  const sorted = useMemo(() => {
    const extrair = extratores[field];
    if (!extrair) return rows;
    return ordenarPor(rows, extrair, dir);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, field, dir]);

  return { rows: sorted, field, dir, toggle, setSort };
}
