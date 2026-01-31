import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface UseUniqueDealTagsOptions {
  originId?: string;
  enabled?: boolean;
}

export const useUniqueDealTags = (options: UseUniqueDealTagsOptions = {}) => {
  const { originId, enabled = true } = options;

  return useQuery({
    queryKey: ['unique-deal-tags', originId],
    queryFn: async () => {
      let query = supabase
        .from('crm_deals')
        .select('tags')
        .not('tags', 'is', null);

      // Opcional: filtrar por origin_id para limitar às tags do pipeline atual
      if (originId) {
        query = query.eq('origin_id', originId);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Extrair e deduplicar todas as tags
      const allTags = (data || []).flatMap((d) => d.tags || []) as string[];
      const uniqueTags = [...new Set(allTags)].sort((a, b) => 
        a.toLowerCase().localeCompare(b.toLowerCase())
      );

      // Limitar a 500 tags para evitar sobrecarga visual
      return uniqueTags.slice(0, 500);
    },
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutos
    gcTime: 10 * 60 * 1000,
  });
};
