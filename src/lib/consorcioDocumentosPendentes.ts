import { supabase } from '@/integrations/supabase/client';

const PAGE_SIZE = 1000;
const CHUNK_SIZE = 200;
const MAX_PAGES = 50;

function isRangeExhausted(error: any) {
  const code = error?.code || '';
  const msg = `${error?.message || ''} ${error?.details || ''}`.toLowerCase();
  return (
    code === 'PGRST103' ||
    code === '416' ||
    msg.includes('range not satisfiable') ||
    msg.includes('requested range')
  );
}

/** Busca todas as páginas (contorna o teto de 1000 linhas do PostgREST). */
async function fetchAllPages<T = any>(
  build: (from: number, to: number) => any,
): Promise<T[]> {
  const all: T[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const from = page * PAGE_SIZE;
    const { data, error } = await build(from, from + PAGE_SIZE - 1);
    if (error) {
      if (isRangeExhausted(error)) break;
      throw error;
    }
    const rows = (data || []) as T[];
    all.push(...rows);
    if (rows.length < PAGE_SIZE) break;
  }
  return all;
}

/** Consulta em lotes de ids + paginação — nunca perde documento por corte de 1000. */
async function fetchDocsBy(column: 'pending_registration_id' | 'card_id', ids: string[]) {
  const out: any[] = [];
  for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
    const chunk = ids.slice(i, i + CHUNK_SIZE);
    const rows = await fetchAllPages<any>((from, to) =>
      supabase
        .from('consortium_documents')
        .select(column)
        .in(column, chunk)
        .order('id', { ascending: true })
        .range(from, to),
    );
    out.push(...rows);
  }
  return out;
}

export interface PendingRegDocRef {
  id: string;
  consortium_card_id?: string | null;
}

/**
 * CRITÉRIO ÚNICO de "cadastro pendente tem documento" (usado nas abas 3 e 4 do
 * Pós-Reunião, para os dois selos nunca divergirem):
 * existe `consortium_documents` ligado ao próprio `pending_registration_id`
 * OU ao `card_id` do card vinculado a esse cadastro pendente.
 *
 * Retorna o conjunto de ids de cadastro pendente QUE TÊM documento.
 */
export async function fetchPendingRegsWithDocs(
  regs: PendingRegDocRef[],
): Promise<Set<string>> {
  const withDocs = new Set<string>();
  const regIds = Array.from(new Set(regs.map((r) => r.id).filter(Boolean)));
  if (regIds.length === 0) return withDocs;

  const cardIds = Array.from(
    new Set(regs.map((r) => r.consortium_card_id).filter(Boolean) as string[]),
  );

  const [byReg, byCard] = await Promise.all([
    fetchDocsBy('pending_registration_id', regIds),
    cardIds.length ? fetchDocsBy('card_id', cardIds) : Promise.resolve([] as any[]),
  ]);

  (byReg || []).forEach((d: any) => {
    if (d.pending_registration_id) withDocs.add(d.pending_registration_id);
  });

  const cardsWithDocs = new Set<string>();
  (byCard || []).forEach((d: any) => {
    if (d.card_id) cardsWithDocs.add(d.card_id);
  });
  regs.forEach((r) => {
    if (r.consortium_card_id && cardsWithDocs.has(r.consortium_card_id)) withDocs.add(r.id);
  });

  return withDocs;
}
