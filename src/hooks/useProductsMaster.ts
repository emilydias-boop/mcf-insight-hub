import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { 
  SetorType, 
  SetorSummary, 
  ProductSummary, 
  PersonPerformance,
  PeriodFilter,
  SETORES_CONFIG,
  ConsorcioCard
} from '@/types/produtos';
import { PRODUCT_CATEGORIES } from '@/types/financeiro';
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns';

// Helper to get category label
const getCategoryLabel = (category: string): string => {
  const found = PRODUCT_CATEGORIES.find(c => c.value === category);
  return found?.label || category;
};

// Helper to calculate variation percentage
const calcVariation = (current: number, previous: number): number => {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
};

// Get period filter based on type
export const getPeriodFilter = (type: 'month' | 'lastMonth' | 'week' | 'custom', customStart?: Date, customEnd?: Date): PeriodFilter => {
  const now = new Date();
  
  if (type === 'month') {
    const startDate = startOfMonth(now);
    const endDate = endOfMonth(now);
    const previousStartDate = startOfMonth(subMonths(now, 1));
    const previousEndDate = endOfMonth(subMonths(now, 1));
    return { startDate, endDate, previousStartDate, previousEndDate, label: 'Mês Atual' };
  }
  
  if (type === 'lastMonth') {
    const startDate = startOfMonth(subMonths(now, 1));
    const endDate = endOfMonth(subMonths(now, 1));
    const previousStartDate = startOfMonth(subMonths(now, 2));
    const previousEndDate = endOfMonth(subMonths(now, 2));
    return { startDate, endDate, previousStartDate, previousEndDate, label: 'Mês Passado' };
  }
  
  if (type === 'custom' && customStart && customEnd) {
    const daysDiff = Math.ceil((customEnd.getTime() - customStart.getTime()) / (1000 * 60 * 60 * 24));
    const previousEndDate = new Date(customStart);
    previousEndDate.setDate(previousEndDate.getDate() - 1);
    const previousStartDate = new Date(previousEndDate);
    previousStartDate.setDate(previousStartDate.getDate() - daysDiff);
    return { 
      startDate: customStart, 
      endDate: customEnd, 
      previousStartDate, 
      previousEndDate, 
      label: 'Período Customizado' 
    };
  }
  
  // Default: current month
  const startDate = startOfMonth(now);
  const endDate = endOfMonth(now);
  const previousStartDate = startOfMonth(subMonths(now, 1));
  const previousEndDate = endOfMonth(subMonths(now, 1));
  return { startDate, endDate, previousStartDate, previousEndDate, label: 'Mês Atual' };
};

// Hook to get all setores summary
export const useSetoresSummary = (period: PeriodFilter) => {
  return useQuery({
    queryKey: ['setores-summary', period.startDate, period.endDate],
    queryFn: async (): Promise<SetorSummary[]> => {
      const startStr = format(period.startDate, 'yyyy-MM-dd');
      const endStr = format(period.endDate, 'yyyy-MM-dd');
      const prevStartStr = format(period.previousStartDate, 'yyyy-MM-dd');
      const prevEndStr = format(period.previousEndDate, 'yyyy-MM-dd');
      
      // Get current period data from hubla_transactions
      const { data: currentData, error: currentError } = await supabase
        .from('hubla_transactions')
        .select('product_category, net_value')
        .gte('sale_date', startStr)
        .lte('sale_date', endStr)
        .eq('count_in_dashboard', true);
      
      if (currentError) throw currentError;
      
      // Get previous period data
      const { data: previousData, error: previousError } = await supabase
        .from('hubla_transactions')
        .select('product_category, net_value')
        .gte('sale_date', prevStartStr)
        .lte('sale_date', prevEndStr)
        .eq('count_in_dashboard', true);
      
      if (previousError) throw previousError;
      
      // Get consortium data for current period
      const { data: consorcioData, error: consorcioError } = await supabase
        .from('consortium_payments')
        .select('valor_comissao')
        .gte('data_interface', startStr)
        .lte('data_interface', endStr);
      
      if (consorcioError) throw consorcioError;
      
      // Get consortium data for previous period
      const { data: consorcioPrevData, error: consorcioPrevError } = await supabase
        .from('consortium_payments')
        .select('valor_comissao')
        .gte('data_interface', prevStartStr)
        .lte('data_interface', prevEndStr);
      
      if (consorcioPrevError) throw consorcioPrevError;
      
      // Aggregate by setor
      const setores: SetorSummary[] = Object.values(SETORES_CONFIG).map(setor => {
        let total = 0;
        let quantidade = 0;
        let totalAnterior = 0;
        let quantidadeAnterior = 0;
        
        if (setor.id === 'consorcio') {
          // Use consortium_payments table
          consorcioData?.forEach(item => {
            total += item.valor_comissao || 0;
            quantidade++;
          });
          consorcioPrevData?.forEach(item => {
            totalAnterior += item.valor_comissao || 0;
            quantidadeAnterior++;
          });
        } else {
          // Use hubla_transactions
          currentData?.forEach(item => {
            if (setor.categories.includes(item.product_category || '')) {
              total += item.net_value || 0;
              quantidade++;
            }
          });
          previousData?.forEach(item => {
            if (setor.categories.includes(item.product_category || '')) {
              totalAnterior += item.net_value || 0;
              quantidadeAnterior++;
            }
          });
        }
        
        return {
          setor: setor.id,
          total,
          quantidade,
          ticketMedio: quantidade > 0 ? total / quantidade : 0,
          variacao: calcVariation(total, totalAnterior),
          totalAnterior
        };
      });
      
      return setores;
    },
    refetchInterval: 60000
  });
};

// Hook to get products by setor
export const useProductsBySetor = (setor: SetorType, period: PeriodFilter) => {
  const config = SETORES_CONFIG[setor];
  
  return useQuery({
    queryKey: ['products-by-setor', setor, period.startDate, period.endDate],
    queryFn: async (): Promise<ProductSummary[]> => {
      const startStr = format(period.startDate, 'yyyy-MM-dd');
      const endStr = format(period.endDate, 'yyyy-MM-dd');
      const prevStartStr = format(period.previousStartDate, 'yyyy-MM-dd');
      const prevEndStr = format(period.previousEndDate, 'yyyy-MM-dd');
      
      if (setor === 'consorcio') {
        // Special handling for consorcio
        const { data: current } = await supabase
          .from('consortium_payments')
          .select('*')
          .gte('data_interface', startStr)
          .lte('data_interface', endStr);
        
        const { data: previous } = await supabase
          .from('consortium_payments')
          .select('*')
          .gte('data_interface', prevStartStr)
          .lte('data_interface', prevEndStr);
        
        const total = current?.reduce((sum, item) => sum + (item.valor_comissao || 0), 0) || 0;
        const quantidade = current?.length || 0;
        const totalAnterior = previous?.reduce((sum, item) => sum + (item.valor_comissao || 0), 0) || 0;
        
        return [{
          category: 'consorcio',
          categoryLabel: 'Cartas de Consórcio',
          total,
          quantidade,
          ticketMedio: quantidade > 0 ? total / quantidade : 0,
          variacao: calcVariation(total, totalAnterior)
        }];
      }
      
      // Get current period
      const { data: currentData, error } = await supabase
        .from('hubla_transactions')
        .select('product_category, net_value')
        .gte('sale_date', startStr)
        .lte('sale_date', endStr)
        .eq('count_in_dashboard', true)
        .in('product_category', config.categories);
      
      if (error) throw error;
      
      // Get previous period
      const { data: previousData } = await supabase
        .from('hubla_transactions')
        .select('product_category, net_value')
        .gte('sale_date', prevStartStr)
        .lte('sale_date', prevEndStr)
        .eq('count_in_dashboard', true)
        .in('product_category', config.categories);
      
      // Group by category
      const categoryMap = new Map<string, { total: number; quantidade: number }>();
      const prevCategoryMap = new Map<string, number>();
      
      currentData?.forEach(item => {
        const cat = item.product_category || 'outros';
        const existing = categoryMap.get(cat) || { total: 0, quantidade: 0 };
        existing.total += item.net_value || 0;
        existing.quantidade++;
        categoryMap.set(cat, existing);
      });
      
      previousData?.forEach(item => {
        const cat = item.product_category || 'outros';
        const existing = prevCategoryMap.get(cat) || 0;
        prevCategoryMap.set(cat, existing + (item.net_value || 0));
      });
      
      const products: ProductSummary[] = [];
      categoryMap.forEach((value, category) => {
        const prevTotal = prevCategoryMap.get(category) || 0;
        products.push({
          category,
          categoryLabel: getCategoryLabel(category),
          total: value.total,
          quantidade: value.quantidade,
          ticketMedio: value.quantidade > 0 ? value.total / value.quantidade : 0,
          variacao: calcVariation(value.total, prevTotal)
        });
      });
      
      return products.sort((a, b) => b.total - a.total);
    },
    enabled: !!setor
  });
};

// Hook to get performance by SDR/Closer
export const usePerformanceByPerson = (setor: SetorType, period: PeriodFilter) => {
  const config = SETORES_CONFIG[setor];
  
  return useQuery({
    queryKey: ['performance-by-person', setor, period.startDate, period.endDate],
    queryFn: async (): Promise<PersonPerformance[]> => {
      const startStr = format(period.startDate, 'yyyy-MM-dd');
      const endStr = format(period.endDate, 'yyyy-MM-dd');
      const prevStartStr = format(period.previousStartDate, 'yyyy-MM-dd');
      const prevEndStr = format(period.previousEndDate, 'yyyy-MM-dd');
      
      if (setor === 'consorcio') {
        // Get consortium by vendedor
        const { data: current } = await supabase
          .from('consortium_payments')
          .select('vendedor_id, vendedor_name, valor_comissao')
          .gte('data_interface', startStr)
          .lte('data_interface', endStr);
        
        const { data: previous } = await supabase
          .from('consortium_payments')
          .select('vendedor_id, vendedor_name, valor_comissao')
          .gte('data_interface', prevStartStr)
          .lte('data_interface', prevEndStr);
        
        // Group by vendedor
        const vendedorMap = new Map<string, { name: string; total: number; quantidade: number }>();
        const prevVendedorMap = new Map<string, number>();
        
        current?.forEach(item => {
          const key = item.vendedor_id || item.vendedor_name || 'Sem vendedor';
          const existing = vendedorMap.get(key) || { name: item.vendedor_name || 'Sem vendedor', total: 0, quantidade: 0 };
          existing.total += item.valor_comissao || 0;
          existing.quantidade++;
          vendedorMap.set(key, existing);
        });
        
        previous?.forEach(item => {
          const key = item.vendedor_id || item.vendedor_name || 'Sem vendedor';
          const existing = prevVendedorMap.get(key) || 0;
          prevVendedorMap.set(key, existing + (item.valor_comissao || 0));
        });
        
        const result: PersonPerformance[] = [];
        vendedorMap.forEach((value, key) => {
          const prevTotal = prevVendedorMap.get(key) || 0;
          result.push({
            id: key,
            name: value.name,
            role: 'vendedor',
            total: value.total,
            quantidade: value.quantidade,
            ticketMedio: value.quantidade > 0 ? value.total / value.quantidade : 0,
            variacao: calcVariation(value.total, prevTotal)
          });
        });
        
        return result.sort((a, b) => b.total - a.total);
      }
      
      // For Inside: Get SDR intermediacoes
      const { data: intermediacoes } = await supabase
        .from('sdr_intermediacoes')
        .select(`
          sdr_id,
          sale_value,
          sdr:sdr_id (
            nome,
            email
          )
        `)
        .gte('sale_date', startStr)
        .lte('sale_date', endStr);
      
      const { data: prevIntermediates } = await supabase
        .from('sdr_intermediacoes')
        .select('sdr_id, sale_value')
        .gte('sale_date', prevStartStr)
        .lte('sale_date', prevEndStr);
      
      // Group by SDR
      const sdrMap = new Map<string, { name: string; email?: string; total: number; quantidade: number }>();
      const prevSdrMap = new Map<string, number>();
      
      intermediacoes?.forEach((item: any) => {
        const sdrId = item.sdr_id;
        if (!sdrId) return;
        const existing = sdrMap.get(sdrId) || { 
          name: item.sdr?.nome || 'SDR', 
          email: item.sdr?.email,
          total: 0, 
          quantidade: 0 
        };
        existing.total += item.sale_value || 0;
        existing.quantidade++;
        sdrMap.set(sdrId, existing);
      });
      
      prevIntermediates?.forEach((item: any) => {
        const sdrId = item.sdr_id;
        if (!sdrId) return;
        const existing = prevSdrMap.get(sdrId) || 0;
        prevSdrMap.set(sdrId, existing + (item.sale_value || 0));
      });
      
      const result: PersonPerformance[] = [];
      sdrMap.forEach((value, key) => {
        const prevTotal = prevSdrMap.get(key) || 0;
        result.push({
          id: key,
          name: value.name,
          email: value.email,
          role: 'sdr',
          total: value.total,
          quantidade: value.quantidade,
          ticketMedio: value.quantidade > 0 ? value.total / value.quantidade : 0,
          variacao: calcVariation(value.total, prevTotal)
        });
      });
      
      return result.sort((a, b) => b.total - a.total);
    },
    enabled: !!setor
  });
};

// Hook to get consortium cards
export const useConsorcioCards = (period: PeriodFilter) => {
  return useQuery({
    queryKey: ['consorcio-cards', period.startDate, period.endDate],
    queryFn: async (): Promise<ConsorcioCard[]> => {
      const startStr = format(period.startDate, 'yyyy-MM-dd');
      const endStr = format(period.endDate, 'yyyy-MM-dd');
      
      const { data, error } = await supabase
        .from('consortium_payments')
        .select('*')
        .gte('data_interface', startStr)
        .lte('data_interface', endStr)
        .order('data_interface', { ascending: false });
      
      if (error) throw error;
      
      return data || [];
    }
  });
};
