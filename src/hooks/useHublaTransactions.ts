import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { HUBLA_PLATFORM_FEE, HUBLA_NET_MULTIPLIER } from '@/lib/constants';

export interface HublaTransaction {
  id: string;
  hubla_id: string;
  event_type: string;
  product_name: string;
  product_category: string | null;
  product_price: number | null;
  net_value: number | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  sale_status: string | null;
  sale_date: string;
  created_at: string | null;
  source: string | null;
  installment_number: number | null;
  total_installments: number | null;
  count_in_dashboard: boolean | null;
}

export interface TransactionFilters {
  startDate?: Date;
  endDate?: Date;
  search?: string;
  onlyCountInDashboard?: boolean;
  productCategory?: string;
}

export const useHublaTransactionsFiltered = (filters: TransactionFilters) => {
  return useQuery({
    queryKey: ['hubla-transactions-filtered', filters],
    queryFn: async () => {
      let query = supabase
        .from('hubla_transactions')
        .select('*')
        .order('sale_date', { ascending: false });
      
      if (filters.startDate) {
        query = query.gte('sale_date', filters.startDate.toISOString());
      }
      
      if (filters.endDate) {
        const endOfDay = new Date(filters.endDate);
        endOfDay.setHours(23, 59, 59, 999);
        query = query.lte('sale_date', endOfDay.toISOString());
      }
      
      if (filters.onlyCountInDashboard) {
        query = query.eq('count_in_dashboard', true);
      }
      
      if (filters.productCategory && filters.productCategory !== 'all') {
        query = query.eq('product_category', filters.productCategory);
      }
      
      const { data, error } = await query.limit(500);
      
      if (error) throw error;
      
      // Filtro de busca no cliente (nome ou email)
      let result = data as HublaTransaction[];
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        result = result.filter(tx => 
          (tx.customer_name?.toLowerCase().includes(searchLower)) ||
          (tx.customer_email?.toLowerCase().includes(searchLower)) ||
          (tx.product_name?.toLowerCase().includes(searchLower))
        );
      }
      
      return result;
    },
    refetchInterval: 30000,
  });
};

export const useUpdateTransactionDashboardFlag = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, countInDashboard }: { id: string; countInDashboard: boolean }) => {
      const { error } = await supabase
        .from('hubla_transactions')
        .update({ count_in_dashboard: countInDashboard })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hubla-transactions-filtered'] });
      queryClient.invalidateQueries({ queryKey: ['director-kpis'] });
      queryClient.invalidateQueries({ queryKey: ['ultrameta'] });
    },
  });
};

// Nova mutation para atualizar múltiplas transações em lote
export const useUpdateMultipleTransactionsDashboardFlag = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ ids, countInDashboard }: { ids: string[]; countInDashboard: boolean }) => {
      const { error } = await supabase
        .from('hubla_transactions')
        .update({ count_in_dashboard: countInDashboard })
        .in('id', ids);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hubla-transactions-filtered'] });
      queryClient.invalidateQueries({ queryKey: ['director-kpis'] });
      queryClient.invalidateQueries({ queryKey: ['ultrameta'] });
    },
  });
};

export const useUpdateTransactionSaleDate = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, saleDate }: { id: string; saleDate: string }) => {
      const { error } = await supabase
        .from('hubla_transactions')
        .update({ sale_date: saleDate })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hubla-transactions-filtered'] });
      queryClient.invalidateQueries({ queryKey: ['director-kpis'] });
      queryClient.invalidateQueries({ queryKey: ['ultrameta'] });
    },
  });
};

// Interfaces para criar/atualizar transações
export interface CreateTransactionData {
  product_name: string;
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  sale_date: string;
  product_price: number;
  net_value: number;
  installment_number?: number;
  total_installments?: number;
  count_in_dashboard?: boolean;
}

export interface UpdateTransactionData extends CreateTransactionData {
  id: string;
}

// Criar transação manual
export const useCreateTransaction = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateTransactionData) => {
      const { error, data: result } = await supabase
        .from('hubla_transactions')
        .insert({
          hubla_id: `manual-${Date.now()}`,
          event_type: 'manual_entry',
          product_name: data.product_name,
          product_price: data.product_price,
          net_value: data.net_value,
          customer_name: data.customer_name,
          customer_email: data.customer_email,
          customer_phone: data.customer_phone || null,
          sale_date: data.sale_date,
          sale_status: 'completed',
          installment_number: data.installment_number || 1,
          total_installments: data.total_installments || 1,
          count_in_dashboard: data.count_in_dashboard ?? true,
          source: 'manual',
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hubla-transactions-filtered'] });
      queryClient.invalidateQueries({ queryKey: ['incorporador-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['director-kpis'] });
      queryClient.invalidateQueries({ queryKey: ['ultrameta'] });
    },
  });
};

// Atualizar transação completa
export const useUpdateTransaction = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: UpdateTransactionData) => {
      const { error } = await supabase
        .from('hubla_transactions')
        .update({
          product_name: data.product_name,
          product_price: data.product_price,
          net_value: data.net_value,
          customer_name: data.customer_name,
          customer_email: data.customer_email,
          customer_phone: data.customer_phone || null,
          sale_date: data.sale_date,
          installment_number: data.installment_number || 1,
          total_installments: data.total_installments || 1,
          count_in_dashboard: data.count_in_dashboard ?? true,
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hubla-transactions-filtered'] });
      queryClient.invalidateQueries({ queryKey: ['incorporador-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['director-kpis'] });
      queryClient.invalidateQueries({ queryKey: ['ultrameta'] });
    },
  });
};

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
    refetchInterval: 30000,
  });
};

export const useHublaSummary = () => {
  return useQuery({
    queryKey: ['hubla-summary'],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data: todayTransactions, error: todayError } = await supabase
        .from('hubla_transactions')
        .select('*')
        .gte('sale_date', today.toISOString())
        .eq('sale_status', 'completed')
        .eq('event_type', 'invoice.payment_succeeded');

      if (todayError) throw todayError;

      const { data: todayRefunds, error: refundsError } = await supabase
        .from('hubla_transactions')
        .select('*')
        .gte('sale_date', today.toISOString())
        .eq('event_type', 'refund');

      if (refundsError) throw refundsError;

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

      const netRevenue = grossRevenue * HUBLA_NET_MULTIPLIER;
      const platformFees = grossRevenue * HUBLA_PLATFORM_FEE;

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
