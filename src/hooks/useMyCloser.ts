import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Resolve o registro em `closers` do usuário logado.
 *
 * Quando `activeBU` é informado, filtra o registro pela BU da tela — necessário
 * porque a mesma pessoa pode ter um registro em `closers` por BU. Sem `activeBU`
 * mantém o comportamento anterior (primeiro match, ordenado por nome/BU).
 */
export function useMyCloser(activeBU?: string | null) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['my-closer', user?.id, activeBU ?? null],
    queryFn: async () => {
      if (!user?.id) return null;

      // Opção 1: buscar closer via employees.user_id → closers.employee_id
      const { data: closerViaEmployee } = await supabase
        .from('closers')
        .select(`
          id, name, email, is_active, bu,
          employees!closers_employee_id_fkey (
            user_id
          )
        `)
        .eq('is_active', true)
        .not('employee_id', 'is', null)
        .order('bu', { ascending: true })
        .order('created_at', { ascending: true });

      // Candidatos: closers cujo employee está vinculado ao usuário logado
      const candidates = (closerViaEmployee || []).filter(
        (c: any) => c.employees?.user_id === user.id
      );

      // Se a tela informou a BU ativa, só o registro daquela BU serve.
      // Fallback (sem activeBU): primeiro match, comportamento anterior.
      const matchedCloser = activeBU
        ? candidates.find((c: any) => c.bu === activeBU)
        : candidates[0];
      
      if (matchedCloser) {
        return {
          id: (matchedCloser as any).id,
          name: (matchedCloser as any).name,
          email: (matchedCloser as any).email,
          is_active: (matchedCloser as any).is_active,
          bu: (matchedCloser as any).bu,
        };
      }

      // Se havia candidatos mas nenhum na BU ativa, não faz fallback cross-BU:
      // cada tela deve ver apenas o registro da sua própria BU.
      if (activeBU && candidates.length > 0) return null;

      // Opção 2 (fallback): buscar pelo email do perfil
      const { data: profile } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', user.id)
        .single();

      if (!profile?.email) return null;

      let emailQuery = supabase
        .from('closers')
        .select('id, name, email, is_active, bu')
        .ilike('email', profile.email)
        .eq('is_active', true);

      if (activeBU) emailQuery = emailQuery.eq('bu', activeBU);

      const { data: closersByEmail, error } = await emailQuery
        .order('created_at', { ascending: true });

      if (error) throw error;
      return closersByEmail?.[0] ?? null;
    },
    enabled: !!user?.id,
  });
}
