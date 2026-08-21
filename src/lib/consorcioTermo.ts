import { createElement } from 'react';
import { getParcelasEmpresa } from '@/lib/consorcioParcelasEmpresa';
import { formatCurrency } from '@/lib/consorcioCalculos';
import { abrirJanelaImpressao, escreverImpressao, escapeHtml } from '@/lib/documentoPapel';

/** Administradora do consórcio — usada no placeholder {{administradora}}. */
export const ADMINISTRADORA_CONSORCIO = 'Embracon Administradora de Consórcio Ltda';

export const TERMO_PLACEHOLDERS = [
  { key: 'cliente_nome', label: 'Nome / Razão social' },
  { key: 'cliente_documento', label: 'CPF / CNPJ' },
  { key: 'cliente_telefone', label: 'Telefone' },
  { key: 'cliente_email', label: 'E-mail' },
  { key: 'cliente_endereco', label: 'Endereço' },
  { key: 'administradora', label: 'Administradora' },
  { key: 'produto', label: 'Produto' },
  { key: 'objetivo', label: 'Objetivo do crédito' },
  { key: 'valor_credito', label: 'Valor do crédito' },
  { key: 'prazo', label: 'Prazo (meses)' },
  { key: 'condicao_pagamento', label: 'Condição de pagamento' },
  { key: 'parcela_1a_12a', label: 'Parcela 1ª à 12ª' },
  { key: 'parcela_demais', label: 'Demais parcelas' },
  { key: 'dia_vencimento', label: 'Dia de vencimento' },
  { key: 'qtd_cartas', label: 'Quantidade de cartas' },
  { key: 'cartas_tabela', label: 'Tabela das cartas da venda' },
  { key: 'parcelas_mcf_qtd', label: 'Qtd. de parcelas pagas pela MCF' },
  { key: 'parcelas_mcf_lista', label: 'Tabela das parcelas da MCF' },
  { key: 'parcelas_mcf_total', label: 'Total pago pela MCF' },
  { key: 'tipo_contrato', label: 'Tipo de contrato' },
  { key: 'data_emissao', label: 'Data de emissão' },
] as const;


export type TermoPlaceholderKey = (typeof TERMO_PLACEHOLDERS)[number]['key'];
export type TermoDados = Record<string, string>;

export interface TermoSourceRegistration {
  tipo_pessoa?: string | null;
  nome_completo?: string | null;
  razao_social?: string | null;
  cpf?: string | null;
  cnpj?: string | null;
  telefone?: string | null;
  telefone_comercial?: string | null;
  email?: string | null;
  email_comercial?: string | null;
  endereco_completo?: string | null;
  endereco_comercial?: string | null;
  valor_credito?: number | null;
  prazo_meses?: number | null;
  tipo_produto?: string | null;
  produto_codigo?: string | null;
  objetivo?: string | null;
  condicao_pagamento?: string | null;
  parcela_1a_12a?: number | null;
  parcela_demais?: number | null;
  dia_vencimento?: number | null;
  tipo_contrato?: string | null;
  parcelas_pagas_empresa?: number | null;
  empresa_paga_parcelas?: string | null;
}

export function termoNomeCliente(reg: TermoSourceRegistration): string {
  return (reg.tipo_pessoa === 'pj' ? reg.razao_social : reg.nome_completo) || reg.nome_completo || reg.razao_social || '';
}

export function termoDocumentoCliente(reg: TermoSourceRegistration): string {
  return (reg.tipo_pessoa === 'pj' ? reg.cnpj : reg.cpf) || reg.cpf || reg.cnpj || '';
}

const CONDICAO_LABELS: Record<string, string> = {
  convencional: 'Convencional',
  '50': 'Mais por Menos 50%',
  '25': 'Mais por Menos 25%',
};

const TIPO_CONTRATO_LABELS: Record<string, string> = {
  normal: 'Normal',
  intercalado: 'Intercalado par',
  intercalado_impar: 'Intercalado ímpar',
};

/**
 * Parcelas cobertas pela MCF, com o VALOR DIGITADO da parcela
 * (1ª à 12ª x demais) em vez de crédito ÷ prazo.
 */
export function parcelasMcfComValoresDigitados(reg: TermoSourceRegistration) {
  const base = getParcelasEmpresa({
    prazo_meses: reg.prazo_meses,
    parcelas_pagas_empresa: reg.parcelas_pagas_empresa,
    tipo_contrato: reg.tipo_contrato,
    valor_credito: reg.valor_credito,
    empresa_paga_parcelas: reg.empresa_paga_parcelas,
  });
  const p12 = Number(reg.parcela_1a_12a || 0);
  const pDemais = Number(reg.parcela_demais || 0);
  return base.map((p) => ({
    numero: p.numero,
    valor: p.numero <= 12 ? p12 : pDemais,
  }));
}

export interface TermoFaltando {
  campo: string;
  label: string;
}

/**
 * Tabela markdown das parcelas cobertas pela MCF (Parcela · Vencimento · Valor ·
 * Responsável), com linha de total. Substitui a antiga lista de bolinhas —
 * afeta apenas documentos novos.
 */
export function montarTabelaParcelasMcf(
  parcelas: { numero: number; valor: number }[],
  total: number,
  diaVencimento?: number | null,
): string {
  if (!parcelas.length) return 'Nenhuma parcela sob responsabilidade da MCF Capital.';
  const venc = Number(diaVencimento) ? `dia ${Number(diaVencimento)}` : 'A definir';
  const linhas = [
    '| Parcela | Vencimento | Valor | Responsável |',
    '| --- | --- | --- | --- |',
    ...parcelas.map((p) => `| ${p.numero}ª | ${venc} | ${formatCurrency(p.valor)} | MCF Capital |`),
    `| **Total** | | **${formatCurrency(total)}** | |`,
  ];
  return linhas.join('\n');
}

export function validarDadosTermo(reg: TermoSourceRegistration): TermoFaltando[] {
  const faltando: TermoFaltando[] = [];
  if (!termoNomeCliente(reg)) faltando.push({ campo: 'nome', label: 'Nome / razão social do cliente' });
  if (!termoDocumentoCliente(reg)) faltando.push({ campo: 'documento', label: 'CPF / CNPJ do cliente' });
  if (!Number(reg.valor_credito)) faltando.push({ campo: 'valor_credito', label: 'Valor do crédito' });
  if (!Number(reg.prazo_meses)) faltando.push({ campo: 'prazo_meses', label: 'Prazo (meses)' });
  if (!Number(reg.parcela_1a_12a)) faltando.push({ campo: 'parcela_1a_12a', label: 'Valor da parcela (1ª à 12ª)' });
  if (!Number(reg.parcela_demais)) faltando.push({ campo: 'parcela_demais', label: 'Valor das demais parcelas' });
  return faltando;
}

export function montarDadosTermo(reg: TermoSourceRegistration, emissao = new Date()): TermoDados {
  const parcelas = parcelasMcfComValoresDigitados(reg);
  const total = parcelas.reduce((s, p) => s + p.valor, 0);
  const lista = montarTabelaParcelasMcf(parcelas, total, reg.dia_vencimento);

  const isPj = reg.tipo_pessoa === 'pj';
  return {
    cliente_nome: termoNomeCliente(reg) || '—',
    cliente_documento: termoDocumentoCliente(reg) || '—',
    cliente_telefone: (isPj ? reg.telefone_comercial : reg.telefone) || reg.telefone || '—',
    cliente_email: (isPj ? reg.email_comercial : reg.email) || reg.email || '—',
    cliente_endereco: (isPj ? reg.endereco_comercial : reg.endereco_completo) || reg.endereco_completo || '—',
    administradora: ADMINISTRADORA_CONSORCIO,
    produto: reg.produto_codigo || reg.tipo_produto || '—',
    objetivo: reg.objetivo === 'imovel' ? 'Imóvel' : reg.objetivo === 'auto' ? 'Automóvel' : '—',
    valor_credito: formatCurrency(Number(reg.valor_credito || 0)),
    prazo: String(reg.prazo_meses || '—'),
    condicao_pagamento: CONDICAO_LABELS[String(reg.condicao_pagamento)] || reg.condicao_pagamento || '—',
    parcela_1a_12a: formatCurrency(Number(reg.parcela_1a_12a || 0)),
    parcela_demais: formatCurrency(Number(reg.parcela_demais || 0)),
    // O dia é definido pela Embracon depois da abertura da cota.
    dia_vencimento: Number(reg.dia_vencimento) ? String(reg.dia_vencimento) : 'A definir',
    parcelas_mcf_qtd: String(parcelas.length),
    parcelas_mcf_lista: lista,
    parcelas_mcf_total: formatCurrency(total),
    tipo_contrato: TIPO_CONTRATO_LABELS[String(reg.tipo_contrato)] || 'Normal',
    data_emissao: emissao.toLocaleDateString('pt-BR'),
  };
}

// ── Termo por VENDA (1 termo cobrindo N cartas) ───────────────────────────
// Regra do dono: o termo é da proposta, não do cadastro. Onde as cartas
// divergem, o documento diz "ver tabela" — nunca escolhe um valor em silêncio.

export interface TermoFaltandoCarta extends TermoFaltando {
  /** 1-based. `0` = problema do cliente (comum a todas as cartas). */
  carta: number;
  totalCartas: number;
}

/** Divergência de identidade entre cadastros — bloqueia a geração. */
export function divergenciasIdentidade(regs: TermoSourceRegistration[]): string[] {
  if (regs.length < 2) return [];
  const out: string[] = [];
  const docs = new Set(regs.map(r => onlyDigits(termoDocumentoCliente(r))).filter(Boolean));
  const nomes = new Set(regs.map(r => normalizeNome(termoNomeCliente(r))).filter(Boolean));
  if (docs.size > 1) out.push(`CPF/CNPJ diferente entre os cadastros (${docs.size} documentos distintos)`);
  if (nomes.size > 1) out.push(`Nome / razão social diferente entre os cadastros (${nomes.size} nomes distintos)`);
  return out;
}

/** Valida TODAS as cartas, dizendo qual delas está incompleta. */
export function validarDadosTermoMulti(regs: TermoSourceRegistration[]): TermoFaltandoCarta[] {
  const total = regs.length;
  if (!total) return [{ campo: 'cadastro', label: 'Nenhum cadastro da venda encontrado', carta: 0, totalCartas: 0 }];
  const faltando: TermoFaltandoCarta[] = [];
  const primeiro = regs[0];
  if (!termoNomeCliente(primeiro)) faltando.push({ campo: 'nome', label: 'Nome / razão social do cliente', carta: 0, totalCartas: total });
  if (!termoDocumentoCliente(primeiro)) faltando.push({ campo: 'documento', label: 'CPF / CNPJ do cliente', carta: 0, totalCartas: total });
  regs.forEach((reg, i) => {
    const carta = i + 1;
    const push = (campo: string, label: string) => faltando.push({ campo: `${campo}_${carta}`, label, carta, totalCartas: total });
    if (!Number(reg.valor_credito)) push('valor_credito', 'Valor do crédito');
    if (!Number(reg.prazo_meses)) push('prazo_meses', 'Prazo (meses)');
    if (!Number(reg.parcela_1a_12a)) push('parcela_1a_12a', 'Valor da parcela (1ª à 12ª)');
    if (!Number(reg.parcela_demais)) push('parcela_demais', 'Valor das demais parcelas');
  });
  return faltando;
}

/** Rótulo humano de um item faltante: "Carta 2 de 3 — valor da parcela". */
export function rotuloFaltando(f: TermoFaltandoCarta): string {
  return f.carta === 0 ? f.label : `Carta ${f.carta} de ${f.totalCartas} — ${f.label}`;
}

const VER_TABELA = 'ver tabela';

/** Mantém o valor quando todas as cartas concordam; senão "ver tabela". */
function unicoOuVerTabela(valores: string[]): string {
  const set = new Set(valores.map(v => v || '—'));
  if (set.size === 1) return [...set][0];
  return VER_TABELA;
}

function condicaoLabel(reg: TermoSourceRegistration): string {
  return CONDICAO_LABELS[String(reg.condicao_pagamento)] || reg.condicao_pagamento || '—';
}

function objetivoLabel(reg: TermoSourceRegistration): string {
  return reg.objetivo === 'imovel' ? 'Imóvel' : reg.objetivo === 'auto' ? 'Automóvel' : '—';
}

function produtoLabel(reg: TermoSourceRegistration): string {
  return reg.produto_codigo || reg.tipo_produto || '—';
}

/** Tabela markdown das cartas da venda, com linha de Total. */
export function montarTabelaCartas(regs: TermoSourceRegistration[]): string {
  const totalCredito = regs.reduce((s, r) => s + Number(r.valor_credito || 0), 0);
  const linhas = [
    '| Carta | Produto | Crédito | Prazo | Parcela 1ª–12ª | Demais |',
    '| --- | --- | --- | --- | --- | --- |',
    ...regs.map((r, i) => {
      const p12 = Number(r.parcela_1a_12a) ? formatCurrency(Number(r.parcela_1a_12a)) : '—';
      const pd = Number(r.parcela_demais) ? formatCurrency(Number(r.parcela_demais)) : '—';
      const prz = Number(r.prazo_meses) ? `${Number(r.prazo_meses)} meses` : '—';
      return `| ${i + 1} | ${produtoLabel(r)} | ${formatCurrency(Number(r.valor_credito || 0))} | ${prz} | ${p12} | ${pd} |`;
    }),
    `| **Total** | | **${formatCurrency(totalCredito)}** | | | |`,
  ];
  return linhas.join('\n');
}

/** Tabela consolidada das parcelas da MCF, com a coluna Carta. */
export function montarTabelaParcelasMcfConsolidada(
  regs: TermoSourceRegistration[],
): { tabela: string; qtd: number; total: number } {
  const itens = regs.flatMap((reg, i) =>
    parcelasMcfComValoresDigitados(reg).map(p => ({
      carta: i + 1,
      numero: p.numero,
      valor: p.valor,
      venc: Number(reg.dia_vencimento) ? `dia ${Number(reg.dia_vencimento)}` : 'A definir',
    })),
  );
  const total = itens.reduce((s, p) => s + p.valor, 0);
  if (!itens.length) {
    return { tabela: 'Nenhuma parcela sob responsabilidade da MCF Capital.', qtd: 0, total: 0 };
  }
  const linhas = [
    '| Carta | Parcela | Vencimento | Valor | Responsável |',
    '| --- | --- | --- | --- | --- |',
    ...itens.map(p => `| ${p.carta} | ${p.numero}ª | ${p.venc} | ${formatCurrency(p.valor)} | MCF Capital |`),
    `| **Total** | | | **${formatCurrency(total)}** | |`,
  ];
  return { tabela: linhas.join('\n'), qtd: itens.length, total };
}

/**
 * Dados do termo de uma VENDA inteira. Cliente vem do primeiro cadastro
 * (o aceite replica os dados em todos); crédito é a SOMA das cartas.
 */
export function montarDadosTermoMulti(
  regs: TermoSourceRegistration[],
  emissao = new Date(),
): TermoDados {
  if (regs.length === 0) return montarDadosTermo({}, emissao);
  if (regs.length === 1) {
    const base = montarDadosTermo(regs[0], emissao);
    return { ...base, qtd_cartas: '1', cartas_tabela: montarTabelaCartas(regs) };
  }

  const primeiro = regs[0];
  const isPj = primeiro.tipo_pessoa === 'pj';
  const somaCredito = regs.reduce((s, r) => s + Number(r.valor_credito || 0), 0);
  const mcf = montarTabelaParcelasMcfConsolidada(regs);

  return {
    cliente_nome: termoNomeCliente(primeiro) || '—',
    cliente_documento: termoDocumentoCliente(primeiro) || '—',
    cliente_telefone: (isPj ? primeiro.telefone_comercial : primeiro.telefone) || primeiro.telefone || '—',
    cliente_email: (isPj ? primeiro.email_comercial : primeiro.email) || primeiro.email || '—',
    cliente_endereco: (isPj ? primeiro.endereco_comercial : primeiro.endereco_completo) || primeiro.endereco_completo || '—',
    administradora: ADMINISTRADORA_CONSORCIO,
    produto: unicoOuVerTabela(regs.map(produtoLabel)),
    objetivo: unicoOuVerTabela(regs.map(objetivoLabel)),
    valor_credito: formatCurrency(somaCredito),
    prazo: unicoOuVerTabela(regs.map(r => String(r.prazo_meses || '—'))),
    condicao_pagamento: unicoOuVerTabela(regs.map(condicaoLabel)),
    parcela_1a_12a: unicoOuVerTabela(
      regs.map(r => (Number(r.parcela_1a_12a) ? formatCurrency(Number(r.parcela_1a_12a)) : '—')),
    ),
    parcela_demais: unicoOuVerTabela(
      regs.map(r => (Number(r.parcela_demais) ? formatCurrency(Number(r.parcela_demais)) : '—')),
    ),
    dia_vencimento: unicoOuVerTabela(
      regs.map(r => (Number(r.dia_vencimento) ? String(r.dia_vencimento) : 'A definir')),
    ),
    qtd_cartas: String(regs.length),
    cartas_tabela: montarTabelaCartas(regs),
    parcelas_mcf_qtd: String(mcf.qtd),
    parcelas_mcf_lista: mcf.tabela,
    parcelas_mcf_total: formatCurrency(mcf.total),
    tipo_contrato: unicoOuVerTabela(
      regs.map(r => TIPO_CONTRATO_LABELS[String(r.tipo_contrato)] || 'Normal'),
    ),
    data_emissao: emissao.toLocaleDateString('pt-BR'),
  };
}

export function renderTermo(template: string, dados: TermoDados): string {
  return template.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_m, key: string) => dados[key] ?? `{{${key}}}`);
}


export async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export const DADOS_EXEMPLO_TERMO: TermoDados = montarDadosTermoMulti([{
  tipo_pessoa: 'pf',
  nome_completo: 'Maria Aparecida de Souza',
  cpf: '123.456.789-00',
  telefone: '(11) 98888-7777',
  email: 'maria@exemplo.com.br',
  endereco_completo: 'Rua das Acácias, 120 — Jardim Paulista, São Paulo/SP',
  valor_credito: 300000,
  prazo_meses: 240,
  tipo_produto: 'select',
  produto_codigo: 'IMÓVEL SELECT',
  objetivo: 'imovel',
  condicao_pagamento: 'convencional',
  parcela_1a_12a: 1450,
  parcela_demais: 1780,
  dia_vencimento: 10,
  tipo_contrato: 'normal',
  parcelas_pagas_empresa: 3,
  empresa_paga_parcelas: 'sim',
}]);

/** Normaliza nome: sem acento, minúsculo, espaços colapsados. */
export function normalizeNome(v: string): string {
  return (v || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function onlyDigits(v: string): string {
  return (v || '').replace(/\D/g, '');
}

export function maskDocumento(doc: string): string {
  const d = onlyDigits(doc);
  if (d.length < 5) return '•••';
  return `${d.slice(0, 3)}${'•'.repeat(Math.max(0, d.length - 5))}${d.slice(-2)}`;
}

export function maskNome(nome: string): string {
  const partes = (nome || '').trim().split(/\s+/);
  if (!partes[0]) return '—';
  return partes
    .map((p, i) => (i === 0 || i === partes.length - 1 ? p : `${p[0]}.`))
    .join(' ');
}

export function slugify(v: string): string {
  return normalizeNome(v).replace(/\s+/g, '-').slice(0, 60) || 'cliente';
}

export interface TermoCertificado {
  assinante_nome?: string | null;
  assinante_cpf?: string | null;
  assinado_em?: string | null;
  assinante_ip?: string | null;
  conteudo_hash?: string | null;
}

export interface CertificadoHtmlParte {
  label: string;
  valor: string;
}

/** Bloco `.cert` do certificado de assinatura eletrônica, em HTML seguro. */
export function certificadoHtml(cert: TermoCertificado): string {
  const dataBr = cert.assinado_em
    ? new Date(cert.assinado_em).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    : '—';
  const pares: CertificadoHtmlParte[] = [
    { label: 'Signatário', valor: cert.assinante_nome || '—' },
    { label: 'CPF', valor: cert.assinante_cpf || '—' },
    { label: 'Data e hora (Brasília)', valor: dataBr },
    { label: 'Endereço IP', valor: cert.assinante_ip || '—' },
  ];
  return `<div class="cert">
  <h3>Certificado de assinatura eletrônica</h3>
  <div class="kv">${pares
    .map((p) => `<div><b>${escapeHtml(p.label)}</b><span>${escapeHtml(p.valor)}</span></div>`)
    .join('')}</div>
  <div class="hashline">Hash SHA-256 do conteúdo assinado: ${escapeHtml(cert.conteudo_hash || '—')}</div>
  <p class="legal">Assinatura eletrônica válida nos termos da Medida Provisória nº 2.200-2/2001 e da Lei nº 14.063/2020.
  Ficam registrados nome, documento, data, hora, endereço IP e o resumo criptográfico do conteúdo lido pelo signatário.</p>
</div>`;
}

/**
 * Abre a janela de impressão do documento com o MESMO desenho da tela
 * (o markdown passa pelo `TermoMarkdown`, então nada divergir do papel).
 *
 * IMPORTANTE (iOS/Safari): a janela é aberta de forma **síncrona**, ainda dentro
 * do gesto do clique, ANTES dos imports dinâmicos. Só depois o conteúdo é
 * escrito nela. Se os imports falharem, a janela é fechada.
 * O resultado distingue bloqueio de popup de falha ao carregar/renderizar.
 */
export type ImprimirDocumentoResultado = 'ok' | 'popup' | 'erro';

export async function imprimirDocumento(opts: {
  conteudo: string;
  clienteNome: string;
  /** Rótulo do documento — vira o nome sugerido do arquivo. */
  tituloDocumento?: string;
  certificado?: TermoCertificado | null;
  canceladoStamp?: { data: string; motivo: string } | null;
}): Promise<ImprimirDocumentoResultado> {
  const win = abrirJanelaImpressao();
  if (!win) return 'popup';

  let corpoMarkdown: string;
  try {
    const [{ renderToStaticMarkup }, { TermoMarkdown }] = await Promise.all([
      import('react-dom/server'),
      import('@/components/consorcio/TermoMarkdown'),
    ]);
    // `bare`: a janela já cria o wrapper `.papel` — sem aninhar papel em papel.
    corpoMarkdown = renderToStaticMarkup(
      createElement(TermoMarkdown, { content: opts.conteudo, bare: true }),
    );
  } catch {
    win.close();
    return 'erro';
  }

  const cert = opts.certificado?.assinado_em ? certificadoHtml(opts.certificado) : '';

  let avisoTopo: string | null = null;
  if (opts.canceladoStamp) {
    const dataBr = new Date(opts.canceladoStamp.data).toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
    });
    avisoTopo = `Documento cancelado em ${dataBr}${
      opts.canceladoStamp.motivo ? ` — ${opts.canceladoStamp.motivo}` : ''
    }`;
  }

  const doc = opts.tituloDocumento || 'Termo de Adesão';
  escreverImpressao(win, {
    titulo: `${doc} — ${opts.clienteNome || 'Cliente'} — ${new Date().toLocaleDateString('pt-BR')}`,
    corpoHtml: `${corpoMarkdown}${cert}`,
    avisoTopo,
  });
  return 'ok';
}
