import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { BusinessUnit } from './useMyBU';
import { 
  BU_PIPELINE_MAP, 
  BU_GROUP_MAP, 
  BU_DEFAULT_ORIGIN_MAP, 
  BU_DEFAULT_GROUP_MAP 
} from '@/components/auth/NegociosAccessGuard';

export interface BUPipelineMapResult {
  origins: string[];
  groups: string[];
  defaultOrigin: string | null;
  defaultGroup: string | null;
}

/**
 * Hook para buscar o mapeamento dinâmico de origens/grupos para uma BU
 * Primeiro tenta buscar do banco de dados, e usa fallback hardcoded se não encontrar
 */
export function useBUPipelineMap(bu: BusinessUnit | null) {
  return useQuery({
    queryKey: ['bu-pipeline-map', bu],
    queryFn: async (): Promise<BUPipelineMapResult> => {
      if (!bu) {
        return { origins: [], groups: [], defaultOrigin: null, defaultGroup: null };
      }
      
      // Buscar do banco de dados
      const { data, error } = await supabase
        .from('bu_origin_mapping')
        .select('entity_type, entity_id, is_default')
        .eq('bu', bu);
      
      if (error) {
        console.error('Erro ao buscar mapeamento BU:', error);
        // Fallback para hardcoded em caso de erro
        return getFallbackMapping(bu);
      }
      
      // Se não encontrou dados no banco, usar fallback
      if (!data || data.length === 0) {
        return getFallbackMapping(bu);
      }
      
      // Processar dados do banco
      const origins = data
        .filter(d => d.entity_type === 'origin')
        .map(d => d.entity_id);
      
      const groups = data
        .filter(d => d.entity_type === 'group')
        .map(d => d.entity_id);
      
      const defaultOrigin = data.find(d => d.entity_type === 'origin' && d.is_default)?.entity_id || null;
      const defaultGroup = data.find(d => d.entity_type === 'group' && d.is_default)?.entity_id || null;
      
      return { origins, groups, defaultOrigin, defaultGroup };
    },
    enabled: !!bu,
    staleTime: 5 * 60 * 1000, // Cache por 5 minutos
  });
}

/**
 * Fallback para usar mapeamento hardcoded quando não há dados no banco
 */
function getFallbackMapping(bu: BusinessUnit): BUPipelineMapResult {
  return {
    origins: BU_PIPELINE_MAP[bu] || [],
    groups: BU_GROUP_MAP[bu] || [],
    defaultOrigin: BU_DEFAULT_ORIGIN_MAP[bu] || null,
    defaultGroup: BU_DEFAULT_GROUP_MAP[bu] || null,
  };
}

/**
 * Hook para verificar se uma BU tem mapeamento no banco
 */
export function useBUHasMapping(bu: BusinessUnit | null) {
  return useQuery({
    queryKey: ['bu-has-mapping', bu],
    queryFn: async () => {
      if (!bu) return false;
      
      const { count, error } = await supabase
        .from('bu_origin_mapping')
        .select('id', { count: 'exact', head: true })
        .eq('bu', bu);
      
      if (error) return false;
      return (count || 0) > 0;
    },
    enabled: !!bu,
    staleTime: 5 * 60 * 1000,
  });
}
