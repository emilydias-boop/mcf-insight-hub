import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns';

export interface A010Sale {
  id: string;
  sale_date: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  net_value: number;
  status: string;
  created_at: string;
  updated_at: string;
}

interface UseA010SalesParams {
  period?: 'semana' | 'mes' | 'all';
  startDate?: Date;
  endDate?: Date;
  search?: string;
  limit?: number;
}

export const useA010Sales = ({ 
  period = 'mes', 
  startDate, 
  endDate,
  search,
  limit = 100 
}: UseA010SalesParams = {}) => {
  return useQuery({
    queryKey: ['a010-sales', period, startDate, endDate, search, limit],
    queryFn: async () => {
      let query = supabase
        .from('a010_sales')
        .select('*')
        .order('sale_date', { ascending: false });

      // Apply date filters
      if (period !== 'all') {
        let start: Date;
        let end: Date;

        if (startDate && endDate) {
          start = startDate;
          end = endDate;
        } else {
          const now = new Date();
          if (period === 'semana') {
            start = startOfWeek(now, { weekStartsOn: 1 });
            end = endOfWeek(now, { weekStartsOn: 1 });
          } else {
            start = startOfMonth(now);
            end = endOfMonth(now);
          }
        }

        query = query
          .gte('sale_date', start.toISOString().split('T')[0])
          .lte('sale_date', end.toISOString().split('T')[0]);
      }

      // Apply search filter
      if (search && search.trim()) {
        query = query.or(
          `customer_name.ilike.%${search}%,customer_email.ilike.%${search}%,customer_phone.ilike.%${search}%`
        );
      }

      query = query.limit(limit);
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as A010Sale[];
    },
    refetchInterval: 30000, // Atualizar a cada 30 segundos
  });
};

export const useA010Summary = ({ 
  period = 'mes', 
  startDate, 
  endDate 
}: Omit<UseA010SalesParams, 'search' | 'limit'> = {}) => {
  return useQuery({
    queryKey: ['a010-summary', period, startDate, endDate],
    queryFn: async () => {
      let query = supabase
        .from('a010_sales')
        .select('net_value, sale_date');

      // Apply date filters
      if (period !== 'all') {
        let start: Date;
        let end: Date;

        if (startDate && endDate) {
          start = startDate;
          end = endDate;
        } else {
          const now = new Date();
          if (period === 'semana') {
            start = startOfWeek(now, { weekStartsOn: 1 });
            end = endOfWeek(now, { weekStartsOn: 1 });
          } else {
            start = startOfMonth(now);
            end = endOfMonth(now);
          }
        }

        query = query
          .gte('sale_date', start.toISOString().split('T')[0])
          .lte('sale_date', end.toISOString().split('T')[0]);
      }

      const { data, error } = await query;
      
      if (error) throw error;

      const sales = data || [];
      const totalSales = sales.length;
      const totalRevenue = sales.reduce((sum, sale) => sum + (sale.net_value || 0), 0);
      const averageTicket = totalSales > 0 ? totalRevenue / totalSales : 0;

      // Group by date for chart
      const salesByDate = sales.reduce((acc, sale) => {
        const date = sale.sale_date;
        if (!acc[date]) {
          acc[date] = { count: 0, revenue: 0 };
        }
        acc[date].count += 1;
        acc[date].revenue += sale.net_value || 0;
        return acc;
      }, {} as Record<string, { count: number; revenue: number }>);

      const chartData = Object.entries(salesByDate)
        .map(([date, data]) => ({
          date,
          count: data.count,
          revenue: data.revenue,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      return {
        totalSales,
        totalRevenue,
        averageTicket,
        chartData,
      };
    },
    refetchInterval: 30000,
  });
};
