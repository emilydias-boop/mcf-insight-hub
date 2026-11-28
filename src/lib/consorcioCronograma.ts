import { supabase } from '@/integrations/supabase/client';
import { montarParcelasCota as montar, type ParamsCronograma } from '../../supabase/functions/_shared/consorcioCronograma';
export { qtdParcelasGeradas, offsetSegundaParcela, type ParamsCronograma } from '../../supabase/functions/_shared/consorcioCronograma';
export function montarParcelasCota(p: ParamsCronograma): Promise<any[]> { return montar(p, supabase); }

/**
 * Grava as parcelas em UMA transação via RPC, que registra um único lançamento
 * no histórico da cota ("Cronograma de N parcelas gerado").
 */
export async function inserirParcelas(parcelas: any[]): Promise<void> {
  if (!parcelas.length) return;
  const cardId = parcelas[0]?.card_id;
  const { error } = await supabase.rpc('consorcio_gerar_parcelas' as any, {
    p_card_id: cardId,
    p_parcelas: parcelas.map(({ card_id, ...rest }) => rest),
  });
  if (error) throw error;
}


/**
 * Gera o cronograma de uma cota que ainda não tem parcelas — usado quando o dia
 * de vencimento chega depois (confirmação da Embracon / edição da cota).
 * Não faz nada se a cota já tiver parcelas ou se faltar dado essencial.
 */
export async function gerarCronogramaSeFaltando(cardId: string): Promise<number> {
  const { data: card, error } = await supabase
    .from('consortium_cards')
    .select('id, dia_vencimento, prazo_meses, valor_credito, tipo_produto, tipo_contrato, parcelas_pagas_empresa, parcelas_mcf_numeros, tipo_registro, data_contratacao, data_reserva, condicao_pagamento, inclui_seguro_vida')
    .eq('id', cardId)
    .single();
  if (error) throw error;

  if (!card?.dia_vencimento || !card.prazo_meses || !card.valor_credito) return 0;

  const { count, error: countErr } = await supabase
    .from('consortium_installments')
    .select('id', { count: 'exact', head: true })
    .eq('card_id', cardId);
  if (countErr) throw countErr;
  if ((count || 0) > 0) return 0;

  const isReserva = card.tipo_registro === 'reserva';
  const baseDate = (isReserva ? card.data_reserva || card.data_contratacao : card.data_contratacao || card.data_reserva) as string | null;
  if (!baseDate) return 0;

  const parcelas = await montarParcelasCota({
    cardId,
    baseDate,
    diaVencimento: Number(card.dia_vencimento),
    prazoMeses: Number(card.prazo_meses),
    valorCredito: Number(card.valor_credito),
    tipoProduto: String(card.tipo_produto),
    tipoContrato: (card as any).tipo_contrato,
    parcelasEmpresa: Number((card as any).parcelas_pagas_empresa || 0),
    parcelasNumeros: (card as any).parcelas_mcf_numeros ?? null,

    condicaoPagamento: (card as any).condicao_pagamento,
    incluiSeguro: !!(card as any).inclui_seguro_vida,
    isReserva,

  });
  await inserirParcelas(parcelas);
  return parcelas.length;
}
