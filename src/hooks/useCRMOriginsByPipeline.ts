import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface Origin {
  id: string;
  name: string;
  display_name: string | null;
  group_id: string | null;
  contact_count: number;
  deal_count: number;
}

interface Group {
  id: string;
  name: string;
  display_name: string | null;
  children: Origin[];
}

export const useCRMOriginsByPipeline = (pipelineId: string | null) => {
  return useQuery({
    queryKey: ['crm-origins-by-pipeline', pipelineId],
    queryFn: async () => {
      if (!pipelineId) {
        // Se não há pipeline selecionado, retornar todas as origens agrupadas
        const [originsRes, groupsRes] = await Promise.all([
          supabase.from('crm_origins').select('*').order('name'),
          supabase.from('crm_groups').select('*').order('name')
        ]);
        
        if (originsRes.error) throw originsRes.error;
        if (groupsRes.error) throw groupsRes.error;
        
        // Contar deals por origem
        const { data: dealCounts } = await supabase
          .from('crm_deals')
          .select('origin_id');
        
        const dealCountMap = new Map<string, number>();
        dealCounts?.forEach(d => {
          if (d.origin_id) {
            dealCountMap.set(d.origin_id, (dealCountMap.get(d.origin_id) || 0) + 1);
          }
        });
        
        const originsWithCounts = originsRes.data?.map(o => ({
          ...o,
          deal_count: dealCountMap.get(o.id) || 0
        }));
        
        return buildOriginTree(originsWithCounts || [], groupsRes.data || []);
      }
      
      // Buscar o grupo do pipeline selecionado
      const { data: pipeline, error: pipelineError } = await supabase
        .from('crm_origins')
        .select('group_id')
        .eq('id', pipelineId)
        .single();
      
      if (pipelineError) throw pipelineError;
      
      // Buscar todas as origens do mesmo grupo (sub-origens)
      let originsQuery = supabase.from('crm_origins').select('*');
      
      if (pipeline?.group_id) {
        originsQuery = originsQuery.eq('group_id', pipeline.group_id);
      } else {
        // Se não tem grupo, mostrar apenas o próprio pipeline
        originsQuery = originsQuery.eq('id', pipelineId);
      }
      
      const { data: origins, error: originsError } = await originsQuery.order('name');
      if (originsError) throw originsError;
      
      // Contar deals por origem (do pipeline)
      const { data: dealCounts } = await supabase
        .from('crm_deals')
        .select('origin_id')
        .eq('origin_id', pipelineId);
      
      // Também contar para sub-origens se houver
      const originIds = origins?.map(o => o.id) || [];
      const { data: subDealCounts } = await supabase
        .from('crm_deals')
        .select('origin_id')
        .in('origin_id', originIds);
      
      const dealCountMap = new Map<string, number>();
      [...(dealCounts || []), ...(subDealCounts || [])].forEach(d => {
        if (d.origin_id) {
          dealCountMap.set(d.origin_id, (dealCountMap.get(d.origin_id) || 0) + 1);
        }
      });
      
      const originsWithCounts = origins?.map(o => ({
        ...o,
        deal_count: dealCountMap.get(o.id) || 0
      })) || [];
      
      // Retornar como lista flat (não agrupada) para o pipeline específico
      return originsWithCounts;
    },
    enabled: true,
  });
};

// Função para construir árvore de origens agrupadas
function buildOriginTree(origins: any[], groups: any[]): Group[] {
  const groupsMap = new Map<string, Group>();
  groups.forEach(g => {
    groupsMap.set(g.id, { 
      ...g, 
      children: [] 
    });
  });
  
  const ungroupedOrigins: Origin[] = [];
  
  origins.forEach(origin => {
    if (origin.group_id && groupsMap.has(origin.group_id)) {
      groupsMap.get(origin.group_id)!.children.push(origin);
    } else if (!origin.group_id) {
      ungroupedOrigins.push(origin);
    }
  });
  
  const result = Array.from(groupsMap.values()).filter(g => g.children.length > 0);
  
  if (ungroupedOrigins.length > 0) {
    result.push({
      id: '__ungrouped__',
      name: 'Sem Grupo',
      display_name: 'Sem Grupo',
      children: ungroupedOrigins
    });
  }
  
  return result;
}
