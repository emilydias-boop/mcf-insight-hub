// Palavras-chave de interesse em Consórcio (espelha pos_venda_trechos_consorcio no banco).
export const PALAVRAS_CONSORCIO = /(carta de cr[eé]dito|cons[oó]rcio|renda passiva|loca[cç][aã]o|aluguel|alavanc|cr[eé]dito imobili[aá]rio)/gi;

export const PLACEHOLDER_JUSTIFICATIVA =
  'Informe o motivo pelo qual você está encaminhando este cliente para a BU Consórcio (interesse demonstrado, objetivo do cliente, perfil financeiro…). Esta justificativa é obrigatória.';

export interface TrechoConsorcio { reuniao_inicio: string; trecho: string }

/** Monta a nota do encaminhamento; sem trechos devolve vazio para obrigar a justificativa. */
export function notaEncaminhamentoConsorcio(trechos: TrechoConsorcio[], fmtData: (iso: string) => string): string {
  if (!trechos.length) return '';
  const linhas = trechos.map((t) => `• [${fmtData(t.reuniao_inicio)}] "${t.trecho.trim()}"`);
  return `Trechos da reunião de viabilidade que indicam interesse em Consórcio:\n${linhas.join('\n')}\n\nMotivo do encaminhamento: `;
}
