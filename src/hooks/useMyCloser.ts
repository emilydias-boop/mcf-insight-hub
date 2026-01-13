import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useMyCloser() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['my-closer', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      // Primeiro: tentar buscar closer pelo employee_id (vínculo direto)
      const { data: closerByEmployee } = await supabase
        .from('closers')
        .select('id, name, email, is_active')
        .eq('employee_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (closerByEmployee) {
        return closerByEmployee;
      }

      // Fallback: buscar pelo email do perfil
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
