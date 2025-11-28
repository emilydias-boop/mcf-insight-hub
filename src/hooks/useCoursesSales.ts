import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfMonth, endOfMonth } from 'date-fns';
import { getCustomWeekStart, getCustomWeekEnd, getCustomWeekNumber, formatCustomWeekRangeShort } from '@/lib/dateHelpers';
import { HUBLA_NET_MULTIPLIER } from '@/lib/constants';

// Unified interface for course sales from both tables
export interface CourseSale {
  id: string;
  product_name: string;
  product_price: number;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  sale_status: string;
  sale_date: string;
  created_at: string;
  source: 'a010_sales' | 'hubla_transactions';
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
      // Calculate date range
      let start: Date | null = null;
      let end: Date | null = null;

      if (period !== 'all') {
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
      }

      // Fetch from a010_sales (historical A010 data) - include all statuses
      let a010Query = supabase
        .from('a010_sales')
        .select('*')
        .order('sale_date', { ascending: false });

      if (start && end) {
        a010Query = a010Query
          .gte('sale_date', start.toISOString())
          .lte('sale_date', end.toISOString());
      }

      // Only include A010 if courseType allows it
      const includeA010 = courseType === 'all' || courseType === 'a010';
      const includeConstruir = courseType === 'all' || courseType === 'construir_para_alugar';

      let a010Data: any[] = [];
      if (includeA010) {
        const { data, error } = await a010Query;
        if (error) throw error;
        a010Data = data || [];
      }

      // Fetch from hubla_transactions (Construir Para Alugar + recent A010 webhooks) - include all statuses
      let hublaQuery = supabase
        .from('hubla_transactions')
        .select('*')
        .eq('product_category', 'curso')
        .order('sale_date', { ascending: false });

      if (start && end) {
        hublaQuery = hublaQuery
          .gte('sale_date', start.toISOString())
          .lte('sale_date', end.toISOString());
      }

      if (courseType === 'construir_para_alugar') {
        hublaQuery = hublaQuery.ilike('product_name', '%Construir para%');
      } else if (courseType === 'a010') {
        hublaQuery = hublaQuery.ilike('product_name', '%A010%');
      }

      const { data: hublaData, error: hublaError } = await hublaQuery;
      if (hublaError) throw hublaError;

      // Normalize and combine data
      const normalizedA010: CourseSale[] = a010Data.map(sale => ({
        id: sale.id,
        product_name: 'A010',
        product_price: sale.net_value || 0,
        customer_name: sale.customer_name,
        customer_email: sale.customer_email,
        customer_phone: sale.customer_phone,
        sale_status: sale.status || 'completed',
        sale_date: sale.sale_date,
        created_at: sale.created_at,
        source: 'a010_sales' as const,
      }));

      const normalizedHubla: CourseSale[] = (hublaData || []).map(sale => ({
        id: sale.id,
        product_name: sale.product_name?.toLowerCase().includes('construir') ? 'Construir Para Alugar' : 'A010',
        product_price: sale.product_price || 0,
        customer_name: sale.customer_name,
        customer_email: sale.customer_email,
        customer_phone: sale.customer_phone,
        sale_status: sale.sale_status || 'completed',
        sale_date: sale.sale_date,
        created_at: sale.created_at,
        source: 'hubla_transactions' as const,
      }));

      // Combine and remove duplicates (prefer a010_sales for A010 data)
      let allSales = [...normalizedA010, ...normalizedHubla];

      // Apply search filter
      if (search && search.trim()) {
        const searchLower = search.toLowerCase();
        allSales = allSales.filter(sale => 
          sale.customer_name?.toLowerCase().includes(searchLower) ||
          sale.customer_email?.toLowerCase().includes(searchLower) ||
          sale.customer_phone?.toLowerCase().includes(searchLower) ||
          sale.product_name.toLowerCase().includes(searchLower)
        );
      }

      // Sort by date descending
      allSales.sort((a, b) => new Date(b.sale_date).getTime() - new Date(a.sale_date).getTime());

      // Apply limit
      return allSales.slice(0, limit);
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
      // Calculate date range
      let start: Date | null = null;
      let end: Date | null = null;

      if (period !== 'all') {
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
      }

      // Fetch from a010_sales - only completed for summary
      let a010Query = supabase
        .from('a010_sales')
        .select('net_value, sale_date')
        .eq('status', 'completed');

      if (start && end) {
        a010Query = a010Query
          .gte('sale_date', start.toISOString())
          .lte('sale_date', end.toISOString());
      }

      const includeA010 = courseType === 'all' || courseType === 'a010';
      const includeConstruir = courseType === 'all' || courseType === 'construir_para_alugar';

      let a010Data: any[] = [];
      if (includeA010) {
        const { data, error } = await a010Query;
        if (error) throw error;
        a010Data = data || [];
      }

      // Fetch from hubla_transactions
      let hublaQuery = supabase
        .from('hubla_transactions')
        .select('product_price, sale_date, product_name')
        .eq('product_category', 'curso')
        .eq('sale_status', 'completed');

      if (start && end) {
        hublaQuery = hublaQuery
          .gte('sale_date', start.toISOString())
          .lte('sale_date', end.toISOString());
      }

      if (courseType === 'construir_para_alugar') {
        hublaQuery = hublaQuery.ilike('product_name', '%Construir para%');
      } else if (courseType === 'a010') {
        hublaQuery = hublaQuery.ilike('product_name', '%A010%');
      }

      const { data: hublaData, error: hublaError } = await hublaQuery;
      if (hublaError) throw hublaError;

      // Normalize data
      const normalizedA010 = a010Data.map(sale => ({
        product_name: 'A010',
        product_price: sale.net_value || 0,
        sale_date: sale.sale_date,
        source: 'a010_sales' as const,
      }));

      const normalizedHubla = (hublaData || []).map(sale => ({
        product_name: sale.product_name?.toLowerCase().includes('construir') ? 'Construir Para Alugar' : 'A010',
        product_price: sale.product_price || 0,
        sale_date: sale.sale_date,
        source: 'hubla_transactions' as const,
      }));

      const sales = [...normalizedA010, ...normalizedHubla];
      const totalSales = sales.length;
      
      // Calculate gross revenue
      const grossRevenue = sales.reduce((sum, sale) => sum + (sale.product_price || 0), 0);
      
      // Calculate net revenue (apply Hubla fee only to Hubla transactions)
      const netRevenue = sales.reduce((sum, sale) => {
        const price = sale.product_price || 0;
        // A010 from a010_sales table is already net, Hubla needs fee deduction
        return sum + (sale.source === 'hubla_transactions' ? price * HUBLA_NET_MULTIPLIER : price);
      }, 0);
      
      const averageTicket = totalSales > 0 ? netRevenue / totalSales : 0;

      // Separate by course type for comparison
      const a010Sales = sales.filter(s => s.product_name?.toLowerCase().includes('a010'));
      const construirSales = sales.filter(s => s.product_name?.toLowerCase().includes('construir para'));

      const a010GrossRevenue = a010Sales.reduce((sum, sale) => sum + (sale.product_price || 0), 0);
      const a010NetRevenue = a010Sales.reduce((sum, sale) => {
        const price = sale.product_price || 0;
        return sum + (sale.source === 'hubla_transactions' ? price * HUBLA_NET_MULTIPLIER : price);
      }, 0);

      const a010Summary = {
        count: a010Sales.length,
        grossRevenue: a010GrossRevenue,
        netRevenue: a010NetRevenue,
        revenue: a010NetRevenue, // For backward compatibility
        averageTicket: a010Sales.length > 0 ? a010NetRevenue / a010Sales.length : 0
      };

      const construirGrossRevenue = construirSales.reduce((sum, sale) => sum + (sale.product_price || 0), 0);
      const construirNetRevenue = construirSales.reduce((sum, sale) => {
        const price = sale.product_price || 0;
        return sum + (sale.source === 'hubla_transactions' ? price * HUBLA_NET_MULTIPLIER : price);
      }, 0);

      const construirSummary = {
        count: construirSales.length,
        grossRevenue: construirGrossRevenue,
        netRevenue: construirNetRevenue,
        revenue: construirNetRevenue, // For backward compatibility
        averageTicket: construirSales.length > 0 ? construirNetRevenue / construirSales.length : 0
      };

      // Group by custom week for chart (using net revenue)
      const salesByWeek = sales.reduce((acc, sale) => {
        const saleDate = new Date(sale.sale_date);
        const weekNumber = getCustomWeekNumber(saleDate);
        const weekLabel = formatCustomWeekRangeShort(saleDate);
        const courseType = sale.product_name?.toLowerCase().includes('a010') ? 'a010' : 'construir';
        const price = sale.product_price || 0;
        const netPrice = sale.source === 'hubla_transactions' ? price * HUBLA_NET_MULTIPLIER : price;
        
        if (!acc[weekNumber]) {
          acc[weekNumber] = { weekLabel, a010: 0, construir: 0, total: 0 };
        }
        
        if (courseType === 'a010') {
          acc[weekNumber].a010 += netPrice;
        } else {
          acc[weekNumber].construir += netPrice;
        }
        acc[weekNumber].total += netPrice;
        
        return acc;
      }, {} as Record<string, { weekLabel: string; a010: number; construir: number; total: number }>);

      const chartData = Object.entries(salesByWeek)
        .map(([weekNumber, data]) => ({
          weekNumber,
          weekLabel: data.weekLabel,
          a010: data.a010,
          construir: data.construir,
          total: data.total,
        }))
        .sort((a, b) => a.weekNumber.localeCompare(b.weekNumber));

      return {
        totalSales,
        grossRevenue,
        netRevenue,
        totalRevenue: netRevenue, // For backward compatibility
        averageTicket,
        a010Summary,
        construirSummary,
        chartData,
      };
    },
    refetchInterval: 30000,
  });
};
