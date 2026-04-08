import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Hook para buscar override de pipelines do SDR logado.
 * Se o SDR tem `allowed_origin_ids` preenchido, retorna esses IDs.
 * Se null/vazio, retorna null (usa padrão da BU).
 */
export function useSDROriginOverride() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['sdr-origin-override', user?.id],
    queryFn: async (): Promise<string[] | null> => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from('sdr')
        .select('allowed_origin_ids')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Erro ao buscar override de origens do SDR:', error);
        return null;
      }

      // Se não encontrou registro ou allowed_origin_ids é null/vazio
      if (!data?.allowed_origin_ids || (data.allowed_origin_ids as string[]).length === 0) {
        return null;
      }

      return data.allowed_origin_ids as string[];
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });
}
