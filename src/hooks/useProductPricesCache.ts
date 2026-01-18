import { useEffect } from 'react';
import { useProductConfigurations } from './useProductConfigurations';

// ===== CACHE GLOBAL DE PREÇOS (Singleton) =====
// Carregado uma vez e usado de forma síncrona em todo o app

let pricesCache: Map<string, number> | null = null;
let pricesByPattern: { pattern: string; price: number }[] | null = null;

// Normaliza código do produto para lookup no cache
const normalizeProductCode = (productName: string): string => {
  const upper = productName.toUpperCase().trim();
  
  // Extrai código do produto (A001, A005, etc.)
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
  if (upper.includes('PLANO CONSTRUTOR')) return 'PLANO_CONSTRUTOR';
  
  return upper.substring(0, 40);
};

/**
 * Hook para carregar e cachear preços da tabela product_configurations
 * Deve ser chamado no App.tsx para garantir que o cache está disponível
 */
export const useProductPricesCache = () => {
  const { data, isLoading, error } = useProductConfigurations();
  
  useEffect(() => {
    if (data && data.length > 0) {
      // Inicializa caches
      pricesCache = new Map();
      pricesByPattern = [];
      
      data.forEach(product => {
        // Cache por código do produto
        const code = product.product_code?.toUpperCase().trim();
        if (code && product.reference_price != null) {
          pricesCache!.set(code, product.reference_price);
        }
        
        // Cache por nome para pattern matching (usado em incorporadorPricing)
        if (product.product_name) {
          pricesByPattern!.push({
            pattern: product.product_name.toLowerCase().trim(),
            price: product.reference_price || 0
          });
        }
      });
      
      console.log(`[PricesCache] Carregado: ${pricesCache.size} códigos, ${pricesByPattern.length} patterns`);
    }
  }, [data]);
  
  return { 
    isLoaded: !!data && data.length > 0, 
    isLoading,
    error,
    count: data?.length || 0 
  };
};

/**
 * Busca preço de referência do cache pelo nome/código do produto
 * Retorna o preço do cache ou -1 se não encontrado
 */
export const getCachedPrecoReferencia = (productName: string): number => {
  if (!pricesCache || pricesCache.size === 0) {
    return -1; // Cache não carregado
  }
  
  const normalizado = normalizeProductCode(productName);
  
  // Busca por código normalizado
  if (pricesCache.has(normalizado)) {
    return pricesCache.get(normalizado)!;
  }
  
  return -1; // Não encontrado no cache
};

/**
 * Busca preço fixo do cache por pattern matching no nome do produto
 * Retorna o preço do cache ou -1 se não encontrado
 */
export const getCachedFixedGrossPrice = (productName: string | null): number => {
  if (!pricesByPattern || pricesByPattern.length === 0 || !productName) {
    return -1; // Cache não carregado ou nome vazio
  }
  
  const normalizedName = productName.toLowerCase().trim();
  
  // Busca por pattern matching
  for (const { pattern, price } of pricesByPattern) {
    if (normalizedName.includes(pattern) || pattern.includes(normalizedName)) {
      return price;
    }
  }
  
  return -1; // Não encontrado no cache
};

/**
 * Verifica se o cache está disponível
 */
export const isPricesCacheLoaded = (): boolean => {
  return pricesCache !== null && pricesCache.size > 0;
};

/**
 * Limpa o cache (útil para testes ou refresh forçado)
 */
export const clearPricesCache = (): void => {
  pricesCache = null;
  pricesByPattern = null;
};
