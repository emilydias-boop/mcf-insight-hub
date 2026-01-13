/**
 * Validates a Brazilian CPF using the official digit verification algorithm
 */
export function validateCpf(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, '');
  
  // Must have 11 digits
  if (digits.length !== 11) return false;
  
  // Reject CPFs with all repeated digits (111.111.111-11, etc.)
  if (/^(\d)\1+$/.test(digits)) return false;
  
  // Calculate first verification digit
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(digits[i]) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  if (remainder !== parseInt(digits[9])) return false;
  
  // Calculate second verification digit
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(digits[i]) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  if (remainder !== parseInt(digits[10])) return false;
  
  return true;
}

/**
 * Validates a Brazilian CNPJ using the official digit verification algorithm
 */
export function validateCnpj(cnpj: string): boolean {
  const digits = cnpj.replace(/\D/g, '');
  
  // Must have 14 digits
  if (digits.length !== 14) return false;
  
  // Reject CNPJs with all repeated digits
  if (/^(\d)\1+$/.test(digits)) return false;
  
  // Calculate first verification digit
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(digits[i]) * weights1[i];
  }
  let remainder = sum % 11;
  const digit1 = remainder < 2 ? 0 : 11 - remainder;
  if (digit1 !== parseInt(digits[12])) return false;
  
  // Calculate second verification digit
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  sum = 0;
  for (let i = 0; i < 13; i++) {
    sum += parseInt(digits[i]) * weights2[i];
  }
  remainder = sum % 11;
  const digit2 = remainder < 2 ? 0 : 11 - remainder;
  if (digit2 !== parseInt(digits[13])) return false;
  
  return true;
}

export interface CnpjResult {
  razao_social: string;
  nome_fantasia?: string;
  natureza_juridica?: string;
  data_fundacao?: string;
  telefone?: string;
  email?: string;
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  municipio?: string;
  uf?: string;
}

/**
 * Fetches company data from BrasilAPI using a CNPJ number
 */
export async function buscarCnpj(cnpj: string): Promise<CnpjResult | null> {
  const digits = cnpj.replace(/\D/g, '');
  
  if (digits.length !== 14 || !validateCnpj(cnpj)) {
    return null;
  }
  
  try {
    const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`);
    
    if (!response.ok) return null;
    
    const data = await response.json();
    
    // Format phone number from DDD + number
    let telefone = '';
    if (data.ddd_telefone_1) {
      telefone = data.ddd_telefone_1.replace(/\D/g, '');
    }
    
    return {
      razao_social: data.razao_social || '',
      nome_fantasia: data.nome_fantasia || '',
      natureza_juridica: data.descricao_natureza_juridica || '',
      data_fundacao: data.data_inicio_atividade || '',
      telefone,
      email: data.email || '',
      cep: data.cep || '',
      logradouro: `${data.descricao_tipo_de_logradouro || ''} ${data.logradouro || ''}`.trim(),
      numero: data.numero || '',
      complemento: data.complemento || '',
      bairro: data.bairro || '',
      municipio: data.municipio || '',
      uf: data.uf || '',
    };
  } catch (error) {
    console.error('Erro ao buscar CNPJ:', error);
    return null;
  }
}
