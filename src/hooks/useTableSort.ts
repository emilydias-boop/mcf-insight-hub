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
  const [field, setField] = useState<F>(inicial.field);
  const [dir, setDir] = useState<SortDir>(inicial.dir);

  const toggle = useCallback((next: F) => {
    setField((atual) => {
      if (atual === next) {
        setDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        return atual;
      }
      setDir('asc'); // campo novo começa em asc
      return next;
    });
  }, []);

  const setSort = useCallback((f: F, d: SortDir) => {
    setField(f);
    setDir(d);
  }, []);

  const sorted = useMemo(() => {
    const extrair = extratores[field];
    if (!extrair) return rows;
    return ordenarPor(rows, extrair, dir);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, field, dir]);

  return { rows: sorted, field, dir, toggle, setSort };
}
