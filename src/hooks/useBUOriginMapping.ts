import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { BusinessUnit } from './useMyBU';

export interface BUOriginMappingEntry {
  id: string;
  bu: string;
  entity_type: 'group' | 'origin';
  entity_id: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

// Buscar mapeamento atual de uma BU
export function useBUOriginMapping(bu: string | null) {
  return useQuery({
    queryKey: ['bu-origin-mapping', bu],
    queryFn: async () => {
      if (!bu) return [];
      
      const { data, error } = await supabase
        .from('bu_origin_mapping')
        .select('*')
        .eq('bu', bu);
      
      if (error) throw error;
      return (data || []) as BUOriginMappingEntry[];
    },
    enabled: !!bu,
  });
}

// Salvar mapeamento de uma BU
export function useSaveBUOriginMapping() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      bu, 
      mappings 
    }: { 
      bu: string; 
      mappings: { entity_type: 'group' | 'origin'; entity_id: string; is_default?: boolean }[] 
    }) => {
      // Deletar mapeamentos antigos dessa BU
      const { error: deleteError } = await supabase
        .from('bu_origin_mapping')
        .delete()
        .eq('bu', bu);
      
      if (deleteError) throw deleteError;
      
      // Inserir novos mapeamentos
      if (mappings.length > 0) {
        const { error: insertError } = await supabase
          .from('bu_origin_mapping')
          .insert(
            mappings.map(m => ({ 
              bu, 
              entity_type: m.entity_type,
              entity_id: m.entity_id,
              is_default: m.is_default || false,
            }))
          );
        
        if (insertError) throw insertError;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['bu-origin-mapping'] });
      queryClient.invalidateQueries({ queryKey: ['bu-pipeline-map'] });
      toast.success(`Configuração da BU "${variables.bu}" salva com sucesso!`);
    },
    onError: (error) => {
      console.error('Erro ao salvar mapeamento:', error);
      toast.error('Erro ao salvar configuração');
    },
  });
}

// Buscar todas as BUs cadastradas (para exibir na lista)
export function useAllBUMappings() {
  return useQuery({
    queryKey: ['bu-origin-mapping', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bu_origin_mapping')
        .select('*')
        .order('bu');
      
      if (error) throw error;
      return (data || []) as BUOriginMappingEntry[];
    },
  });
}
