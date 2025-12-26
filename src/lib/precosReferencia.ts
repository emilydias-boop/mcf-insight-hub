// ===== PREÇOS DE REFERÊNCIA (valores da planilha, não do cartão parcelado) =====
// Usado para Faturamento Clint Bruto - ignora juros do cartão
// A005/P2 NÃO tem valor fixo - usa product_price do banco
export const PRECO_REFERENCIA: Record<string, number> = {
  'A009': 19500,  // MCF INCORPORADOR COMPLETO + THE CLUB
  'A001': 14500,  // MCF INCORPORADOR COMPLETO
  'A003': 7503,   // MCF Plano Anticrise Completo
  'A004': 5503,   // MCF Plano Anticrise Básico
  'A002': 7500,   // MCF INCORPORADOR BÁSICO
  'A008': 5000,   // The CLUB
  'A000': 497,    // Contrato padrão
  'CONTRATO_ANTICRISE': 397,
  // A005/P2 não entra - usa valor do banco (valor variável)
};

// Normaliza nome do produto para chave de deduplicação (email+produto)
export const normalizeProductForDedup = (productName: string): string => {
  const upper = productName.toUpperCase();
  if (upper.includes('A009')) return 'A009';
  if (upper.includes('A008')) return 'A008';
  if (upper.includes('A005') || upper.includes('P2')) return 'A005';
  if (upper.includes('A004')) return 'A004';
  if (upper.includes('A003')) return 'A003';
  if (upper.includes('A002')) return 'A002';
  if (upper.includes('A001')) return 'A001';
  if (upper.includes('A000') || upper.includes('CONTRATO')) {
    if (upper.includes('ANTICRISE')) return 'CONTRATO_ANTICRISE';
    return 'A000';
  }
  return upper.substring(0, 20); // Fallback
};

// Obtém preço de referência ou usa valor do banco (para A005/P2 e outros sem valor fixo)
export const getPrecoReferencia = (productName: string, productPriceFromDB: number): number => {
  const normalizado = normalizeProductForDedup(productName);
  // Se tem preço de referência, usar ele
  if (PRECO_REFERENCIA[normalizado]) {
    return PRECO_REFERENCIA[normalizado];
  }
  // Caso contrário (A005/P2, etc), usar valor do banco
  return productPriceFromDB;
};
