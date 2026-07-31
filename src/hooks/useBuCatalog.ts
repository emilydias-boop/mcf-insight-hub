import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface BuCatalogItem {
  code: string;
  label: string;
  is_active: boolean;
  sort_order: number | null;
}

export function useBuCatalog() {
  return useQuery({
    queryKey: ['bu-catalog', 'active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bu_catalog')
        .select('code, label, is_active, sort_order')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return (data || []) as BuCatalogItem[];
    },
  });
}

export function useUpdateProfileSquad() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ profileId, squad }: { profileId: string; squad: string[] }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ squad })
        .eq('id', profileId);

      if (error) throw error;
      return { profileId, squad };
    },
    onSuccess: ({ profileId }) => {
      toast.success('BUs de atuação atualizadas');
      queryClient.invalidateQueries({ queryKey: ['linked-profile', profileId] });
      queryClient.invalidateQueries({ queryKey: ['available-profiles'] });
    },
    onError: (error: any) => {
      toast.error(`Erro ao salvar BUs: ${error?.message || 'tente novamente'}`);
    },
  });
}
