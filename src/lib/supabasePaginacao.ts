/**
 * Helpers de paginação do PostgREST.
 *
 * Sem `.range()` explícito o PostgREST corta a resposta no teto default de 1000
 * linhas SEM erro nenhum — a tela mostra dados truncados e ninguém percebe.
 */

export const PAGE_SIZE = 1000;
export const CHUNK_SIZE = 200;
export const MAX_PAGES = 50; // guarda contra loop infinito

/** PostgREST devolve 416/PGRST103 quando o offset passa do total — isso é "fim da lista", não erro. */
export function isRangeExhausted(error: any) {
  const code = error?.code || '';
  const msg = `${error?.message || ''} ${error?.details || ''}`.toLowerCase();
  return (
    code === 'PGRST103' ||
    code === '416' ||
    msg.includes('range not satisfiable') ||
    msg.includes('requested range')
  );
}

/** Busca todas as páginas de um builder (contorna o limite default de 1000 linhas). */
export async function fetchAllPages<T = any>(
  build: (from: number, to: number) => any,
): Promise<T[]> {
  const all: T[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const from = page * PAGE_SIZE;
    const { data, error } = await build(from, from + PAGE_SIZE - 1);
    if (error) {
      if (isRangeExhausted(error)) break; // offset além do total: acabou
      throw error;
    }
    const rows = (data || []) as T[];
    all.push(...rows);
    if (rows.length < PAGE_SIZE) break;
  }
  return all;
}

/**
 * Busca por lista de ids. Resolve DOIS tetos ao mesmo tempo:
 * o tamanho da URL do `.in(...)` e o limite de 1000 linhas por resposta.
 * Por isso quebra os ids em lotes E pagina cada lote — relações 1-para-N
 * (parcelas, documentos, log de atividade) passam de 1000 linhas com poucos ids.
 */
export async function fetchAllByIds<T = any>(
  ids: string[],
  run: (
    loteDeIds: string[],
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: any }>,
  tamanhoDoLote = CHUNK_SIZE,
): Promise<T[]> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  const out: T[] = [];
  for (let i = 0; i < unique.length; i += tamanhoDoLote) {
    const lote = unique.slice(i, i + tamanhoDoLote);
    const rows = await fetchAllPages<T>((from, to) => run(lote, from, to));
    out.push(...rows);
  }
  return out;
}