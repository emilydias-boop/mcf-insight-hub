import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useMyCloser() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['my-closer', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      // Opção 1: buscar closer via employees.user_id → closers.employee_id
      const { data: closerViaEmployee } = await supabase
        .from('closers')
        .select(`
          id, name, email, is_active,
          employees!closers_employee_id_fkey (
            user_id
          )
        `)
        .eq('is_active', true)
        .not('employee_id', 'is', null);

      // Verificar se algum closer tem employee com user_id = auth.uid()
      const matchedCloser = closerViaEmployee?.find(
        (c: any) => c.employees?.user_id === user.id
      );
      
      if (matchedCloser) {
        return {
          id: matchedCloser.id,
          name: matchedCloser.name,
          email: matchedCloser.email,
          is_active: matchedCloser.is_active,
        };
      }

      // Opção 2 (fallback): buscar pelo email do perfil
      const { data: profile } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', user.id)
        .single();

      if (!profile?.email) return null;

      const { data: closerByEmail, error } = await supabase
        .from('closers')
        .select('id, name, email, is_active')
        .ilike('email', profile.email)
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;
      return closerByEmail;
    },
    enabled: !!user?.id,
  });
}
