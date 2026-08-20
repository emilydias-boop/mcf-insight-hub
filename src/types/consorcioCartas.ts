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
  pending_registration_id: string | null;
  consortium_card_id: string | null;
}

/** Payload de gravação de uma carta (sem id quando é nova). */
export interface PropostaCartaInput {
  id?: string;
  valor_credito: number;
  prazo_meses: number;
  tipo_produto: string;
}

/** Linha em edição no formulário (valor em string por causa da máscara BRL). */
export interface PropostaCartaDraft {
  key: string;
  id?: string;
  valorStr: string;
  prazoMeses: string;
  prazoOutro: boolean;
  tipoProduto: string;
  /** Carta já vinculada a cadastro/cota: não pode ser removida. */
  travada?: boolean;
}

export const MAX_CARTAS_POR_PROPOSTA = 50;

export function novaCartaDraft(base?: Partial<PropostaCartaDraft>): PropostaCartaDraft {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    valorStr: '',
    prazoMeses: '',
    prazoOutro: false,
    tipoProduto: '',
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
    };
  });
}
