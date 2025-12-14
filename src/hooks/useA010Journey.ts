import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface A010JourneyData {
  hasA010: boolean;
  firstPurchaseDate: string | null;
  totalPaid: number;
  purchaseCount: number;
}

/**
 * Hook para buscar dados da Jornada A010 de um lead
 * Usa email/telefone do contato para buscar na hubla_transactions
 */
export const useA010Journey = (email?: string | null, phone?: string | null) => {
  return useQuery({
    queryKey: ['a010-journey', email, phone],
    queryFn: async (): Promise<A010JourneyData> => {
      if (!email && !phone) {
        return {
          hasA010: false,
          firstPurchaseDate: null,
          totalPaid: 0,
          purchaseCount: 0
        };
      }
      
      // Buscar transações A010 pelo email ou telefone
      let query = supabase
        .from('hubla_transactions')
        .select('sale_date, net_value, customer_email, customer_phone')
        .eq('product_category', 'a010')
        .eq('sale_status', 'completed')
        .order('sale_date', { ascending: true });
      
      // Filtrar por email (prioridade) ou telefone
      if (email) {
        query = query.ilike('customer_email', email);
      } else if (phone) {
        // Normalizar telefone para busca
        const cleanPhone = phone.replace(/\D/g, '');
        query = query.ilike('customer_phone', `%${cleanPhone.slice(-9)}%`);
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error('Erro ao buscar jornada A010:', error);
        return {
          hasA010: false,
          firstPurchaseDate: null,
          totalPaid: 0,
          purchaseCount: 0
        };
      }
      
      if (!data || data.length === 0) {
        return {
          hasA010: false,
          firstPurchaseDate: null,
          totalPaid: 0,
          purchaseCount: 0
        };
      }
      
      // Calcular totais
      const totalPaid = data.reduce((sum, tx) => sum + (tx.net_value || 0), 0);
      const firstPurchaseDate = data[0]?.sale_date || null;
      
      return {
        hasA010: true,
        firstPurchaseDate,
        totalPaid,
        purchaseCount: data.length
      };
    },
    enabled: !!(email || phone),
    staleTime: 5 * 60 * 1000, // Cache por 5 minutos
  });
};
