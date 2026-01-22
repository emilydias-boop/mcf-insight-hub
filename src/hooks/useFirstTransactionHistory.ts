import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface FirstTransactionRecord {
  customer_email: string;
  product_key: string;
  first_sale_date: string;
  first_transaction_id: string;
}

/**
 * Hook para buscar e cachear o histórico de primeiras transações
 * de cada par cliente+produto em todo o banco de dados.
 * 
 * Isso permite identificar se uma transação no período filtrado
 * é realmente a PRIMEIRA compra daquele cliente para aquele produto,
 * considerando o histórico completo.
 */
export const useFirstTransactionHistory = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['first-transaction-history'],
    queryFn: async () => {
      // Usa query direta para evitar problemas de tipagem com RPC
      const { data, error } = await supabase
        .from('hubla_transactions')
        .select('id, customer_email, product_name, sale_date')
        .not('customer_email', 'is', null)
        .neq('customer_email', '')
        .order('sale_date', { ascending: true });
      
      if (error) {
        console.error('Erro ao buscar histórico de primeiras transações:', error);
        throw error;
      }
      
      // Processa localmente para encontrar a primeira transação de cada cliente+produto
      const firstByGroup = new Map<string, { id: string; date: Date }>();
      
      (data || []).forEach(row => {
        if (!row.customer_email || !row.product_name) return;
        
        // Normaliza a chave do produto
        const productKey = normalizeProductKeyLocal(row.product_name);
        const key = `${row.customer_email.toLowerCase().trim()}|${productKey}`;
        const txDate = new Date(row.sale_date);
        
        const existing = firstByGroup.get(key);
        if (!existing || txDate < existing.date) {
          firstByGroup.set(key, { id: row.id, date: txDate });
        }
      });
      
      // Cria Map: "email|product_key" → first_transaction_id
      const map = new Map<string, string>();
      firstByGroup.forEach((value, key) => {
        map.set(key, value.id);
      });
      
      console.log(`[useFirstTransactionHistory] Carregado ${map.size} pares cliente+produto`);
      
      return map;
    },
    staleTime: 5 * 60 * 1000, // 5 minutos de cache
    refetchOnWindowFocus: false,
  });
  
  return { 
    firstTransactionMap: data || new Map<string, string>(), 
    isLoading, 
    error 
  };
};

// Normaliza o nome do produto para chave de deduplicação (cópia local para evitar import circular)
function normalizeProductKeyLocal(productName: string | null): string {
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
  
  return upper.substring(0, 40);
}
