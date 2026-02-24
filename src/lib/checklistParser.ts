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

export function parseChecklistPF(text: string): Partial<ChecklistPFData> {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  const extractFromLines = (pattern: RegExp): string => {
    for (const line of lines) {
      const match = line.match(pattern);
      if (match) return match[1].trim();
    }
    return '';
  };

  const parseMoney = (value: string): number => {
    if (!value) return 0;
    return parseFloat(value.replace(/[R$\s.]/g, '').replace(',', '.')) || 0;
  };

  // For CPF, we need to match a line that has "CPF:" but NOT "Cônjuge" / "Conjuge"
  let cpf = '';
  for (const line of lines) {
    if (/cpf\s*c[oô]njuge/i.test(line)) continue;
    const match = line.match(/^cpf:\s*(.+)/i);
    if (match) {
      cpf = match[1].trim();
      break;
    }
  }

  const result: Partial<ChecklistPFData> = {};

  const nome = extractFromLines(/nome\s*completo:\s*(.+)/i);
  if (nome) result.nome_completo = nome;

  const rg = extractFromLines(/rg:\s*(.+)/i);
  if (rg) result.rg = rg;

  if (cpf) result.cpf = cpf;

  const cpfConjuge = extractFromLines(/cpf\s*c[oô]njuge[^:]*:\s*(.+)/i);
  if (cpfConjuge) result.cpf_conjuge = cpfConjuge;

  const endereco = extractFromLines(/endere[cç]o[^:]*:\s*(.+)/i);
  if (endereco) result.endereco_completo = endereco;

  const cep = extractFromLines(/cep:\s*(.+)/i);
  if (cep) result.endereco_cep = cep;

  const telefone = extractFromLines(/telefone:\s*(.+)/i);
  if (telefone) result.telefone = telefone;

  const email = extractFromLines(/e-?mail:\s*(.+)/i);
  if (email) result.email = email;

  const profissao = extractFromLines(/profiss[aã]o:\s*(.+)/i);
  if (profissao) result.profissao = profissao;

  const rendaStr = extractFromLines(/renda:\s*(.+)/i);
  if (rendaStr) result.renda = parseMoney(rendaStr);

  const patrimonioStr = extractFromLines(/patrim[oô]nio:\s*(.+)/i);
  if (patrimonioStr) result.patrimonio = parseMoney(patrimonioStr);

  const pix = extractFromLines(/(?:chave\s*)?pix:\s*(.+)/i);
  if (pix) result.pix = pix;

  return result;
}
