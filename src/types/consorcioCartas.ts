/**
 * Cartas de uma proposta de consórcio (1 proposta → N cartas).
 *
 * A tabela `consorcio_proposal_cartas` é a verdade por carta. Os campos
 * `valor_credito` / `prazo_meses` / `tipo_produto` de `consorcio_proposals`
 * seguem existindo como agregado legado, sincronizados por trigger no banco.
 */
export interface PropostaCarta {
  id: string;
  proposal_id: string;
  ordem: number;
  valor_credito: number;
  prazo_meses: number;
  tipo_produto: string;
  /** Intenção: quais das 12 primeiras parcelas a MCF pretende pagar. */
  parcelas_mcf?: number[] | null;
  /** Dados do plano — propriedade da CARTA (uma de 150k ≠ uma de 200k). */
  parcela_1a_12a?: number | null;
  parcela_demais?: number | null;
  condicao_pagamento?: string | null;
  objetivo?: string | null;
  pending_registration_id: string | null;
  consortium_card_id: string | null;
}

/** Payload de gravação de uma carta (sem id quando é nova). */
export interface PropostaCartaInput {
  id?: string;
  valor_credito: number;
  prazo_meses: number;
  tipo_produto: string;
  parcelas_mcf?: number[];
  /** Dados do plano por carta — opcionais (podem ser completados depois). */
  parcela_1a_12a?: number | null;
  parcela_demais?: number | null;
  condicao_pagamento?: string | null;
  objetivo?: string | null;
}

/** Linha em edição no formulário (valor em string por causa da máscara BRL). */
export interface PropostaCartaDraft {
  key: string;
  id?: string;
  valorStr: string;
  prazoMeses: string;
  prazoOutro: boolean;
  tipoProduto: string;
  /** Marcação das 12 primeiras parcelas que a MCF paga (intenção do closer). */
  parcelasMcf: number[];
  /** Dados do plano da carta (opcionais). */
  parcela1a12Str: string;
  parcelaDemaisStr: string;
  condicaoPagamento: string;
  objetivo: string;
  /** Carta já vinculada a cadastro/cota: não pode ser removida. */
  travada?: boolean;
}


export const MAX_CARTAS_POR_PROPOSTA = 50;

/** Quantidade de parcelas marcáveis no lançamento da venda (as 12 primeiras). */
export const PARCELAS_MARCAVEIS = 12;

export function novaCartaDraft(base?: Partial<PropostaCartaDraft>): PropostaCartaDraft {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    valorStr: '',
    prazoMeses: '',
    prazoOutro: false,
    tipoProduto: '',
    parcelasMcf: [],
    parcela1a12Str: '',
    parcelaDemaisStr: '',
    condicaoPagamento: '',
    objetivo: '',
    ...base,
    id: undefined,
    travada: false,
  };
}

export function cartaDraftValida(c: PropostaCartaDraft): boolean {
  const digits = c.valorStr.replace(/\D/g, '');
  const valor = digits ? Number(digits) / 100 : 0;
  return valor > 0 && Number(c.prazoMeses) > 0 && !!c.tipoProduto.trim();
}

/** Parcela é opcional no lançamento — sem ela o cadastro nasce incompleto. */
export function cartaSemParcela(c: PropostaCartaDraft): boolean {
  return !(brlParaNumero(c.parcela1a12Str) > 0);
}

function brlParaNumero(s: string): number {
  const digits = String(s || '').replace(/\D/g, '');
  return digits ? Number(digits) / 100 : 0;
}

export function totalCartas(cartas: PropostaCartaDraft[]): number {
  return cartas.reduce((acc, c) => {
    const digits = c.valorStr.replace(/\D/g, '');
    return acc + (digits ? Number(digits) / 100 : 0);
  }, 0);
}

export function draftsParaInput(cartas: PropostaCartaDraft[]): PropostaCartaInput[] {
  return cartas.map(c => {
    const digits = c.valorStr.replace(/\D/g, '');
    return {
      id: c.id,
      valor_credito: digits ? Number(digits) / 100 : 0,
      prazo_meses: Number(c.prazoMeses),
      tipo_produto: c.tipoProduto,
      parcelas_mcf: normalizarParcelasMcf(c.parcelasMcf),
      parcela_1a_12a: brlParaNumero(c.parcela1a12Str) || null,
      parcela_demais: brlParaNumero(c.parcelaDemaisStr) || null,
      condicao_pagamento: c.condicaoPagamento || null,
      objetivo: c.objetivo || null,
    };
  });
}


/** Ordena, tira repetidos e mantém só números dentro das 12 primeiras parcelas. */
export function normalizarParcelasMcf(parcelas: number[] | null | undefined): number[] {
  return Array.from(new Set((parcelas || []).map(Number)))
    .filter(n => Number.isInteger(n) && n >= 1 && n <= PARCELAS_MARCAVEIS)
    .sort((a, b) => a - b);
}

export interface ParcelasEmpresaDerivadas {
  empresa_paga_parcelas: 'sim' | 'nao';
  tipo_contrato: 'normal' | 'intercalado' | 'intercalado_impar';
  parcelas_pagas_empresa: number;
}

/**
 * Traduz a marcação nova (array de parcelas) para os campos antigos que o resto
 * do sistema já lê (`empresa_paga_parcelas`, `tipo_contrato`,
 * `parcelas_pagas_empresa`), para nada que dependa deles quebrar.
 */
export function derivarParcelasEmpresa(parcelas: number[] | null | undefined): ParcelasEmpresaDerivadas {
  const uniq = normalizarParcelasMcf(parcelas);
  if (uniq.length === 0) {
    return { empresa_paga_parcelas: 'nao', tipo_contrato: 'normal', parcelas_pagas_empresa: 0 };
  }
  const contiguo = uniq.every((n, i) => n === i + 1);
  const soPares = uniq.every(n => n % 2 === 0);
  const soImpares = uniq.every(n => n % 2 === 1);
  const tipo_contrato = contiguo
    ? 'normal'
    : soPares
      ? 'intercalado'
      : soImpares
        ? 'intercalado_impar'
        : 'normal';
  return { empresa_paga_parcelas: 'sim', tipo_contrato, parcelas_pagas_empresa: uniq.length };
}
