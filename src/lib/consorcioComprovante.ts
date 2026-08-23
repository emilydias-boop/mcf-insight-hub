/**
 * Comprovante de Cadastro na Embracon (Fase 2).
 * Reaproveita a infraestrutura do Termo de Adesão: mesmos `renderTermo`,
 * `sha256Hex`, tabela `consorcio_termos` e rota pública `/termo/:token`.
 */
import { formatCurrency } from '@/lib/consorcioCalculos';
import { ADMINISTRADORA_CONSORCIO, type TermoDados, type TermoFaltando } from '@/lib/consorcioTermo';

export const COMPROVANTE_PLACEHOLDERS = [
  { key: 'cliente_nome', label: 'Nome / Razão social' },
  { key: 'cliente_documento', label: 'CPF / CNPJ' },
  { key: 'cliente_telefone', label: 'Telefone' },
  { key: 'cliente_email', label: 'E-mail' },
  { key: 'cliente_endereco', label: 'Endereço' },
  { key: 'administradora', label: 'Administradora' },
  { key: 'produto', label: 'Produto' },
  { key: 'objetivo', label: 'Objetivo do crédito' },
  { key: 'grupo', label: 'Grupo' },
  { key: 'cota', label: 'Cota' },
  { key: 'contrato_embracon', label: 'Contrato Embracon' },
  { key: 'valor_credito', label: 'Valor do crédito' },
  { key: 'prazo', label: 'Prazo (meses)' },
  { key: 'condicao_pagamento', label: 'Condição de pagamento' },
  { key: 'dia_vencimento', label: 'Dia de vencimento' },
  { key: 'cronograma_12', label: 'Cronograma das primeiras parcelas' },
  { key: 'cronograma_qtd', label: 'Qtd. de parcelas no cronograma' },
  { key: 'parcelas_mcf_qtd', label: 'Qtd. de parcelas da MCF (no cronograma)' },
  { key: 'parcelas_mcf_total', label: 'Total pago pela MCF (no cronograma)' },
  { key: 'parcelas_cliente_qtd', label: 'Qtd. de parcelas do cliente (no cronograma)' },
  { key: 'data_emissao', label: 'Data de emissão' },
] as const;

export type ComprovantePlaceholderKey = (typeof COMPROVANTE_PLACEHOLDERS)[number]['key'];

/** Card de consórcio — só o que o comprovante usa. */
export interface ComprovanteSourceCard {
  id?: string;
  tipo_pessoa?: string | null;
  nome_completo?: string | null;
  razao_social?: string | null;
  cpf?: string | null;
  cnpj?: string | null;
  telefone?: string | null;
  telefone_comercial?: string | null;
  email?: string | null;
  email_comercial?: string | null;
  endereco_rua?: string | null;
  endereco_numero?: string | null;
  endereco_bairro?: string | null;
  endereco_cidade?: string | null;
  endereco_estado?: string | null;
  endereco_comercial_rua?: string | null;
  endereco_comercial_numero?: string | null;
  endereco_comercial_bairro?: string | null;
  endereco_comercial_cidade?: string | null;
  endereco_comercial_estado?: string | null;
  grupo?: string | null;
  cota?: string | null;
  contrato_embracon?: string | null;
  valor_credito?: number | null;
  prazo_meses?: number | null;
  condicao_pagamento?: string | null;
  dia_vencimento?: number | null;
  parcela_1a_12a?: number | null;
  parcela_demais?: number | null;
  produto_embracon?: string | null;
  tipo_produto?: string | null;
  objetivo?: string | null;
}

/** Linha do cronograma conferida pelo operador antes de emitir. */
export interface ComprovanteParcela {
  numero_parcela: number;
  data_vencimento: string | null;
  /** 'empresa' = MCF Capital paga · 'cliente' = cliente paga. */
  tipo: 'empresa' | 'cliente';
  /** Valor conferido pelo operador. Sem valor, cai no `parcela_1a_12a` do card. */
  valor?: number | null;
}

/** Quantas parcelas o cronograma do comprovante mostra: min(12, prazo). */
export function qtdParcelasCronograma(card: ComprovanteSourceCard): number {
  const prazo = Number(card.prazo_meses || 0);
  return prazo > 0 ? Math.min(12, prazo) : 12;
}

const CONDICAO_LABELS: Record<string, string> = {
  convencional: 'Convencional',
  '50': 'Mais por Menos 50%',
  '25': 'Mais por Menos 25%',
};

/**
 * Produto do comprovante = o mesmo que a cota exibe na tela (`tipo_produto`:
 * Parcelinha / Select). `produto_embracon` guarda o código/categoria da
 * administradora (ex.: "auto") e por isso não serve como nome do produto.
 */
const PRODUTO_LABELS: Record<string, string> = {
  parcelinha: 'Parcelinha',
  select: 'Select',
};

export function comprovanteProdutoLabel(card: ComprovanteSourceCard): string {
  const tipo = String(card.tipo_produto || '').toLowerCase();
  return PRODUTO_LABELS[tipo] || card.tipo_produto || '—';
}


export function comprovanteNomeCliente(card: ComprovanteSourceCard): string {
  return (card.tipo_pessoa === 'pj' ? card.razao_social : card.nome_completo)
    || card.nome_completo || card.razao_social || '';
}

export function comprovanteDocumentoCliente(card: ComprovanteSourceCard): string {
  return (card.tipo_pessoa === 'pj' ? card.cnpj : card.cpf) || card.cpf || card.cnpj || '';
}

/** Telefone de contato conforme PF/PJ. Vazio quando não há dado. */
export function comprovanteTelefoneCliente(card: ComprovanteSourceCard): string {
  return (card.tipo_pessoa === 'pj' ? card.telefone_comercial : card.telefone)
    || card.telefone || card.telefone_comercial || '';
}

/** E-mail de contato conforme PF/PJ. Vazio quando não há dado. */
export function comprovanteEmailCliente(card: ComprovanteSourceCard): string {
  return (card.tipo_pessoa === 'pj' ? card.email_comercial : card.email)
    || card.email || card.email_comercial || '';
}

function enderecoCliente(card: ComprovanteSourceCard): string {
  const pj = card.tipo_pessoa === 'pj';
  const rua = (pj ? card.endereco_comercial_rua : card.endereco_rua) || card.endereco_rua;
  const numero = (pj ? card.endereco_comercial_numero : card.endereco_numero) || card.endereco_numero;
  const bairro = (pj ? card.endereco_comercial_bairro : card.endereco_bairro) || card.endereco_bairro;
  const cidade = (pj ? card.endereco_comercial_cidade : card.endereco_cidade) || card.endereco_cidade;
  const uf = (pj ? card.endereco_comercial_estado : card.endereco_estado) || card.endereco_estado;
  const linha1 = [rua, numero].filter(Boolean).join(', ');
  const linha2 = [bairro, [cidade, uf].filter(Boolean).join('/')].filter(Boolean).join(' — ');
  return [linha1, linha2].filter(Boolean).join(' — ') || '—';
}

/** dd/MM/yyyy sem deslocamento de fuso (data vem como 'yyyy-MM-dd'). */
function formatDataVencimento(v: string | null): string {
  if (!v) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  const d = new Date(v);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR');
}

/**
 * Valor da parcela: SEMPRE do card (`parcela_1a_12a` / `parcela_demais`).
 * Nunca de `consortium_installments.valor_parcela` — aquele é crédito ÷ prazo.
 */
export function valorParcelaDoCard(card: ComprovanteSourceCard, numero: number): number {
  return Number((numero <= 12 ? card.parcela_1a_12a : card.parcela_demais) || 0);
}

export function validarDadosComprovante(
  card: ComprovanteSourceCard,
  parcelas: ComprovanteParcela[] = [],
): TermoFaltando[] {
  const faltando: TermoFaltando[] = [];
  if (!comprovanteNomeCliente(card)) faltando.push({ campo: 'nome', label: 'Nome / razão social do cliente' });
  if (!comprovanteDocumentoCliente(card)) faltando.push({ campo: 'documento', label: 'CPF / CNPJ do cliente' });
  if (!String(card.grupo || '').trim()) faltando.push({ campo: 'grupo', label: 'Grupo' });
  if (!String(card.cota || '').trim()) faltando.push({ campo: 'cota', label: 'Cota' });
  if (!Number(card.valor_credito)) faltando.push({ campo: 'valor_credito', label: 'Valor do crédito' });
  if (!Number(card.prazo_meses)) faltando.push({ campo: 'prazo_meses', label: 'Prazo (meses)' });
  if (!Number(card.parcela_1a_12a)) faltando.push({ campo: 'parcela_1a_12a', label: 'Valor da parcela (1ª à 12ª)' });
  if (!Number(card.dia_vencimento)) faltando.push({ campo: 'dia_vencimento', label: 'Dia de vencimento' });
  if (!String(card.contrato_embracon || '').trim()) {
    faltando.push({ campo: 'contrato_embracon', label: 'Número do contrato Embracon' });
  }
  const esperado = qtdParcelasCronograma(card);
  if (parcelas.filter((p) => p.numero_parcela <= esperado).length < esperado) {
    faltando.push({
      campo: 'parcelas',
      label: `As ${esperado} primeiras parcelas geradas na aba Parcelas`,
    });
  }
  return faltando;
}

export function montarDadosComprovante(
  card: ComprovanteSourceCard,
  parcelas: ComprovanteParcela[],
  contratoEmbracon?: string | null,
  emissao = new Date(),
): TermoDados {
  const limite = qtdParcelasCronograma(card);
  const doze = [...parcelas]
    .filter((p) => p.numero_parcela <= limite)
    .sort((a, b) => a.numero_parcela - b.numero_parcela)
    .slice(0, limite);

  const valorDaLinha = (p: ComprovanteParcela) =>
    p.valor != null && Number.isFinite(Number(p.valor))
      ? Number(p.valor)
      : valorParcelaDoCard(card, p.numero_parcela);

  const linhas = doze.map((p) => {
    const valor = valorDaLinha(p);
    const quem = p.tipo === 'empresa' ? 'MCF Capital' : 'Cliente';
    return `| ${p.numero_parcela} | ${formatDataVencimento(p.data_vencimento)} | ${formatCurrency(valor)} | ${quem} |`;
  });

  const cronograma = doze.length
    ? ['| Parcela | Vencimento | Valor | Quem paga |', '| --- | --- | --- | --- |', ...linhas].join('\n')
    : '_Cronograma indisponível — gere as parcelas da cota antes de emitir o comprovante._';

  const daMcf = doze.filter((p) => p.tipo === 'empresa');
  const totalMcf = daMcf.reduce((s, p) => s + valorDaLinha(p), 0);

  return {
    cliente_nome: comprovanteNomeCliente(card) || '—',
    cliente_documento: comprovanteDocumentoCliente(card) || '—',
    cliente_telefone: comprovanteTelefoneCliente(card) || '—',
    cliente_email: comprovanteEmailCliente(card) || '—',
    cliente_endereco: enderecoCliente(card),
    administradora: ADMINISTRADORA_CONSORCIO,
    produto: card.produto_embracon || card.tipo_produto || '—',
    objetivo: card.objetivo === 'imovel' ? 'Imóvel' : card.objetivo === 'auto' ? 'Automóvel' : '—',
    grupo: String(card.grupo || '—'),
    cota: String(card.cota || '—'),
    contrato_embracon: String(contratoEmbracon || card.contrato_embracon || '—'),
    valor_credito: formatCurrency(Number(card.valor_credito || 0)),
    prazo: String(card.prazo_meses || '—'),
    condicao_pagamento: CONDICAO_LABELS[String(card.condicao_pagamento)] || card.condicao_pagamento || '—',
    dia_vencimento: String(card.dia_vencimento || '—'),
    cronograma_12: cronograma,
    cronograma_qtd: String(doze.length || limite),
    parcelas_mcf_qtd: String(daMcf.length),
    parcelas_mcf_total: formatCurrency(totalMcf),
    parcelas_cliente_qtd: String(doze.length - daMcf.length),
    data_emissao: emissao.toLocaleDateString('pt-BR'),
  };
}

/** Dados de exemplo para a prévia do editor de modelo. */
export const DADOS_EXEMPLO_COMPROVANTE: TermoDados = montarDadosComprovante(
  {
    tipo_pessoa: 'pf',
    nome_completo: 'Maria Aparecida de Souza',
    cpf: '123.456.789-00',
    telefone: '(11) 98888-7777',
    email: 'maria@exemplo.com.br',
    endereco_rua: 'Rua das Acácias',
    endereco_numero: '120',
    endereco_bairro: 'Jardim Paulista',
    endereco_cidade: 'São Paulo',
    endereco_estado: 'SP',
    grupo: '1234',
    cota: '101',
    contrato_embracon: '000123456789',
    valor_credito: 300000,
    prazo_meses: 240,
    condicao_pagamento: 'convencional',
    dia_vencimento: 10,
    parcela_1a_12a: 1450,
    parcela_demais: 1780,
    produto_embracon: 'IMÓVEL SELECT',
    objetivo: 'imovel',
  },
  Array.from({ length: 12 }, (_, i) => ({
    numero_parcela: i + 1,
    data_vencimento: `2026-${String(((i + 8) % 12) + 1).padStart(2, '0')}-10`,
    tipo: i < 3 ? 'empresa' : 'cliente',
  })),
);
