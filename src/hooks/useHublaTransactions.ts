import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface HublaTransaction {
  id: string;
  hubla_id: string;
  event_type: string;
  product_name: string;
  product_category: string;
  product_price: number;
  customer_name: string | null;
  customer_email: string | null;
  sale_status: string;
  sale_date: string;
  created_at: string;
}

export const useHublaTransactions = (limit: number = 50) => {
  return useQuery({
    queryKey: ['hubla-transactions', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('hubla_transactions')
        .select('*')
        .order('sale_date', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      return data as HublaTransaction[];
    },
    refetchInterval: 30000, // Atualizar a cada 30 segundos
  });
};

export const useHublaSummary = () => {
  return useQuery({
    queryKey: ['hubla-summary'],
    queryFn: async () => {
      // Buscar transações de hoje
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data: todayTransactions, error: todayError } = await supabase
        .from('hubla_transactions')
        .select('*')
        .gte('sale_date', today.toISOString())
        .eq('sale_status', 'completed');

      if (todayError) throw todayError;

      // Calcular totais por categoria
      const byCategory: Record<string, { revenue: number; count: number }> = {};
      let totalRevenue = 0;
      let totalSales = 0;

      (todayTransactions || []).forEach((transaction) => {
        const category = transaction.product_category || 'outros';
        const price = transaction.product_price || 0;

        if (!byCategory[category]) {
          byCategory[category] = { revenue: 0, count: 0 };
        }

        byCategory[category].revenue += price;
        byCategory[category].count += 1;

        totalRevenue += price;
        totalSales += 1;
      });

      return {
        totalRevenue,
        totalSales,
        todayCount: todayTransactions?.length || 0,
        byCategory,
        lastTransaction: todayTransactions?.[0] || null,
      };
    },
    refetchInterval: 30000,
  });
};
