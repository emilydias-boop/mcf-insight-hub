import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Busca em lote (uma única query) o array `squad` (BUs de atuação) dos profiles informados.
 * Retorna um mapa profile_id -> string[].
 */
export function useProfilesSquadMap(profileIds: string[]) {
  const ids = Array.from(new Set(profileIds.filter(Boolean))).sort();

  return useQuery({
    queryKey: ['profiles-squad-map', ids],
    enabled: ids.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, squad')
        .in('id', ids);

      if (error) throw error;

      const map: Record<string, string[]> = {};
      (data || []).forEach((p: { id: string; squad: string[] | null }) => {
        map[p.id] = Array.isArray(p.squad) ? p.squad.filter(Boolean) : [];
      });
      return map;
    },
  });
}
