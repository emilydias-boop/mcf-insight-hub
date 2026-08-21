import { supabase } from '@/integrations/supabase/client';

/**
 * Documento do cliente é UM POR VENDA, não por carta.
 *
 * O arquivo no storage é único — o que se replica é a LINHA em
 * `consortium_documents`, uma por cadastro pendente da mesma venda (e para a
 * cota, quando a carta já virou cota). Assim as cartas 2, 3, ... deixam de
 * aparecer com "documento faltando" e cada cota carrega o documento do cliente.
 *
 * Nunca faz upload do mesmo binário N vezes.
 */
export async function replicarDocumentosDaVenda(
  proposalId: string,
  uploadedBy?: string | null,
): Promise<number> {
  if (!proposalId) return 0;

  const { data: regsRaw } = await supabase
    .from('consorcio_pending_registrations')
    .select('id, consortium_card_id')
    .eq('proposal_id', proposalId);
  const regs = (regsRaw || []) as Array<{ id: string; consortium_card_id: string | null }>;
  if (regs.length < 2) return 0;

  const regIds = regs.map(r => r.id);
  const cardIds = regs.map(r => r.consortium_card_id).filter(Boolean) as string[];

  const [porReg, porCard] = await Promise.all([
    supabase
      .from('consortium_documents')
      .select('id, pending_registration_id, card_id, tipo, nome_arquivo, storage_path, storage_url')
      .in('pending_registration_id', regIds),
    cardIds.length > 0
      ? supabase
          .from('consortium_documents')
          .select('id, pending_registration_id, card_id, tipo, nome_arquivo, storage_path, storage_url')
          .in('card_id', cardIds)
      : Promise.resolve({ data: [] as any[] } as any),
  ]);

  const todos = [...((porReg.data as any[]) || []), ...((porCard.data as any[]) || [])];
  if (todos.length === 0) return 0;

  // Acervo canônico da venda: um documento por storage_path.
  const canonicos = new Map<string, any>();
  for (const d of todos) {
    const path = String(d.storage_path || '');
    if (!path) continue;
    if (!canonicos.has(path)) canonicos.set(path, d);
  }
  if (canonicos.size === 0) return 0;

  const novas: any[] = [];
  for (const reg of regs) {
    const jaTem = new Set(
      todos
        .filter(d =>
          d.pending_registration_id === reg.id ||
          (reg.consortium_card_id && d.card_id === reg.consortium_card_id),
        )
        .map(d => String(d.storage_path || '')),
    );
    for (const [path, doc] of canonicos) {
      if (jaTem.has(path)) continue;
      novas.push({
        pending_registration_id: reg.id,
        card_id: reg.consortium_card_id || null,
        tipo: doc.tipo,
        nome_arquivo: doc.nome_arquivo,
        storage_path: path,
        storage_url: doc.storage_url || '',
        uploaded_by: uploadedBy || doc.uploaded_by || null,
      });
    }
  }

  if (novas.length === 0) return 0;
  const { error } = await supabase.from('consortium_documents').insert(novas as any);
  if (error) {
    console.error('[replicarDocumentosDaVenda] falha ao replicar:', error);
    return 0;
  }
  return novas.length;
}
