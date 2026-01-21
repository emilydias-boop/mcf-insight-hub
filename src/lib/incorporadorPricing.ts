import { getCachedFixedGrossPrice } from '@/hooks/useProductPricesCache';

// ===== PREÇOS BRUTOS FIXOS POR PRODUTO - FALLBACK (Incorporador) =====
// Usado quando o cache do banco ainda não está carregado
// Os valores reais vêm da tabela product_configurations

export const FIXED_GROSS_PRICES_FALLBACK: { pattern: string; price: number }[] = [
  { pattern: 'a005 - mcf p2', price: 0 },
  { pattern: 'a009 - mcf incorporador completo + the club', price: 19500 },
  { pattern: 'a001 - mcf incorporador completo', price: 14500 },
  { pattern: 'a000 - contrato', price: 497 },
  { pattern: 'a010', price: 47 },
  { pattern: 'plano construtor básico', price: 997 },
  { pattern: 'a004 - mcf plano anticrise básico', price: 5500 },
  { pattern: 'a003 - mcf plano anticrise completo', price: 7500 },
];

// Mantém export antigo para retrocompatibilidade
export const FIXED_GROSS_PRICES = FIXED_GROSS_PRICES_FALLBACK;

// Função para obter preço bruto fixo - tenta cache do banco primeiro
export const getFixedGrossPrice = (productName: string | null, originalPrice: number): number => {
  if (!productName) return originalPrice;
  
  // 1. Tenta buscar do cache do banco de dados
  const cachedPrice = getCachedFixedGrossPrice(productName);
  if (cachedPrice >= 0) {
    return cachedPrice;
  }
  
  // 2. Fallback para valores hardcoded
  const normalizedName = productName.toLowerCase().trim();
  
  for (const { pattern, price } of FIXED_GROSS_PRICES_FALLBACK) {
    if (normalizedName.includes(pattern)) {
      return price;
    }
  }
  
  return originalPrice;
};

// Interface base para transação com campos necessários para cálculo de bruto
export interface TransactionForGross {
  product_name: string | null;
  product_price: number | null;
  installment_number: number | null;
  gross_override?: number | null;  // Override manual do valor bruto
}

// Calcula o valor bruto de uma transação
// Usa override manual se definido, senão calcula baseado no preço fixo do produto
export const getDeduplicatedGross = (transaction: TransactionForGross): number => {
  const installment = transaction.installment_number || 1;
  
  // Regra 1: Parcela > 1 sempre tem bruto zerado
  if (installment > 1) {
    return 0;
  }
  
  // Regra 2: Se há override manual, usa ele diretamente (permite zerar bruto)
  if (transaction.gross_override !== null && transaction.gross_override !== undefined) {
    return transaction.gross_override;
  }
  
  // Regra 3: Calcula baseado no preço fixo do produto
  return getFixedGrossPrice(transaction.product_name, transaction.product_price || 0);
};

// Normaliza o nome do produto para chave de deduplicação
export const normalizeProductKey = (productName: string | null): string => {
  if (!productName) return 'unknown';
  const upper = productName.toUpperCase().trim();
  
  if (upper.includes('A009')) return 'A009';
  if (upper.includes('A005')) return 'A005';
  if (upper.includes('A004')) return 'A004';
  if (upper.includes('A003')) return 'A003';
  if (upper.includes('A001')) return 'A001';
  if (upper.includes('A010')) return 'A010';
  if (upper.includes('A000') || upper.includes('CONTRATO')) return 'A000';
  if (upper.includes('PLANO CONSTRUTOR')) return 'PLANO_CONSTRUTOR';
  
  // Fallback: primeiros 40 chars
  return upper.substring(0, 40);
};
