import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook para verificar em batch quais emails são A010 (compradores)
 * Retorna um Map<email, isA010>
 */
export const useBulkA010Check = (emails: string[]) => {
  // Remover emails nulos/undefined e duplicados
  const cleanEmails = [...new Set(emails.filter(Boolean).map(e => e.toLowerCase()))];
  
  return useQuery({
    queryKey: ['bulk-a010-check', cleanEmails.sort().join(',')],
    queryFn: async (): Promise<Map<string, boolean>> => {
      const resultMap = new Map<string, boolean>();
      
      if (cleanEmails.length === 0) return resultMap;
      
      // Buscar transações A010 completadas para esses emails
      const { data, error } = await supabase
        .from('hubla_transactions')
        .select('customer_email')
        .eq('product_category', 'a010')
        .eq('sale_status', 'completed')
        .in('customer_email', cleanEmails);
      
      if (error) {
        console.error('Erro ao buscar A010 status:', error);
        // Retornar todos como false em caso de erro
        cleanEmails.forEach(email => resultMap.set(email, false));
        return resultMap;
      }
      
      // Criar set de emails A010
      const a010Emails = new Set(
        data?.map(t => t.customer_email?.toLowerCase()).filter(Boolean) || []
      );
      
      // Mapear resultado
      cleanEmails.forEach(email => {
        resultMap.set(email, a010Emails.has(email));
      });
      
      return resultMap;
    },
    enabled: cleanEmails.length > 0,
    staleTime: 5 * 60 * 1000, // Cache por 5 minutos
  });
};
