import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface A010Purchase {
  product_name: string;
  net_value: number;
  sale_date: string;
  source: string;
}

interface A010JourneyData {
  hasA010: boolean;
  firstPurchaseDate: string | null;
  lastPurchaseDate: string | null;
  totalPaid: number;
  purchaseCount: number;
  averageTicket: number;
  products: string[];
  source: 'hubla' | 'kiwify' | 'make' | 'mixed';
  purchases: A010Purchase[];
}

const DEFAULT_JOURNEY: A010JourneyData = {
  hasA010: false,
  firstPurchaseDate: null,
  lastPurchaseDate: null,
  totalPaid: 0,
  purchaseCount: 0,
  averageTicket: 0,
  products: [],
  source: 'hubla',
  purchases: []
};

/**
 * Hook para buscar dados da Jornada A010 de um lead
 * Usa email/telefone do contato para buscar na hubla_transactions
 * Retorna dados enriquecidos com produtos, datas e fonte
 */
export const useA010Journey = (email?: string | null, phone?: string | null) => {
  return useQuery({
    queryKey: ['a010-journey', email, phone],
    queryFn: async (): Promise<A010JourneyData> => {
      if (!email && !phone) {
        return DEFAULT_JOURNEY;
      }
      
      // Buscar transações A010 pelo email ou telefone
      let query = supabase
        .from('hubla_transactions')
        .select('sale_date, net_value, customer_email, customer_phone, product_name, source')
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
        return DEFAULT_JOURNEY;
      }
      
      if (!data || data.length === 0) {
        return DEFAULT_JOURNEY;
      }
      
      // Calcular totais e métricas
      const totalPaid = data.reduce((sum, tx) => sum + (tx.net_value || 0), 0);
      const firstPurchaseDate = data[0]?.sale_date || null;
      const lastPurchaseDate = data[data.length - 1]?.sale_date || null;
      const averageTicket = data.length > 0 ? totalPaid / data.length : 0;
      
      // Extrair produtos únicos
      const products = [...new Set(data.map(tx => tx.product_name).filter(Boolean))];
      
      // Determinar fonte principal
      const sources = data.map(tx => tx.source || 'hubla');
      const uniqueSources = [...new Set(sources)];
      let source: A010JourneyData['source'] = 'hubla';
      if (uniqueSources.length > 1) {
        source = 'mixed';
      } else if (uniqueSources[0] === 'kiwify') {
        source = 'kiwify';
      } else if (uniqueSources[0] === 'make') {
        source = 'make';
      }
      
      // Lista de compras
      const purchases: A010Purchase[] = data.map(tx => ({
        product_name: tx.product_name || 'A010',
        net_value: tx.net_value || 0,
        sale_date: tx.sale_date,
        source: tx.source || 'hubla'
      }));
      
      return {
        hasA010: true,
        firstPurchaseDate,
        lastPurchaseDate,
        totalPaid,
        purchaseCount: data.length,
        averageTicket,
        products,
        source,
        purchases
      };
    },
    enabled: !!(email || phone),
    staleTime: 5 * 60 * 1000, // Cache por 5 minutos
  });
};
