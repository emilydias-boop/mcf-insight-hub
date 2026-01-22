import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook que busca os IDs das primeiras transações de cada cliente+produto
 * considerando TODO o histórico (ignora filtros de data).
 * 
 * Usado para deduplicação global de valores Bruto no Incorporador.
 * Agora usa RPC no banco para fazer JOIN correto com product_configurations.
 */
export function useFirstTransactionIds() {
  return useQuery({
    queryKey: ['first-transaction-ids-global'],
    queryFn: async () => {
      // Chama RPC que faz JOIN correto no banco
      const { data, error } = await supabase.rpc('get_first_transaction_ids');
      
      if (error) {
        console.error('Erro ao buscar primeiros IDs:', error);
        throw error;
      }
      
      // Converte array de objetos para Set de IDs (RPC retorna coluna 'id')
      return new Set<string>((data || []).map((row: any) => row.id as string));
    },
    staleTime: 5 * 60 * 1000, // Cache por 5 minutos
    refetchInterval: 5 * 60 * 1000, // Refetch a cada 5 minutos
  });
}
