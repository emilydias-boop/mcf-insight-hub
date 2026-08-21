import { supabase } from '@/integrations/supabase/client';
import { calcularComissao } from '@/lib/commissionCalculator';
import { getProdutoComissaoContext } from '@/lib/produtoComissaoLookup';
import { calcularProximoDiaUtil } from '@/lib/businessDays';

/**
 * Cronograma de parcelas da cota.
 *
 * O `dia_vencimento` da cota é definido pela EMBRACON depois da abertura, então
 * na abertura ele pode ficar em branco ("A definir"). Sem esse dia não existe
 * data de vencimento confiável — por isso o cronograma NÃO é gerado enquanto o
 * dia estiver nulo, e é gerado depois, quando o dia é informado
 * (confirmação da Embracon ou edição da cota).
 */

export interface ParamsCronograma {
  cardId: string;
  /** Data base: contratação (ou reserva, quando a cota nasce como reserva). */
  baseDate: string; // YYYY-MM-DD
  diaVencimento: number;
  prazoMeses: number;
  valorCredito: number;
  tipoProduto: string;
  tipoContrato?: string | null;
  parcelasEmpresa?: number;
  inicioSegundaParcela?: string | null;
  /** Reserva → parcelas nascem como 'previsto'. */
  isReserva?: boolean;
}

/** Offset em meses da 2ª parcela em relação à data base. */
export function offsetSegundaParcela(baseDate: Date, inicio?: string | null): number {
  if (inicio === 'proximo_mes') return 1;
  if (inicio === 'pular_mes') return 2;
  return baseDate.getDate() > 16 ? 2 : 1;
}

/** Monta as linhas de `consortium_installments` (sem gravar). */
export async function montarParcelasCota(p: ParamsCronograma): Promise<any[]> {
  const [year, month, day] = String(p.baseDate).split('-').map(Number);
  const dataBase = new Date(year, month - 1, day);
  const offset = offsetSegundaParcela(dataBase, p.inicioSegundaParcela);

  const tipoContrato = p.tipoContrato || 'normal';
  const parcelasEmpresa = p.parcelasEmpresa || 0;
  const ctxComissao = await getProdutoComissaoContext(p.valorCredito, p.tipoProduto as any);

  const parcelas: any[] = [];
  for (let i = 1; i <= p.prazoMeses; i++) {
    let dataVencimento: Date;
    if (i === 1) {
      dataVencimento = dataBase;
    } else {
      const monthOffset = offset + (i - 2);
      const mesAlvo = dataBase.getMonth() + monthOffset;
      const anoAlvo = dataBase.getFullYear() + Math.floor(mesAlvo / 12);
      const mesNormalizado = ((mesAlvo % 12) + 12) % 12;
      const ultimoDia = new Date(anoAlvo, mesNormalizado + 1, 0).getDate();
      const diaAjustado = Math.min(p.diaVencimento, ultimoDia);
      dataVencimento = calcularProximoDiaUtil(new Date(anoAlvo, mesNormalizado, diaAjustado));
    }

    const valorComissao = calcularComissao(p.valorCredito, p.tipoProduto as any, i, ctxComissao);

    let tipo: 'cliente' | 'empresa';
    if (tipoContrato === 'intercalado') {
      const ehPar = i % 2 === 0;
      tipo = ehPar && i / 2 <= parcelasEmpresa ? 'empresa' : 'cliente';
    } else if (tipoContrato === 'intercalado_impar') {
      const ehImpar = i % 2 === 1;
      tipo = ehImpar && Math.ceil(i / 2) <= parcelasEmpresa ? 'empresa' : 'cliente';
    } else {
      tipo = i <= parcelasEmpresa ? 'empresa' : 'cliente';
    }

    parcelas.push({
      card_id: p.cardId,
      numero_parcela: i,
      tipo,
      valor_parcela: p.valorCredito / p.prazoMeses,
      valor_comissao: valorComissao,
      data_vencimento: dataVencimento.toISOString().split('T')[0],
      status: p.isReserva ? 'previsto' : 'pendente',
    });
  }
  return parcelas;
}

/** Grava as parcelas em blocos (evita payload grande em prazos de 200+ meses). */
export async function inserirParcelas(parcelas: any[]): Promise<void> {
  const CHUNK_SIZE = 8;
  for (let i = 0; i < parcelas.length; i += CHUNK_SIZE) {
    const { error } = await supabase
      .from('consortium_installments')
      .insert(parcelas.slice(i, i + CHUNK_SIZE));
    if (error) throw error;
  }
}

/**
 * Gera o cronograma de uma cota que ainda não tem parcelas — usado quando o dia
 * de vencimento chega depois (confirmação da Embracon / edição da cota).
 * Não faz nada se a cota já tiver parcelas ou se faltar dado essencial.
 */
export async function gerarCronogramaSeFaltando(cardId: string): Promise<number> {
  const { data: card, error } = await supabase
    .from('consortium_cards')
    .select('id, dia_vencimento, prazo_meses, valor_credito, tipo_produto, tipo_contrato, parcelas_pagas_empresa, inicio_segunda_parcela, tipo_registro, data_contratacao, data_reserva')
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
    inicioSegundaParcela: (card as any).inicio_segunda_parcela,
    isReserva,
  });
  await inserirParcelas(parcelas);
  return parcelas.length;
}
