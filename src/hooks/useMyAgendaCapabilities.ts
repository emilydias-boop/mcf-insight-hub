import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Retorna as capacidades de agenda do usuário logado.
 * Admin / manager / coordenador → todas as capacidades = true automaticamente.
 * Demais cargos (sdr, closer, etc) → respeitam as flags individuais em `profiles`.
 */
export function useMyAgendaCapabilities() {
  const { user, role } = useAuth();
  const isPrivilegedRole = ['admin', 'manager', 'coordenador'].includes(role || '');

  const { data: profile, isLoading } = useQuery({
    queryKey: ['my-agenda-capabilities', user?.id],
    enabled: !!user?.id && !isPrivilegedRole,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('can_manage_agenda, can_handle_no_show, can_link_contract, can_cancel_meeting')
        .eq('id', user.id)
        .maybeSingle();
      if (error) throw error;
      return data as {
        can_manage_agenda: boolean;
        can_handle_no_show: boolean;
        can_link_contract: boolean;
        can_cancel_meeting: boolean;
      } | null;
    },
  });

  if (isPrivilegedRole) {
    return {
      canManageAgenda: true,
      canHandleNoShow: true,
      canLinkContract: true,
      canCancelMeeting: true,
      isPrivilegedRole: true,
      isLoading: false,
    };
  }

  return {
    canManageAgenda: !!profile?.can_manage_agenda,
    canHandleNoShow: profile?.can_handle_no_show ?? true,
    canLinkContract: !!profile?.can_link_contract,
    canCancelMeeting: !!profile?.can_cancel_meeting,
    isPrivilegedRole: false,
    isLoading,
  };
}