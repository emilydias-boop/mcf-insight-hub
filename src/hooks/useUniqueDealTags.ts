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
      let originIds: string[] = [];

      // Verificar se originId é um grupo (mesma lógica de useCRMDeals)
      if (originId) {
        const { data: groupCheck } = await supabase
          .from('crm_groups')
          .select('id')
          .eq('id', originId)
          .maybeSingle();

        if (groupCheck) {
          // É um grupo - buscar todas as origens filhas
          const { data: childOrigins } = await supabase
            .from('crm_origins')
            .select('id')
            .eq('group_id', originId);

          originIds = childOrigins?.map(o => o.id) || [];
        } else {
          // É uma origem normal
          originIds = [originId];
        }
      }

      let query = supabase
        .from('crm_deals')
        .select('tags')
        .not('tags', 'is', null);

      // Aplicar filtro de origens (múltiplas se for grupo)
      if (originIds.length > 0) {
        query = query.in('origin_id', originIds);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Extrair e deduplicar todas as tags (com validação de tipo)
      const allTags = (data || []).flatMap((d) => 
        (d.tags || []).map((t: any) => {
          if (typeof t === 'string') {
            if (t.startsWith('{')) {
              try { const p = JSON.parse(t); return p?.name || t; } catch { return t; }
            }
            return t.trim() || null;
          }
          return t?.name || null;
        }).filter((t): t is string => t !== null && t !== '')
      );
      const uniqueTags = [...new Set(allTags)].sort((a, b) => 
        a.toLowerCase().localeCompare(b.toLowerCase())
      );

      // Limitar a 500 tags para evitar sobrecarga visual
      return uniqueTags.slice(0, 1000);
    },
    enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};
