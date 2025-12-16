import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CRMGroup {
  id: string;
  name: string;
  display_name: string | null;
  description: string | null;
  is_favorite: boolean;
  deal_count: number;
  origins: CRMGroupOrigin[];
}

export interface CRMGroupOrigin {
  id: string;
  name: string;
  display_name: string | null;
  deal_count: number;
}

export const useCRMGroupsForSidebar = () => {
  return useQuery({
    queryKey: ['crm-groups-sidebar'],
    queryFn: async () => {
      // Buscar grupos
      const { data: groups, error: groupsError } = await supabase
        .from('crm_groups')
        .select('*')
        .order('is_favorite', { ascending: false })
        .order('name');
      
      if (groupsError) throw groupsError;
      
      // Buscar origens com seus grupos
      const { data: origins, error: originsError } = await supabase
        .from('crm_origins')
        .select('id, name, display_name, group_id')
        .order('name');
      
      if (originsError) throw originsError;
      
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
      
      // Montar estrutura de grupos com origens
      const groupsWithOrigins: CRMGroup[] = groups?.map(group => {
        const groupOrigins = origins
          ?.filter(o => o.group_id === group.id)
          .map(o => ({
            id: o.id,
            name: o.name,
            display_name: o.display_name,
            deal_count: dealCountMap.get(o.id) || 0
          })) || [];
        
        const totalDeals = groupOrigins.reduce((sum, o) => sum + o.deal_count, 0);
        
        return {
          id: group.id,
          name: group.name,
          display_name: group.display_name,
          description: group.description,
          is_favorite: group.is_favorite || false,
          deal_count: totalDeals,
          origins: groupOrigins
        };
      }) || [];
      
      // Adicionar origens sem grupo
      const ungroupedOrigins = origins
        ?.filter(o => !o.group_id)
        .map(o => ({
          id: o.id,
          name: o.name,
          display_name: o.display_name,
          deal_count: dealCountMap.get(o.id) || 0
        })) || [];
      
      if (ungroupedOrigins.length > 0) {
        const totalUngroupedDeals = ungroupedOrigins.reduce((sum, o) => sum + o.deal_count, 0);
        groupsWithOrigins.push({
          id: '__ungrouped__',
          name: 'Sem Grupo',
          display_name: 'Sem Grupo',
          description: null,
          is_favorite: false,
          deal_count: totalUngroupedDeals,
          origins: ungroupedOrigins
        });
      }
      
      // Ordenar: favoritos primeiro, depois por nome
      return groupsWithOrigins.sort((a, b) => {
        if (a.is_favorite && !b.is_favorite) return -1;
        if (!a.is_favorite && b.is_favorite) return 1;
        return a.name.localeCompare(b.name);
      });
    },
  });
};

export const useToggleGroupFavorite = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ groupId, isFavorite }: { groupId: string; isFavorite: boolean }) => {
      const { error } = await supabase
        .from('crm_groups')
        .update({ is_favorite: isFavorite })
        .eq('id', groupId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-groups-sidebar'] });
    },
  });
};
