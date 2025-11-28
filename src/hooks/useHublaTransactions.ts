import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { HUBLA_PLATFORM_FEE, HUBLA_NET_MULTIPLIER } from '@/lib/constants';

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
      // Buscar transações de hoje (vendas)
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data: todayTransactions, error: todayError } = await supabase
        .from('hubla_transactions')
        .select('*')
        .gte('sale_date', today.toISOString())
        .eq('sale_status', 'completed')
        .eq('event_type', 'invoice.payment_succeeded');

      if (todayError) throw todayError;

      // Buscar reembolsos de hoje
      const { data: todayRefunds, error: refundsError } = await supabase
        .from('hubla_transactions')
        .select('*')
        .gte('sale_date', today.toISOString())
        .eq('event_type', 'refund');

      if (refundsError) throw refundsError;

      // Calcular totais de vendas por categoria
      const byCategory: Record<string, { grossRevenue: number; netRevenue: number; count: number }> = {};
      let grossRevenue = 0;
      let totalSales = 0;

      (todayTransactions || []).forEach((transaction) => {
        const category = transaction.product_category || 'outros';
        const price = transaction.product_price || 0;

        if (!byCategory[category]) {
          byCategory[category] = { grossRevenue: 0, netRevenue: 0, count: 0 };
        }

        byCategory[category].grossRevenue += price;
        byCategory[category].netRevenue += price * HUBLA_NET_MULTIPLIER;
        byCategory[category].count += 1;

        grossRevenue += price;
        totalSales += 1;
      });

      // Calcular receita líquida e taxas
      const netRevenue = grossRevenue * HUBLA_NET_MULTIPLIER;
      const platformFees = grossRevenue * HUBLA_PLATFORM_FEE;

      // Calcular total de reembolsos
      const refundsAmount = (todayRefunds || []).reduce((sum, refund) => 
        sum + (refund.product_price || 0), 0
      );

      return {
        grossRevenue,
        netRevenue,
        platformFees,
        totalSales,
        todayCount: todayTransactions?.length || 0,
        refundsCount: todayRefunds?.length || 0,
        refundsAmount,
        byCategory,
        lastTransaction: todayTransactions?.[0] || null,
      };
    },
    refetchInterval: 30000,
  });
};
