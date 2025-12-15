import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ManagedOrigin {
  id: string;
  name: string;
  display_name: string | null;
  description: string | null;
  clint_id: string;
  group_id: string | null;
  parent_id: string | null;
  pipeline_type: string | null;
  contact_count: number | null;
  created_at: string | null;
  updated_at: string | null;
  // Computed fields
  group_name?: string;
  parent_name?: string;
  deal_count?: number;
}

export interface OriginUpdate {
  id: string;
  display_name?: string | null;
  parent_id?: string | null;
  pipeline_type?: string | null;
  description?: string | null;
}

export function useOriginManagement() {
  const queryClient = useQueryClient();

  const { data: origins, isLoading, error } = useQuery({
    queryKey: ['origin-management'],
    queryFn: async (): Promise<ManagedOrigin[]> => {
      // Fetch origins with group names
      const { data: originsData, error: originsError } = await supabase
        .from('crm_origins')
        .select(`
          id,
          name,
          display_name,
          description,
          clint_id,
          group_id,
          parent_id,
          pipeline_type,
          contact_count,
          created_at,
          updated_at
        `)
        .order('name');

      if (originsError) throw originsError;

      // Fetch groups for name mapping
      const { data: groupsData } = await supabase
        .from('crm_groups')
        .select('id, name, display_name');

      const groupMap = new Map(
        (groupsData || []).map(g => [g.id, g.display_name || g.name])
      );

      // Fetch deal counts per origin
      const { data: dealCounts } = await supabase
        .from('crm_deals')
        .select('origin_id')
        .not('origin_id', 'is', null);

      const dealCountMap = new Map<string, number>();
      (dealCounts || []).forEach(d => {
        if (d.origin_id) {
          dealCountMap.set(d.origin_id, (dealCountMap.get(d.origin_id) || 0) + 1);
        }
      });

      // Create origin name map for parent names
      const originNameMap = new Map(
        (originsData || []).map(o => [o.id, o.display_name || o.name])
      );

      return (originsData || []).map(origin => ({
        ...origin,
        group_name: origin.group_id ? groupMap.get(origin.group_id) : undefined,
        parent_name: origin.parent_id ? originNameMap.get(origin.parent_id) : undefined,
        deal_count: dealCountMap.get(origin.id) || 0,
      }));
    },
  });

  const updateOriginsMutation = useMutation({
    mutationFn: async (updates: OriginUpdate[]) => {
      // Validate no circular references
      const originMap = new Map(origins?.map(o => [o.id, o]) || []);
      
      for (const update of updates) {
        if (update.parent_id) {
          // Check for circular reference
          let currentId: string | null = update.parent_id;
          const visited = new Set<string>([update.id]);
          
          while (currentId) {
            if (visited.has(currentId)) {
              throw new Error(`Referência circular detectada para origem ${update.id}`);
            }
            visited.add(currentId);
            const parent = originMap.get(currentId);
            currentId = parent?.parent_id || null;
          }
        }
      }

      // Perform updates one by one (Supabase doesn't support batch updates easily)
      for (const update of updates) {
        const { id, ...fields } = update;
        const { error } = await supabase
          .from('crm_origins')
          .update({
            ...fields,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id);

        if (error) throw error;
      }

      return updates.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['origin-management'] });
      queryClient.invalidateQueries({ queryKey: ['crm-origins'] });
      queryClient.invalidateQueries({ queryKey: ['crm-origins-by-pipeline'] });
      toast.success(`${count} origem(ns) atualizada(s) com sucesso`);
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar origens: ${error.message}`);
    },
  });

  // Get only origins marked as pipelines (for parent selection)
  // A pipeline is any origin with pipeline_type different from 'outros' or null
  const isPipelineType = (type: string | null) => type && type !== 'outros';
  const pipelines = origins?.filter(o => isPipelineType(o.pipeline_type)) || [];

  return {
    origins: origins || [],
    pipelines,
    isLoading,
    error,
    updateOrigins: updateOriginsMutation.mutate,
    isUpdating: updateOriginsMutation.isPending,
  };
}
