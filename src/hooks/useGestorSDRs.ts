import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveBU } from '@/hooks/useActiveBU';

interface SDRInfo {
  id: string;
  name: string;
  email: string | null;
  profile_id: string | null;
}

export const useGestorSDRs = () => {
  const { role, user } = useAuth();
  const activeBU = useActiveBU();

  return useQuery({
    queryKey: ['gestor-sdrs', user?.id, role, activeBU],
    queryFn: async (): Promise<SDRInfo[]> => {
      if (role === 'admin' || role === 'manager') {
        let query = supabase
          .from('employees')
          .select('id, nome_completo, profile_id')
          .eq('cargo', 'SDR')
          .eq('status', 'ativo');

        const { data, error } = await query.order('nome_completo');
        if (error) throw error;
        return (data || []).map(e => ({
          id: e.id,
          name: e.nome_completo || '',
          profile_id: e.profile_id,
        }));
      }

      if (role === 'coordenador') {
        const { data: managedEmployees } = await supabase
          .from('employees')
          .select('id, nome_completo, profile_id')
          .eq('gestor_id', user?.id)
          .eq('cargo', 'SDR')
          .eq('status', 'ativo')
          .order('nome_completo');

        return (managedEmployees || []).map(e => ({
          id: e.id,
          name: e.nome_completo || '',
          profile_id: e.profile_id,
        }));
      }

      return [];
    },
    enabled: !!user?.id && !!role,
    staleTime: 5 * 60 * 1000,
  });
};
