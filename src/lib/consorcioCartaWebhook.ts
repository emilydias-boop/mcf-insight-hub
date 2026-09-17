import { supabase } from '@/integrations/supabase/client';

/**
 * Enfileira o aviso de venda de consórcio.
 *
 * O disparo HTTP para o Make NÃO acontece mais no navegador: a tela apenas
 * garante que exista UMA linha em `consorcio_venda_webhook_queue` para a venda,
 * e a edge function `consorcio-venda-webhook-dispatcher` (agendada) faz o envio
 * com retry. Isso elimina a perda silenciosa quando a aba fecha ou a chamada
 * falha — 46% das vendas nunca chegavam ao Make por esse motivo.
 *
 * O enfileiramento normal é feito pelo gatilho de banco
 * `trg_enqueue_consorcio_venda_webhook` no aceite da proposta; esta função é a
 * rede de segurança para os caminhos que ainda a chamam.
 *
 * Granularidade: UMA linha por VENDA (proposta), não por carta.
 */
export async function dispatchCartaCadastradaWebhook(params: {
  cardId?: string | null;
  registrationId?: string | null;
  proposalId?: string | null;
  force?: boolean;
}): Promise<{ sent: boolean; skipped?: boolean; error?: string }> {
  const { cardId = null, registrationId = null, proposalId = null } = params;
  try {
    let vendaId = proposalId;

    if (!vendaId && registrationId) {
      const { data } = await supabase
        .from('consorcio_pending_registrations')
        .select('proposal_id')
        .eq('id', registrationId)
        .maybeSingle();
      vendaId = (data as { proposal_id?: string | null } | null)?.proposal_id ?? null;
    }
    if (!vendaId && cardId) {
      const { data } = await supabase
        .from('consorcio_pending_registrations')
        .select('proposal_id')
        .eq('consortium_card_id', cardId)
        .maybeSingle();
      vendaId = (data as { proposal_id?: string | null } | null)?.proposal_id ?? null;
    }
    if (!vendaId) return { sent: false, skipped: true, error: 'venda não identificada' };

    // Unique em venda_id: repetir o insert não cria segunda mensagem.
    const { error } = await supabase
      .from('consorcio_venda_webhook_queue')
      .insert({ venda_id: vendaId } as never);

    // 23505 = já enfileirada; é o resultado esperado, não erro.
    if (error && (error as { code?: string }).code !== '23505') {
      console.warn('[consorcio-venda-webhook] falha ao enfileirar', error);
      return { sent: false, error: error.message };
    }
    return { sent: false, skipped: true };
  } catch (e) {
    console.warn('[consorcio-venda-webhook] erro inesperado', e);
    return { sent: false, error: e instanceof Error ? e.message : String(e) };
  }
}
