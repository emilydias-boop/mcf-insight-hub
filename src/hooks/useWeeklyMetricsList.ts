import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface WeeklyMetricsRow {
  id: string;
  start_date: string;
  end_date: string;
  week_label: string;
  approval_status: string | null;
  approved_at: string | null;
  approved_by: string | null;
  approval_notes: string | null;
  
  // Receitas
  a010_revenue: number;
  a010_sales: number;
  ob_construir_revenue: number;
  ob_construir_sales: number;
  ob_vitalicio_revenue: number;
  ob_vitalicio_sales: number;
  ob_evento_revenue: number;
  ob_evento_sales: number;
  contract_revenue: number;
  contract_sales: number;
  clint_revenue: number;
  incorporador_50k: number;
  total_revenue: number | null;
  faturamento_total?: number;
  
  // Custos
  ads_cost: number;
  team_cost: number;
  office_cost: number;
  operating_cost: number | null;
  real_cost: number | null;
  total_cost?: number;
  
  // Métricas
  operating_profit: number | null;
  roi: number | null;
  roas: number | null;
  cpl: number | null;
  ultrameta_clint: number | null;
  ultrameta_liquido: number | null;
  
  // Timestamps
  created_at: string;
  updated_at: string;
}

interface UseWeeklyMetricsListOptions {
  limit?: number;
  status?: 'all' | 'pending' | 'approved' | 'rejected';
}

export function useWeeklyMetricsList(options: UseWeeklyMetricsListOptions = {}) {
  const { limit = 52, status = 'all' } = options;

  return useQuery({
    queryKey: ['weekly-metrics-list', limit, status],
    queryFn: async () => {
      let query = supabase
        .from('weekly_metrics')
        .select('*')
        .order('start_date', { ascending: false })
        .limit(limit);

      if (status !== 'all') {
        query = query.eq('approval_status', status);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      return data as WeeklyMetricsRow[];
    },
  });
}

// Hook para buscar transações de uma semana específica
export function useWeekTransactions(startDate: string, endDate: string, enabled = true) {
  return useQuery({
    queryKey: ['week-transactions', startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('hubla_transactions')
        .select('*')
        .gte('sale_date', startDate)
        .lt('sale_date', `${endDate}T23:59:59`)
        .order('sale_date', { ascending: false });

      if (error) throw error;
      
      // Agrupar por categoria
      const grouped = {
        a010: [] as any[],
        orderbump_construir: [] as any[],
        orderbump_vitalicio: [] as any[],
        orderbump_evento: [] as any[],
        incorporador_50k: [] as any[],
        parceria: [] as any[],
        contrato: [] as any[],
        outros: [] as any[],
      };
      
      const summary = {
        total_transactions: data?.length || 0,
        total_revenue: 0,
        by_category: {} as Record<string, { count: number; revenue: number }>,
        incorporador_unique_emails: new Set<string>(),
      };
      
      data?.forEach((tx) => {
        const category = tx.product_category || 'outros';
        const netValue = tx.net_value || 0;
        const countsInDashboard = tx.count_in_dashboard !== false;
        
        // Agrupar
        if (category === 'a010') {
          grouped.a010.push(tx);
        } else if (category === 'orderbump_construir') {
          grouped.orderbump_construir.push(tx);
        } else if (category === 'orderbump_vitalicio') {
          grouped.orderbump_vitalicio.push(tx);
        } else if (category === 'orderbump_evento') {
          grouped.orderbump_evento.push(tx);
        } else if (category === 'incorporador_50k') {
          grouped.incorporador_50k.push(tx);
          if (tx.customer_email) {
            summary.incorporador_unique_emails.add(tx.customer_email.toLowerCase().trim());
          }
        } else if (category === 'parceria') {
          grouped.parceria.push(tx);
        } else if (category === 'contrato') {
          grouped.contrato.push(tx);
        } else {
          grouped.outros.push(tx);
        }
        
        // Contabilizar
        if (countsInDashboard) {
          summary.total_revenue += netValue;
          if (!summary.by_category[category]) {
            summary.by_category[category] = { count: 0, revenue: 0 };
          }
          summary.by_category[category].count++;
          summary.by_category[category].revenue += netValue;
        }
      });
      
      return {
        transactions: data || [],
        grouped,
        summary: {
          ...summary,
          incorporador_unique_emails: summary.incorporador_unique_emails.size,
        },
      };
    },
    enabled,
  });
}

// Hook para buscar custos de uma semana específica
export function useWeekCosts(startDate: string, endDate: string, enabled = true) {
  return useQuery({
    queryKey: ['week-costs', startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_costs')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false });

      if (error) throw error;
      
      // Agrupar por tipo
      const byType: Record<string, { count: number; amount: number }> = {};
      let total = 0;
      
      data?.forEach((cost) => {
        const type = cost.cost_type || 'outros';
        if (!byType[type]) {
          byType[type] = { count: 0, amount: 0 };
        }
        byType[type].count++;
        byType[type].amount += cost.amount || 0;
        total += cost.amount || 0;
      });
      
      return {
        costs: data || [],
        byType,
        total,
      };
    },
    enabled,
  });
}
