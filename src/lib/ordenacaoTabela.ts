/**
 * Comparador genérico de ordenação de tabela.
 *
 * Regras válidas para TODAS as tabelas do projeto:
 *  - vazio (null/undefined/'') vai SEMPRE para o fim, nas duas direções;
 *  - number/Date comparam naturalmente;
 *  - boolean: false antes de true em 'asc';
 *  - string que representa número compara como NÚMERO (grupo/cota são texto no
 *    banco mas contêm números — "9" tem que vir antes de "10");
 *  - string normal usa localeCompare pt-BR com sensitivity 'base' (para "Éder"
 *    cair junto de "Eder") e numeric: true;
 *  - empate preserva a ordem original (ordenação estável).
 */

export type SortDir = 'asc' | 'desc';

const isVazio = (v: unknown): boolean =>
  v === null || v === undefined || (typeof v === 'string' && v.trim() === '') ||
  (typeof v === 'number' && Number.isNaN(v)) ||
  (v instanceof Date && Number.isNaN(v.getTime()));

/** String inteiramente numérica (aceita separadores BR e sinal). */
const numeroDeTexto = (v: string): number | null => {
  const s = v.trim();
  if (!/^-?[\d.,\s]+$/.test(s)) return null;
  const normalizado = s.replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
  const n = Number(normalizado);
  return Number.isFinite(n) ? n : null;
};

const paraComparavel = (v: unknown): number | string | boolean => {
  if (v instanceof Date) return v.getTime();
  if (typeof v === 'number' || typeof v === 'boolean') return v;
  if (typeof v === 'string') {
    const n = numeroDeTexto(v);
    return n !== null ? n : v;
  }
  return String(v);
};

export function compararValores(a: unknown, b: unknown, dir: SortDir): number {
  const aVazio = isVazio(a);
  const bVazio = isVazio(b);
  // Vazio sempre por último, independente da direção.
  if (aVazio && bVazio) return 0;
  if (aVazio) return 1;
  if (bVazio) return -1;

  const sinal = dir === 'asc' ? 1 : -1;
  const va = paraComparavel(a);
  const vb = paraComparavel(b);

  if (typeof va === 'boolean' || typeof vb === 'boolean') {
    const na = va ? 1 : 0;
    const nb = vb ? 1 : 0;
    return (na - nb) * sinal;
  }

  if (typeof va === 'number' && typeof vb === 'number') {
    if (va === vb) return 0;
    return (va < vb ? -1 : 1) * sinal;
  }

  // Tipos mistos (número vs texto): número primeiro, de forma determinística.
  if (typeof va === 'number' && typeof vb === 'string') return -1 * sinal;
  if (typeof va === 'string' && typeof vb === 'number') return 1 * sinal;

  return String(va).localeCompare(String(vb), 'pt-BR', {
    sensitivity: 'base',
    numeric: true,
  }) * sinal;
}

/** Ordena por uma função de extração. Sempre devolve array novo. */
export function ordenarPor<T>(
  rows: T[],
  extrair: (row: T) => unknown,
  dir: SortDir,
): T[] {
  return rows
    .map((row, i) => ({ row, i, valor: extrair(row) }))
    .sort((a, b) => {
      const r = compararValores(a.valor, b.valor, dir);
      return r !== 0 ? r : a.i - b.i; // desempate estável
    })
    .map((x) => x.row);
}
