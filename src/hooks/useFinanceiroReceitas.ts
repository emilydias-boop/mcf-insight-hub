import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ReceitaFilters, ReceitaItem, ReceitasSummary } from '@/types/financeiro';
import { format, eachDayOfInterval } from 'date-fns';

export const useFinanceiroReceitas = (filters: ReceitaFilters) => {
  const { dataInicial, dataFinal, produto, origem } = filters;

  return useQuery({
    queryKey: ['financeiro-receitas', dataInicial.toISOString(), dataFinal.toISOString(), produto, origem],
    queryFn: async () => {
      let query = supabase
        .from('hubla_transactions')
        .select('*')
        .gte('sale_date', format(dataInicial, 'yyyy-MM-dd'))
        .lte('sale_date', format(dataFinal, 'yyyy-MM-dd') + 'T23:59:59')
        .eq('count_in_dashboard', true)
        .order('sale_date', { ascending: false });

      if (produto) {
        query = query.eq('product_category', produto);
      }
      if (origem) {
        query = query.eq('source', origem);
      }

      const { data, error } = await query;
      if (error) throw error;

      const receitas: ReceitaItem[] = (data || []).map((item) => ({
        id: item.id,
        sale_date: item.sale_date,
        product_name: item.product_name,
        product_category: item.product_category,
        customer_name: item.customer_name,
        customer_email: item.customer_email,
        source: item.source,
        product_price: item.product_price,
        net_value: item.net_value,
        sale_status: item.sale_status,
      }));

      // Calculate summary
      const summary: ReceitasSummary = {
        faturamentoBruto: receitas.reduce((sum, r) => sum + (r.product_price || 0), 0),
        faturamentoLiquido: receitas.reduce((sum, r) => sum + (r.net_value || 0), 0),
        numeroContratos: receitas.length,
        ticketMedio: receitas.length > 0 
          ? receitas.reduce((sum, r) => sum + (r.net_value || 0), 0) / receitas.length 
          : 0,
      };

      // Calculate daily data for chart
      const days = eachDayOfInterval({ start: dataInicial, end: dataFinal });
      const chartData = days.map((day) => {
        const dayStr = format(day, 'yyyy-MM-dd');
        const dayReceitas = receitas.filter((r) => r.sale_date.startsWith(dayStr));
        return {
          date: format(day, 'dd/MM'),
          bruto: dayReceitas.reduce((sum, r) => sum + (r.product_price || 0), 0),
          liquido: dayReceitas.reduce((sum, r) => sum + (r.net_value || 0), 0),
        };
      });

      return { receitas, summary, chartData };
    },
  });
};
