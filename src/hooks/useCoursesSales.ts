import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfMonth, endOfMonth } from 'date-fns';
import { getCustomWeekStart, getCustomWeekEnd } from '@/lib/dateHelpers';

export interface CourseSale {
  id: string;
  hubla_id: string;
  event_type: string;
  product_name: string;
  product_category: string;
  product_price: number;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  sale_status: string;
  sale_date: string;
  created_at: string;
}

interface UseCoursesSalesParams {
  period?: 'semana' | 'mes' | 'all';
  startDate?: Date;
  endDate?: Date;
  courseType?: 'all' | 'a010' | 'construir_para_alugar';
  search?: string;
  limit?: number;
}

export const useCoursesSales = ({ 
  period = 'mes', 
  startDate, 
  endDate,
  courseType = 'all',
  search,
  limit = 100 
}: UseCoursesSalesParams = {}) => {
  return useQuery({
    queryKey: ['courses-sales', period, startDate, endDate, courseType, search, limit],
    queryFn: async () => {
      let query = supabase
        .from('hubla_transactions')
        .select('*')
        .eq('product_category', 'curso')
        .eq('sale_status', 'completed')
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
            start = getCustomWeekStart(now);
            end = getCustomWeekEnd(now);
          } else {
            start = startOfMonth(now);
            end = endOfMonth(now);
          }
        }

        query = query
          .gte('sale_date', start.toISOString())
          .lte('sale_date', end.toISOString());
      }

      // Apply course type filter
      if (courseType !== 'all') {
        if (courseType === 'a010') {
          query = query.ilike('product_name', '%A010%');
        } else if (courseType === 'construir_para_alugar') {
          query = query.ilike('product_name', '%Construir para%');
        }
      }

      // Apply search filter
      if (search && search.trim()) {
        query = query.or(
          `customer_name.ilike.%${search}%,customer_email.ilike.%${search}%,customer_phone.ilike.%${search}%,product_name.ilike.%${search}%`
        );
      }

      query = query.limit(limit);
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as CourseSale[];
    },
    refetchInterval: 30000,
  });
};

export const useCoursesSummary = ({ 
  period = 'mes', 
  startDate, 
  endDate,
  courseType = 'all'
}: Omit<UseCoursesSalesParams, 'search' | 'limit'> = {}) => {
  return useQuery({
    queryKey: ['courses-summary', period, startDate, endDate, courseType],
    queryFn: async () => {
      let query = supabase
        .from('hubla_transactions')
        .select('product_price, sale_date, product_name')
        .eq('product_category', 'curso')
        .eq('sale_status', 'completed');

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
            start = getCustomWeekStart(now);
            end = getCustomWeekEnd(now);
          } else {
            start = startOfMonth(now);
            end = endOfMonth(now);
          }
        }

        query = query
          .gte('sale_date', start.toISOString())
          .lte('sale_date', end.toISOString());
      }

      // Apply course type filter
      if (courseType !== 'all') {
        if (courseType === 'a010') {
          query = query.ilike('product_name', '%A010%');
        } else if (courseType === 'construir_para_alugar') {
          query = query.ilike('product_name', '%Construir para%');
        }
      }

      const { data, error } = await query;
      
      if (error) throw error;

      const sales = data || [];
      const totalSales = sales.length;
      const totalRevenue = sales.reduce((sum, sale) => sum + (sale.product_price || 0), 0);
      const averageTicket = totalSales > 0 ? totalRevenue / totalSales : 0;

      // Separate by course type for comparison
      const a010Sales = sales.filter(s => s.product_name?.toLowerCase().includes('a010'));
      const construirSales = sales.filter(s => s.product_name?.toLowerCase().includes('construir para'));

      const a010Summary = {
        count: a010Sales.length,
        revenue: a010Sales.reduce((sum, sale) => sum + (sale.product_price || 0), 0),
        averageTicket: a010Sales.length > 0 
          ? a010Sales.reduce((sum, sale) => sum + (sale.product_price || 0), 0) / a010Sales.length 
          : 0
      };

      const construirSummary = {
        count: construirSales.length,
        revenue: construirSales.reduce((sum, sale) => sum + (sale.product_price || 0), 0),
        averageTicket: construirSales.length > 0 
          ? construirSales.reduce((sum, sale) => sum + (sale.product_price || 0), 0) / construirSales.length 
          : 0
      };

      // Group by date for chart
      const salesByDate = sales.reduce((acc, sale) => {
        const date = sale.sale_date.split('T')[0];
        const courseType = sale.product_name?.toLowerCase().includes('a010') ? 'a010' : 'construir';
        
        if (!acc[date]) {
          acc[date] = { a010: 0, construir: 0, total: 0 };
        }
        
        if (courseType === 'a010') {
          acc[date].a010 += sale.product_price || 0;
        } else {
          acc[date].construir += sale.product_price || 0;
        }
        acc[date].total += sale.product_price || 0;
        
        return acc;
      }, {} as Record<string, { a010: number; construir: number; total: number }>);

      const chartData = Object.entries(salesByDate)
        .map(([date, data]) => ({
          date,
          a010: data.a010,
          construir: data.construir,
          total: data.total,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      return {
        totalSales,
        totalRevenue,
        averageTicket,
        a010Summary,
        construirSummary,
        chartData,
      };
    },
    refetchInterval: 30000,
  });
};
