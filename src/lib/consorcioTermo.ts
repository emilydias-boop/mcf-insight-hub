import { getParcelasEmpresa } from '@/lib/consorcioParcelasEmpresa';
import { formatCurrency } from '@/lib/consorcioCalculos';

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
  { key: 'parcelas_mcf_qtd', label: 'Qtd. de parcelas pagas pela MCF' },
  { key: 'parcelas_mcf_lista', label: 'Lista das parcelas da MCF' },
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

export function validarDadosTermo(reg: TermoSourceRegistration): TermoFaltando[] {
  const faltando: TermoFaltando[] = [];
  if (!termoNomeCliente(reg)) faltando.push({ campo: 'nome', label: 'Nome / razão social do cliente' });
  if (!termoDocumentoCliente(reg)) faltando.push({ campo: 'documento', label: 'CPF / CNPJ do cliente' });
  if (!Number(reg.valor_credito)) faltando.push({ campo: 'valor_credito', label: 'Valor do crédito' });
  if (!Number(reg.prazo_meses)) faltando.push({ campo: 'prazo_meses', label: 'Prazo (meses)' });
  if (!Number(reg.parcela_1a_12a)) faltando.push({ campo: 'parcela_1a_12a', label: 'Valor da parcela (1ª à 12ª)' });
  if (!Number(reg.parcela_demais)) faltando.push({ campo: 'parcela_demais', label: 'Valor das demais parcelas' });
  if (!Number(reg.dia_vencimento)) faltando.push({ campo: 'dia_vencimento', label: 'Dia de vencimento' });
  return faltando;
}

export function montarDadosTermo(reg: TermoSourceRegistration, emissao = new Date()): TermoDados {
  const parcelas = parcelasMcfComValoresDigitados(reg);
  const total = parcelas.reduce((s, p) => s + p.valor, 0);
  const lista = parcelas.length
    ? parcelas.map((p) => `- Parcela ${p.numero} — ${formatCurrency(p.valor)}`).join('\n')
    : '- Nenhuma parcela sob responsabilidade da MCF Capital';

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
    dia_vencimento: String(reg.dia_vencimento || '—'),
    parcelas_mcf_qtd: String(parcelas.length),
    parcelas_mcf_lista: lista,
    parcelas_mcf_total: formatCurrency(total),
    tipo_contrato: TIPO_CONTRATO_LABELS[String(reg.tipo_contrato)] || 'Normal',
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

export const DADOS_EXEMPLO_TERMO: TermoDados = montarDadosTermo({
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
});

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

/** Gera e baixa o PDF do termo a partir do conteúdo renderizado + certificado. */
export async function baixarTermoPdf(opts: {
  conteudo: string;
  clienteNome: string;
  certificado?: TermoCertificado | null;
}) {
  const { loadJsPDF } = await import('@/lib/lazyExport');
  const { jsPDF } = await loadJsPDF();
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const margin = 56;
  const width = doc.internal.pageSize.getWidth() - margin * 2;
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = margin;

  const ensure = (h: number) => {
    if (y + h > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const writeLines = (text: string, size: number, style: 'normal' | 'bold', gap = 6) => {
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(text, width) as string[];
    for (const line of lines) {
      ensure(size + 4);
      doc.text(line, margin, y);
      y += size + 4;
    }
    y += gap;
  };

  for (const rawLine of opts.conteudo.split('\n')) {
    const line = rawLine.trimEnd();
    if (!line.trim()) {
      y += 6;
      continue;
    }
    if (line.startsWith('# ')) {
      writeLines(line.slice(2), 15, 'bold', 10);
    } else if (line.startsWith('## ')) {
      writeLines(line.slice(3), 12, 'bold', 6);
    } else if (line.startsWith('### ')) {
      writeLines(line.slice(4), 11, 'bold', 4);
    } else {
      const clean = line.replace(/\*\*/g, '');
      writeLines(clean, 10, 'normal', 2);
    }
  }

  const cert = opts.certificado;
  if (cert?.assinado_em) {
    y += 10;
    ensure(120);
    doc.setDrawColor(180);
    doc.line(margin, y, margin + width, y);
    y += 18;
    writeLines('CERTIFICADO DE ASSINATURA ELETRÔNICA', 11, 'bold', 6);
    const dataBr = new Date(cert.assinado_em).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    writeLines(`Assinante: ${cert.assinante_nome || '—'}`, 9, 'normal', 1);
    writeLines(`CPF: ${cert.assinante_cpf || '—'}`, 9, 'normal', 1);
    writeLines(`Data e hora (Brasília): ${dataBr}`, 9, 'normal', 1);
    writeLines(`Endereço IP: ${cert.assinante_ip || '—'}`, 9, 'normal', 1);
    writeLines(`Hash SHA-256 do conteúdo: ${cert.conteudo_hash || '—'}`, 9, 'normal', 1);
    writeLines(
      'Assinatura eletrônica válida nos termos da MP nº 2.200-2/2001 e da Lei nº 14.063/2020.',
      8,
      'normal',
      0,
    );
  }

  const dataArq = new Date().toISOString().slice(0, 10);
  doc.save(`termo-adesao-${slugify(opts.clienteNome)}-${dataArq}.pdf`);
}
