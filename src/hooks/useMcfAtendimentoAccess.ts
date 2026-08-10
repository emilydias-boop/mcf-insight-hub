import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Verifica no servidor se o usuário logado tem acesso ao módulo MCF - Atendimento
 * (admin, manager ou presente em mcf_atendimento_access).
 */
export function useMcfAtendimentoAccess() {
  const { data, isLoading } = useQuery({
    queryKey: ['mcf-atendimento-access', 'me'],
    queryFn: async () => {
      const { data: session } = await supabase.auth.getUser();
      const uid = session.user?.id;
      if (!uid) return false;
      const { data, error } = await supabase.rpc('has_mcf_atendimento_access', { _user_id: uid });
      if (error) throw error;
      return Boolean(data);
    },
    staleTime: 5 * 60 * 1000,
  });

  return { hasAccess: Boolean(data), loading: isLoading };
}
