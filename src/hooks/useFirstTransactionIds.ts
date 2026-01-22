import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook que busca os IDs das primeiras transações de cada cliente+produto
 * considerando TODO o histórico (ignora filtros de data).
 * 
 * Usado para deduplicação global de valores Bruto no Incorporador.
 */
export function useFirstTransactionIds() {
  return useQuery({
    queryKey: ['first-transaction-ids-global'],
    queryFn: async () => {
      // Busca transações via JOIN com product_configurations para usar target_bu
      const { data, error } = await supabase
        .from('hubla_transactions')
        .select(`
          id, 
          customer_email, 
          product_name, 
          sale_date,
          product_configurations!inner(target_bu)
        `)
        .eq('product_configurations.target_bu', 'incorporador')
        .order('sale_date', { ascending: true });
      
      if (error) {
        console.error('Erro ao buscar transações para deduplicação:', error);
        throw error;
      }
      
      // Processa no frontend para encontrar primeiros IDs
      const firstByGroup = new Map<string, { id: string; date: Date }>();
      
      (data || []).forEach((tx) => {
        const key = getClientProductKey(tx.customer_email, tx.product_name);
        const txDate = new Date(tx.sale_date);
        
        const existing = firstByGroup.get(key);
        if (!existing || txDate < existing.date) {
          firstByGroup.set(key, { id: tx.id, date: txDate });
        }
      });
      
      return new Set<string>(Array.from(firstByGroup.values()).map(v => v.id));
    },
    staleTime: 5 * 60 * 1000, // Cache por 5 minutos
    refetchInterval: 5 * 60 * 1000, // Refetch a cada 5 minutos
  });
}

// Normaliza o nome do produto para chave de deduplicação
function normalizeProductKey(productName: string | null): string {
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

// Gera chave única por cliente + produto normalizado
function getClientProductKey(
  email: string | null, 
  productName: string | null
): string {
  const normalizedEmail = (email || 'unknown').toLowerCase().trim();
  const normalizedProduct = normalizeProductKey(productName);
  return `${normalizedEmail}|${normalizedProduct}`;
}
