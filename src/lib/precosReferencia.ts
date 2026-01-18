import { getCachedPrecoReferencia } from '@/hooks/useProductPricesCache';

// ===== PREÇOS DE REFERÊNCIA - FALLBACK (valores hardcoded) =====
// Usado quando o cache do banco ainda não está carregado
// Os valores reais vêm da tabela product_configurations
export const PRECO_REFERENCIA_FALLBACK: Record<string, number> = {
  'A010': 47,     // A010 - Consultoria Construa para Vender
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

// Mantém export antigo para retrocompatibilidade
export const PRECO_REFERENCIA = PRECO_REFERENCIA_FALLBACK;

// Normaliza nome do produto para chave de deduplicação (email+produto)
export const normalizeProductForDedup = (productName: string): string => {
  const upper = productName.toUpperCase();
  if (upper.includes('A010')) return 'A010';
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

// Obtém preço de referência - tenta cache do banco primeiro, depois fallback hardcoded
export const getPrecoReferencia = (productName: string, productPriceFromDB: number): number => {
  const normalizado = normalizeProductForDedup(productName);
  
  // A005/P2 sempre retorna 0 (não conta no bruto)
  if (normalizado === 'A005') {
    return 0;
  }
  
  // 1. Tenta buscar do cache do banco de dados
  const cachedPrice = getCachedPrecoReferencia(normalizado);
  if (cachedPrice >= 0) {
    return cachedPrice;
  }
  
  // 2. Fallback para valores hardcoded
  if (PRECO_REFERENCIA_FALLBACK[normalizado]) {
    return PRECO_REFERENCIA_FALLBACK[normalizado];
  }
  
  // 3. Último recurso: valor do banco
  return productPriceFromDB;
};
