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

export const useCRMOriginsByPipeline = (pipelineId: string | null | undefined) => {
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
      
      // Verificar se pipelineId é um group_id ou um origin_id
      // Primeiro, tentar buscar como grupo
      const { data: groupCheck } = await supabase
        .from('crm_groups')
        .select('id')
        .eq('id', pipelineId)
        .maybeSingle();
      
      // Se existir como grupo, buscar origens do grupo
      if (groupCheck) {
        const { data: origins, error: originsError } = await supabase
          .from('crm_origins')
          .select('*')
          .eq('group_id', pipelineId)
          .order('name');
        
        if (originsError) throw originsError;
        
        // Contar deals para as origens do grupo
        const originIds = origins?.map(o => o.id) || [];
        const { data: dealCounts } = originIds.length > 0 
          ? await supabase
              .from('crm_deals')
              .select('origin_id')
              .in('origin_id', originIds)
          : { data: [] };
        
        const dealCountMap = new Map<string, number>();
        dealCounts?.forEach(d => {
          if (d.origin_id) {
            dealCountMap.set(d.origin_id, (dealCountMap.get(d.origin_id) || 0) + 1);
          }
        });
        
        return origins?.map(o => ({
          ...o,
          deal_count: dealCountMap.get(o.id) || 0
        })) || [];
      }
      
      // Se não é grupo, tentar como origin_id diretamente
      const { data: originCheck } = await supabase
        .from('crm_origins')
        .select('*')
        .eq('id', pipelineId)
        .maybeSingle();
      
      if (originCheck) {
        // pipelineId era na verdade um originId
        // Contar deals dessa origem
        const { data: dealCounts } = await supabase
          .from('crm_deals')
          .select('origin_id')
          .eq('origin_id', pipelineId);
        
        return [{
          ...originCheck,
          deal_count: dealCounts?.length || 0
        }];
      }
      
      // Não encontrou nem como grupo nem como origem
      return [];
    },
    staleTime: 0, // Forçar refresh
    enabled: true,
  });
};

// Função para construir árvore de origens agrupadas
function buildOriginTree(origins: any[], groups: any[]): Group[] {
  // Criar mapa de grupos com estrutura limpa
  const groupsMap = new Map<string, Group>();
  groups.forEach(g => {
    groupsMap.set(g.id, { 
      id: g.id,
      name: g.name,
      display_name: g.display_name,
      children: [] as Origin[]
    });
  });
  
  const ungroupedOrigins: Origin[] = [];
  
  // Associar origens aos grupos
  origins.forEach(origin => {
    const originData: Origin = {
      id: origin.id,
      name: origin.name,
      display_name: origin.display_name,
      group_id: origin.group_id,
      contact_count: origin.contact_count || 0,
      deal_count: origin.deal_count || 0
    };
    
    if (origin.group_id && groupsMap.has(origin.group_id)) {
      const group = groupsMap.get(origin.group_id)!;
      group.children.push(originData);
    } else {
      ungroupedOrigins.push(originData);
    }
  });
  
  const result = Array.from(groupsMap.values());
  
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
