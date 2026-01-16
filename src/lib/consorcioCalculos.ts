import { ConsorcioProduto, ConsorcioCredito, CondicaoPagamento, PrazoParcelas, CalculoParcela } from '@/types/consorcioProdutos';

/**
 * Obtém a taxa de administração baseada no prazo
 */
export function getTaxaAdm(produto: ConsorcioProduto, prazo: PrazoParcelas): number {
  switch (prazo) {
    case 200:
      return produto.taxa_adm_200 || 20;
    case 220:
      return produto.taxa_adm_220 || 22;
    case 240:
      return produto.taxa_adm_240 || 25;
    default:
      return 25;
  }
}

/**
 * Calcula a composição detalhada da parcela
 */
export function calcularParcela(
  valorCredito: number,
  prazo: PrazoParcelas,
  produto: ConsorcioProduto,
  condicao: CondicaoPagamento,
  incluiSeguro: boolean
): CalculoParcela {
  // Ajustar crédito base pela condição de pagamento
  let creditoBase: number;
  switch (condicao) {
    case '50':
      creditoBase = valorCredito * 0.5;
      break;
    case '25':
      creditoBase = valorCredito * 0.75;
      break;
    default:
      creditoBase = valorCredito;
  }

  // Calcular componentes
  const fundoComum = creditoBase / prazo;
  const taxaAdmPercentual = getTaxaAdm(produto, prazo);
  const taxaAdm = (valorCredito * (taxaAdmPercentual / 100)) / prazo;
  const fundoReserva = (valorCredito * (produto.fundo_reserva / 100)) / prazo;

  // Seguro de vida (aplicado sobre crédito + taxa adm total)
  let seguroVida = 0;
  if (incluiSeguro) {
    const baseSeguro = valorCredito + (valorCredito * (taxaAdmPercentual / 100));
    seguroVida = baseSeguro * (produto.seguro_vida_percentual / 100);
  }

  // Parcela base (sem taxa antecipada)
  const parcelaBase = fundoComum + taxaAdm + fundoReserva + seguroVida;

  // Taxa antecipada
  const taxaAntecipada = valorCredito * (produto.taxa_antecipada_percentual / 100);

  // Calcular parcelas conforme tipo de taxa
  let parcela1a12: number;
  let parcelaDemais: number;

  if (produto.taxa_antecipada_tipo === 'dividida_12') {
    // Taxa dividida nas 12 primeiras parcelas
    parcela1a12 = parcelaBase + (taxaAntecipada / 12);
    parcelaDemais = parcelaBase;
  } else {
    // Taxa na primeira parcela (primeira_parcela)
    // Nas outras 11 primeiras, parcela normal
    parcela1a12 = parcelaBase;
    parcelaDemais = parcelaBase;
  }

  // Total pago ao longo do plano
  const totalPago = (parcela1a12 * 12) + (parcelaDemais * (prazo - 12)) + 
    (produto.taxa_antecipada_tipo === 'primeira_parcela' ? taxaAntecipada : 0);

  return {
    fundoComum,
    taxaAdm,
    fundoReserva,
    seguroVida,
    taxaAntecipada,
    parcela1a12,
    parcelaDemais,
    totalPago,
  };
}

/**
 * Busca valores pré-calculados da tabela de créditos
 */
export function getValoresTabelados(
  credito: ConsorcioCredito | undefined,
  prazo: PrazoParcelas,
  condicao: CondicaoPagamento
): { parcela1a12: number | undefined; parcelaDemais: number | undefined } {
  if (!credito) {
    return { parcela1a12: undefined, parcelaDemais: undefined };
  }

  const prazoSuffix = prazo.toString();
  let condicaoSuffix: string;
  
  switch (condicao) {
    case '50':
      condicaoSuffix = '50';
      break;
    case '25':
      condicaoSuffix = '25';
      break;
    default:
      condicaoSuffix = 'conv';
  }

  const key1a12 = `parcela_1a_12a_${condicaoSuffix}_${prazoSuffix}` as keyof ConsorcioCredito;
  const keyDemais = `parcela_demais_${condicaoSuffix}_${prazoSuffix}` as keyof ConsorcioCredito;

  return {
    parcela1a12: credito[key1a12] as number | undefined,
    parcelaDemais: credito[keyDemais] as number | undefined,
  };
}

/**
 * Formata valor monetário para exibição
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

/**
 * Encontra o produto adequado para o valor de crédito
 */
export function findProdutoForCredito(
  produtos: ConsorcioProduto[],
  valorCredito: number,
  tipoTaxa: 'dividida_12' | 'primeira_parcela' | null = null
): ConsorcioProduto | undefined {
  return produtos.find(p => 
    p.ativo &&
    valorCredito >= p.faixa_credito_min &&
    valorCredito <= p.faixa_credito_max &&
    (tipoTaxa === null || p.taxa_antecipada_tipo === tipoTaxa)
  );
}
