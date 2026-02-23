import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, format } from 'date-fns';
import { CONSORCIO_WEEK_STARTS_ON } from '@/lib/businessDays';

export interface ProdutoFechadoMetric {
  id: string;
  label: string;
  day: number;
  week: number;
  month: number;
}

export interface ConsorcioProdutosFechadosMetrics {
  products: ProdutoFechadoMetric[];
  isLoading: boolean;
}

export function useConsorcioProdutosFechadosMetrics(): ConsorcioProdutosFechadosMetrics {
  const today = new Date();
  const todayNormalized = startOfDay(today);

  const dayStart = format(startOfDay(today), "yyyy-MM-dd'T'HH:mm:ss");
  const dayEnd = format(endOfDay(today), "yyyy-MM-dd'T'HH:mm:ss");
  const weekStart = format(startOfWeek(todayNormalized, { weekStartsOn: CONSORCIO_WEEK_STARTS_ON }), "yyyy-MM-dd'T'HH:mm:ss");
  const weekEnd = format(endOfWeek(todayNormalized, { weekStartsOn: CONSORCIO_WEEK_STARTS_ON }), "yyyy-MM-dd'T'HH:mm:ss");
  const monthStart = format(startOfMonth(today), "yyyy-MM-dd'T'HH:mm:ss");
  const monthEnd = format(endOfMonth(today), "yyyy-MM-dd'T'HH:mm:ss");

  // Fetch active product options
  const { data: options = [], isLoading: optionsLoading } = useQuery({
    queryKey: ['produto-fechado-options-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('consorcio_produto_adquirido_options' as any)
        .select('id, label, name')
        .eq('is_active', true)
        .order('display_order', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as { id: string; label: string; name: string }[];
    },
  });

  // Fetch all deal_produtos_adquiridos for the month
  const { data: records = [], isLoading: recordsLoading } = useQuery({
    queryKey: ['produtos-fechados-metrics', monthStart],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deal_produtos_adquiridos' as any)
        .select('id, produto_option_id, created_at')
        .gte('created_at', monthStart)
        .lte('created_at', monthEnd);
      if (error) throw error;
      return (data || []) as unknown as { id: string; produto_option_id: string; created_at: string }[];
    },
  });

  const products: ProdutoFechadoMetric[] = options.map((opt) => {
    const optRecords = records.filter((r) => r.produto_option_id === opt.id);
    return {
      id: opt.id,
      label: opt.label,
      day: optRecords.filter((r) => r.created_at >= dayStart && r.created_at <= dayEnd).length,
      week: optRecords.filter((r) => r.created_at >= weekStart && r.created_at <= weekEnd).length,
      month: optRecords.length,
    };
  });

  return {
    products,
    isLoading: optionsLoading || recordsLoading,
  };
}
