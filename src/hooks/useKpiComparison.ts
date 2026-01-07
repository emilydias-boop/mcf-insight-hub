import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, addMonths, startOfMonth } from 'date-fns';

interface KpiComparisonItem {
  sdr_id: string;
  sdr_name: string;
  sdr_email: string;
  kpi_atual: number;
  atividades_reais: number;
  diferenca: number;
}

interface KpiComparisonResult {
  items: KpiComparisonItem[];
  total_diferenca: number;
  total_kpi: number;
  total_atividades: number;
}

export const useKpiComparison = (anoMes?: string) => {
  const targetMonth = anoMes || format(new Date(), 'yyyy-MM');
  
  return useQuery({
    queryKey: ['kpi-comparison', targetMonth],
    queryFn: async (): Promise<KpiComparisonResult> => {
      // Fetch active SDRs
      const { data: sdrs, error: sdrsError } = await supabase
        .from('sdr')
        .select('id, email, name')
        .eq('active', true);

      if (sdrsError) throw sdrsError;
      if (!sdrs || sdrs.length === 0) {
        return { items: [], total_diferenca: 0, total_kpi: 0, total_atividades: 0 };
      }

      // Fetch current KPIs
      const { data: kpis, error: kpisError } = await supabase
        .from('sdr_month_kpi')
        .select('sdr_id, reunioes_agendadas')
        .eq('ano_mes', targetMonth);

      if (kpisError) throw kpisError;

      // Calculate date range for the month
      const startDate = `${targetMonth}-01`;
      const endDate = format(addMonths(startOfMonth(new Date(startDate)), 1), 'yyyy-MM-dd');

      // Fetch activities with owner_email in metadata for "Reunião 01 Agendada"
      const { data: activities, error: activitiesError } = await supabase
        .from('deal_activities')
        .select('metadata')
        .ilike('to_stage', '%Reunião 01 Agendada%')
        .gte('created_at', startDate)
        .lt('created_at', endDate);

      if (activitiesError) throw activitiesError;

      // Count activities by owner_email or deal_user
      const activityCountByEmail: Record<string, number> = {};
      activities?.forEach((activity) => {
        const metadata = activity.metadata as any;
        const ownerEmail = metadata?.owner_email || metadata?.deal_user;
        if (ownerEmail) {
          activityCountByEmail[ownerEmail] = (activityCountByEmail[ownerEmail] || 0) + 1;
        }
      });

      // Build comparison items
      const items: KpiComparisonItem[] = sdrs.map((sdr) => {
        const kpiAtual = kpis?.find((k) => k.sdr_id === sdr.id)?.reunioes_agendadas || 0;
        const atividadesReais = activityCountByEmail[sdr.email] || 0;
        
        return {
          sdr_id: sdr.id,
          sdr_name: sdr.name,
          sdr_email: sdr.email,
          kpi_atual: kpiAtual,
          atividades_reais: atividadesReais,
          diferenca: atividadesReais - kpiAtual,
        };
      });

      // Sort by difference descending
      items.sort((a, b) => b.diferenca - a.diferenca);

      const total_kpi = items.reduce((sum, i) => sum + i.kpi_atual, 0);
      const total_atividades = items.reduce((sum, i) => sum + i.atividades_reais, 0);
      const total_diferenca = total_atividades - total_kpi;

      return { items, total_diferenca, total_kpi, total_atividades };
    },
    staleTime: 30000,
  });
};
