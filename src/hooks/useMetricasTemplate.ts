import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface MetricaTemplate {
  id: string;
  cargo_catalogo_id: string;
  nome_metrica: string;
  label_exibicao: string;
  peso_percentual: number;
  meta_percentual: number | null;
  ativo: boolean;
}

/**
 * Hook to fetch default metric templates for a cargo from cargo_metricas_padrao table.
 * This serves as the "source of truth" for new months.
 */
export const useMetricasTemplate = (cargoId: string | undefined) => {
  return useQuery({
    queryKey: ['metricas-template', cargoId],
    queryFn: async () => {
      if (!cargoId) return [];
      
      const { data, error } = await supabase
        .from('cargo_metricas_padrao')
        .select('*')
        .eq('cargo_catalogo_id', cargoId)
        .eq('ativo', true)
        .order('created_at', { ascending: true });
      
      if (error) {
        console.error('Error fetching metrics template:', error);
        return [];
      }
      
      return data as MetricaTemplate[];
    },
    enabled: !!cargoId,
    staleTime: 10 * 60 * 1000, // 10 minutes - templates don't change often
  });
};

/**
 * Helper function to get previous month in YYYY-MM format
 */
export const getPreviousMonth = (anoMes: string): string => {
  const [year, month] = anoMes.split('-').map(Number);
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  return `${prevYear}-${String(prevMonth).padStart(2, '0')}`;
};

/**
 * Auto-copy metrics from template or previous month to current month.
 * Returns the source used: 'existing', 'previous_month', 'template', or 'fallback'.
 */
export const ensureMetricsForMonth = async (
  anoMes: string,
  cargoId: string,
  squad?: string | null
): Promise<'existing' | 'previous_month' | 'template' | 'fallback'> => {
  // Step 1: Check if metrics exist for current month
  let query = supabase
    .from('fechamento_metricas_mes')
    .select('id')
    .eq('ano_mes', anoMes)
    .eq('cargo_catalogo_id', cargoId)
    .eq('ativo', true);
  
  if (squad) {
    query = query.eq('squad', squad);
  } else {
    query = query.is('squad', null);
  }
  
  const { data: existingMetrics, error: existingError } = await query.limit(1);
  
  if (existingError) {
    console.error('Error checking existing metrics:', existingError);
    return 'fallback';
  }
  
  if (existingMetrics && existingMetrics.length > 0) {
    return 'existing';
  }
  
  // Step 2: Try to copy from previous month
  const prevMonth = getPreviousMonth(anoMes);
  let prevQuery = supabase
    .from('fechamento_metricas_mes')
    .select('*')
    .eq('ano_mes', prevMonth)
    .eq('cargo_catalogo_id', cargoId)
    .eq('ativo', true);
  
  if (squad) {
    prevQuery = prevQuery.eq('squad', squad);
  } else {
    prevQuery = prevQuery.is('squad', null);
  }
  
  const { data: prevMetrics, error: prevError } = await prevQuery;
  
  if (!prevError && prevMetrics && prevMetrics.length > 0) {
    // Copy from previous month
    const newMetrics = prevMetrics.map(m => ({
      ano_mes: anoMes,
      cargo_catalogo_id: m.cargo_catalogo_id,
      squad: m.squad,
      nome_metrica: m.nome_metrica,
      label_exibicao: m.label_exibicao,
      peso_percentual: m.peso_percentual,
      meta_valor: m.meta_valor,
      meta_percentual: m.meta_percentual,
      fonte_dados: m.fonte_dados,
      ativo: true,
    }));
    
    const { error: insertError } = await supabase
      .from('fechamento_metricas_mes')
      .insert(newMetrics);
    
    if (insertError) {
      console.error('Error copying metrics from previous month:', insertError);
    } else {
      console.log(`Copied ${newMetrics.length} metrics from ${prevMonth} to ${anoMes}`);
      return 'previous_month';
    }
  }
  
  // Step 3: Try to copy from template (cargo_metricas_padrao)
  const { data: templateMetrics, error: templateError } = await supabase
    .from('cargo_metricas_padrao')
    .select('*')
    .eq('cargo_catalogo_id', cargoId)
    .eq('ativo', true);
  
  if (!templateError && templateMetrics && templateMetrics.length > 0) {
    const newMetrics = templateMetrics.map(m => ({
      ano_mes: anoMes,
      cargo_catalogo_id: m.cargo_catalogo_id,
      squad: squad || null,
      nome_metrica: m.nome_metrica,
      label_exibicao: m.label_exibicao,
      peso_percentual: m.peso_percentual,
      meta_percentual: m.meta_percentual,
      ativo: true,
    }));
    
    const { error: insertError } = await supabase
      .from('fechamento_metricas_mes')
      .insert(newMetrics);
    
    if (insertError) {
      console.error('Error copying metrics from template:', insertError);
    } else {
      console.log(`Copied ${newMetrics.length} metrics from template to ${anoMes}`);
      return 'template';
    }
  }
  
  // Step 4: Fallback - no metrics found anywhere
  return 'fallback';
};
