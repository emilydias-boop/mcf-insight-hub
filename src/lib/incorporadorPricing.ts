// ===== PREÇOS BRUTOS FIXOS POR PRODUTO (Incorporador) =====
// Match parcial, case-insensitive - usado para cálculo de faturamento bruto

export const FIXED_GROSS_PRICES: { pattern: string; price: number }[] = [
  { pattern: 'a005 - mcf p2', price: 0 },
  { pattern: 'a009 - mcf incorporador completo + the club', price: 19500 },
  { pattern: 'a001 - mcf incorporador completo', price: 14500 },
  { pattern: 'a000 - contrato', price: 497 },
  { pattern: 'a010', price: 47 },
  { pattern: 'plano construtor básico', price: 997 },
  { pattern: 'a004 - mcf plano anticrise básico', price: 5500 },
  { pattern: 'a003 - mcf plano anticrise completo', price: 7500 },
];

// Função para obter preço bruto fixo ou original
export const getFixedGrossPrice = (productName: string | null, originalPrice: number): number => {
  if (!productName) return originalPrice;
  const normalizedName = productName.toLowerCase().trim();
  
  for (const { pattern, price } of FIXED_GROSS_PRICES) {
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
  gross_winner: boolean | null;
}

// Calcula o valor bruto de uma transação seguindo as regras de deduplicação
// O banco determina a transação vencedora (gross_winner) considerando todo o histórico
export const getDeduplicatedGross = (transaction: TransactionForGross): number => {
  const installment = transaction.installment_number || 1;
  
  // Regra 1: Parcela > 1 sempre tem bruto zerado
  if (installment > 1) {
    return 0;
  }
  
  // Regra 2: Apenas a transação marcada como gross_winner pelo banco tem bruto
  if (transaction.gross_winner !== true) {
    return 0;
  }
  
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
