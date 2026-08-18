import { supabase } from '@/integrations/supabase/client';

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
    supabase
      .from('consortium_documents')
      .select('pending_registration_id')
      .in('pending_registration_id', regIds),
    cardIds.length
      ? supabase.from('consortium_documents').select('card_id').in('card_id', cardIds)
      : Promise.resolve({ data: [] as any[] } as any),
  ]);

  (byReg.data || []).forEach((d: any) => {
    if (d.pending_registration_id) withDocs.add(d.pending_registration_id);
  });

  const cardsWithDocs = new Set<string>();
  (byCard.data || []).forEach((d: any) => {
    if (d.card_id) cardsWithDocs.add(d.card_id);
  });
  regs.forEach((r) => {
    if (r.consortium_card_id && cardsWithDocs.has(r.consortium_card_id)) withDocs.add(r.id);
  });

  return withDocs;
}
