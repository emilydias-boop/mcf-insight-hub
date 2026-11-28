import { calcularComissao } from './consorcioComissao.ts';
import { getProdutoComissaoContext } from './consorcioComissaoLookup.ts';
import { calcularProximoDiaUtil } from './consorcioDiasUteis.ts';
import { resolverParcelaOficial, valorParcelaOficial } from './consorcioParcelaOficial.ts';
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
  /**
   * Números exatos das parcelas da MCF escolhidos no lançamento. Quando vem com
   * itens, ELE manda: a derivação por `tipoContrato` + quantidade é ignorada.
   */
  parcelasNumeros?: number[] | null;

  inicioSegundaParcela?: string | null;
  /** Condição de pagamento da cota — define a coluna da tabela Embracon. */
  condicaoPagamento?: string | null;
  /** Objetivo da cota — afunila a resolução do produto (imóvel × auto × pesado). */
  objetivo?: string | null;
  /** Seguro de vida compõe a parcela quando não há linha tabelada. */
  incluiSeguro?: boolean;
  /** Reserva → parcelas nascem como 'previsto'. */
  isReserva?: boolean;
}


/** Offset em meses da 2ª parcela em relação à data base. */
export function offsetSegundaParcela(baseDate: Date, inicio?: string | null): number {
  if (inicio === 'proximo_mes') return 1;
  if (inicio === 'pular_mes') return 2;
  return baseDate.getDate() > 16 ? 2 : 1;
}

/**
 * Novas cotas geram o prazo integral. Não executa backfill de cotas existentes.
 */
export function qtdParcelasGeradas(prazoMeses: number): number {
  const prazo = Number(prazoMeses || 0);
  return Number.isInteger(prazo) && prazo > 0 ? prazo : 0;
}

/** Monta as linhas de `consortium_installments` (sem gravar). */
export async function montarParcelasCota(p: ParamsCronograma, supabase: { from: (table: string) => any }): Promise<any[]> {
  const [year, month, day] = String(p.baseDate).split('-').map(Number);
  const dataBase = new Date(year, month - 1, day);
  const offset = offsetSegundaParcela(dataBase, p.inicioSegundaParcela);

  const tipoContrato = p.tipoContrato || 'normal';
  const parcelasEmpresa = p.parcelasEmpresa || 0;
  // Lista exata escolhida no lançamento (quando existe, dispensa a derivação).
  const numerosEmpresa = new Set(
    (Array.isArray(p.parcelasNumeros) ? p.parcelasNumeros : [])
      .map(Number)
      .filter(n => Number.isInteger(n) && n >= 1),
  );

  const ctxComissao = await getProdutoComissaoContext(p.valorCredito, p.tipoProduto as any, supabase);

  // Fonte de verdade do valor da parcela: tabela Embracon (nunca crédito ÷ prazo).
  const oficial = await resolverParcelaOficial({
    valorCredito: p.valorCredito,
    prazoMeses: p.prazoMeses,
    tipoProduto: p.tipoProduto,
    condicaoPagamento: p.condicaoPagamento,
    objetivo: p.objetivo,
    incluiSeguro: p.incluiSeguro,
  }, supabase);

  const total = qtdParcelasGeradas(p.prazoMeses);
  const parcelas: any[] = [];
  for (let i = 1; i <= total; i++) {
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
    if (numerosEmpresa.size > 0) {
      tipo = numerosEmpresa.has(i) ? 'empresa' : 'cliente';
    } else if (i > 12) {
      tipo = 'cliente';
    } else if (tipoContrato === 'intercalado') {
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
      valor_parcela: oficial
        ? valorParcelaOficial(oficial, i)
        : p.valorCredito / p.prazoMeses,
      valor_comissao: valorComissao,
      data_vencimento: `${dataVencimento.getFullYear()}-${String(dataVencimento.getMonth() + 1).padStart(2, '0')}-${String(dataVencimento.getDate()).padStart(2, '0')}`,
      status: p.isReserva ? 'previsto' : 'pendente',
      valor_estimado: i >= 13 && !!oficial,
    });
  }
  return parcelas;
}

