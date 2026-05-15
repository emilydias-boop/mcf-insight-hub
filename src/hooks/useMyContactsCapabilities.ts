import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Capacidades do usuário logado na aba CRM > Contatos.
 * - admin / manager / coordenador → tudo liberado
 * - demais cargos → respeitam flags individuais em `profiles`
 */
export function useMyContactsCapabilities() {
  const { user, role } = useAuth();
  const isPrivilegedRole = ['admin', 'manager', 'coordenador'].includes(role || '');

  const { data: profile, isLoading } = useQuery({
    queryKey: ['my-contacts-capabilities', user?.id],
    enabled: !!user?.id && !isPrivilegedRole,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('can_transfer_leads')
        .eq('id', user.id)
        .maybeSingle();
      if (error) throw error;
      return data as { can_transfer_leads: boolean } | null;
    },
  });

  if (isPrivilegedRole) {
    return { canTransferLeads: true, isPrivilegedRole: true, isLoading: false };
  }

  return {
    canTransferLeads: !!(profile as any)?.can_transfer_leads,
    isPrivilegedRole: false,
    isLoading,
  };
}
