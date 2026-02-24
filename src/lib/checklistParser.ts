export interface ChecklistPFData {
  nome_completo: string;
  rg: string;
  cpf: string;
  cpf_conjuge: string;
  endereco_completo: string;
  endereco_cep: string;
  telefone: string;
  email: string;
  profissao: string;
  renda: number;
  patrimonio: number;
  pix: string;
}

export interface ChecklistPJData {
  razao_social: string;
  cnpj: string;
  natureza_juridica: string;
  inscricao_estadual: string;
  data_fundacao: string;
  socios_cpfs: string[];
  endereco_comercial: string;
  endereco_comercial_cep: string;
  telefone_comercial: string;
  email_comercial: string;
  faturamento_mensal: number;
  num_funcionarios: number;
  renda_socios: number;
}

function extractFromLines(lines: string[], pattern: RegExp): string {
  for (const line of lines) {
    const match = line.match(pattern);
    if (match) return match[1].trim();
  }
  return '';
}

function parseMoney(value: string): number {
  if (!value) return 0;
  return parseFloat(value.replace(/[R$\s.]/g, '').replace(',', '.')) || 0;
}

export function parseChecklistPF(text: string): Partial<ChecklistPFData> {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // For CPF, we need to match a line that has "CPF:" but NOT "Cônjuge" / "Conjuge"
  let cpf = '';
  for (const line of lines) {
    if (/cpf\s*c[oô]njuge/i.test(line)) continue;
    if (/cpf\s*dos\s*s[oó]cios/i.test(line)) continue;
    const match = line.match(/^cpf:\s*(.+)/i);
    if (match) {
      cpf = match[1].trim();
      break;
    }
  }

  const result: Partial<ChecklistPFData> = {};

  const nome = extractFromLines(lines, /nome\s*completo:\s*(.+)/i);
  if (nome) result.nome_completo = nome;

  const rg = extractFromLines(lines, /rg:\s*(.+)/i);
  if (rg) result.rg = rg;

  if (cpf) result.cpf = cpf;

  const cpfConjuge = extractFromLines(lines, /cpf\s*c[oô]njuge[^:]*:\s*(.+)/i);
  if (cpfConjuge) result.cpf_conjuge = cpfConjuge;

  const endereco = extractFromLines(lines, /endere[cç]o[^:]*:\s*(.+)/i);
  if (endereco) result.endereco_completo = endereco;

  const cep = extractFromLines(lines, /cep:\s*(.+)/i);
  if (cep) result.endereco_cep = cep;

  const telefone = extractFromLines(lines, /telefone:\s*(.+)/i);
  if (telefone) result.telefone = telefone;

  const email = extractFromLines(lines, /e-?mail:\s*(.+)/i);
  if (email) result.email = email;

  const profissao = extractFromLines(lines, /profiss[aã]o:\s*(.+)/i);
  if (profissao) result.profissao = profissao;

  const rendaStr = extractFromLines(lines, /renda:\s*(.+)/i);
  if (rendaStr) result.renda = parseMoney(rendaStr);

  const patrimonioStr = extractFromLines(lines, /patrim[oô]nio:\s*(.+)/i);
  if (patrimonioStr) result.patrimonio = parseMoney(patrimonioStr);

  const pix = extractFromLines(lines, /(?:chave\s*)?pix:\s*(.+)/i);
  if (pix) result.pix = pix;

  return result;
}

export function parseChecklistPJ(text: string): Partial<ChecklistPJData> {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  const result: Partial<ChecklistPJData> = {};

  const razao = extractFromLines(lines, /raz[aã]o\s*social:\s*(.+)/i);
  if (razao) result.razao_social = razao;

  const cnpj = extractFromLines(lines, /cnpj:\s*(.+)/i);
  if (cnpj) result.cnpj = cnpj;

  const natureza = extractFromLines(lines, /natureza\s*jur[ií]dica:\s*(.+)/i);
  if (natureza) result.natureza_juridica = natureza;

  const ie = extractFromLines(lines, /inscri[cç][aã]o\s*estadual:\s*(.+)/i);
  if (ie) result.inscricao_estadual = ie;

  const dataFund = extractFromLines(lines, /data\s*de\s*funda[cç][aã]o:\s*(.+)/i);
  if (dataFund) {
    // Convert dd/mm/yyyy to yyyy-mm-dd
    const match = dataFund.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (match) {
      result.data_fundacao = `${match[3]}-${match[2]}-${match[1]}`;
    } else {
      result.data_fundacao = dataFund;
    }
  }

  const sociosCpf = extractFromLines(lines, /cpf\s*dos\s*s[oó]cios:\s*(.+)/i);
  if (sociosCpf) {
    result.socios_cpfs = sociosCpf.split(',').map(s => s.trim()).filter(Boolean);
  }

  const endereco = extractFromLines(lines, /endere[cç]o\s*comercial:\s*(.+)/i);
  if (endereco) result.endereco_comercial = endereco;

  const cep = extractFromLines(lines, /cep:\s*(.+)/i);
  if (cep) result.endereco_comercial_cep = cep;

  const telefone = extractFromLines(lines, /telefone\s*comercial:\s*(.+)/i);
  if (telefone) result.telefone_comercial = telefone;

  const email = extractFromLines(lines, /e-?mail\s*comercial:\s*(.+)/i);
  if (email) result.email_comercial = email;

  const faturamento = extractFromLines(lines, /faturamento\s*m[eé]dio:\s*(.+)/i);
  if (faturamento) result.faturamento_mensal = parseMoney(faturamento);

  const numFunc = extractFromLines(lines, /n[uú]mero\s*de\s*funcion[aá]rios:\s*(.+)/i);
  if (numFunc) result.num_funcionarios = parseInt(numFunc) || 0;

  const rendaSocios = extractFromLines(lines, /renda\s*dos\s*s[oó]cios:\s*(.+)/i);
  if (rendaSocios) result.renda_socios = parseMoney(rendaSocios);

  return result;
}
