import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useMyCloser() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['my-closer', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      // Buscar email do usuário
      const { data: profile } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', user.id)
        .single();

      if (!profile?.email) return null;

      // Buscar closer pelo email
      const { data: closer, error } = await supabase
        .from('closers')
        .select('id, name, email, is_active')
        .ilike('email', profile.email)
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;
      return closer;
    },
    enabled: !!user?.id,
  });
}
