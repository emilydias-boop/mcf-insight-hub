import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { 
  isSdrWithNegociosAccess, 
  getAuthorizedGroupsForUser 
} from '@/components/auth/NegociosAccessGuard';

export function useNewLeadNotifications() {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    // Só ativar para SDRs com acesso especial a Negócios
    if (!user?.id || !isSdrWithNegociosAccess(role, user.id)) return;

    const authorizedGroups = getAuthorizedGroupsForUser(user.id);
    if (authorizedGroups.length === 0) return;

    console.log('[NewLeadNotifications] Subscrevendo a novos leads para grupos:', authorizedGroups);

    // Subscrever a novos deals
    const channel = supabase
      .channel('new-leads-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'crm_deals',
        },
        async (payload) => {
          console.log('[NewLeadNotifications] Novo deal detectado:', payload);
          const newDeal = payload.new as any;
          
          if (!newDeal.origin_id) return;

          try {
            // Verificar se o origin pertence ao grupo autorizado
            const { data: origin, error } = await supabase
              .from('crm_origins')
              .select('group_id, name')
              .eq('id', newDeal.origin_id)
              .single();

            if (error) {
              console.error('[NewLeadNotifications] Erro ao buscar origin:', error);
              return;
            }

            if (origin && authorizedGroups.includes(origin.group_id)) {
              console.log('[NewLeadNotifications] Lead pertence ao grupo autorizado!');
              
              // Mostrar toast de notificação
              toast({
                title: '🚨 Novo Lead!',
                description: `Lead "${newDeal.name || 'Novo'}" chegou em ${origin.name || 'Perpétuo X1'}`,
                variant: 'default',
              });

              // Invalidar queries do Kanban para atualizar a lista
              queryClient.invalidateQueries({ queryKey: ['crm-deals'] });
              queryClient.invalidateQueries({ queryKey: ['user-notifications'] });
            }
          } catch (err) {
            console.error('[NewLeadNotifications] Erro ao processar novo lead:', err);
          }
        }
      )
      .subscribe((status) => {
        console.log('[NewLeadNotifications] Status da subscription:', status);
      });

    return () => {
      console.log('[NewLeadNotifications] Removendo subscription');
      supabase.removeChannel(channel);
    };
  }, [user?.id, role, toast, queryClient]);
}
