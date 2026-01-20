import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { 
  isSdrRole, 
  getAuthorizedOriginsForRole 
} from '@/components/auth/NegociosAccessGuard';

export function useNewLeadNotifications() {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    // Só ativar para SDRs com acesso a Negócios
    if (!user?.id || !isSdrRole(role)) return;

    const authorizedOrigins = getAuthorizedOriginsForRole(role);
    if (authorizedOrigins.length === 0) return;

    console.log('[NewLeadNotifications] Subscrevendo a novos leads para origens:', authorizedOrigins);

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

          // Verificar se o origin é autorizado (direto, não via grupo)
          if (authorizedOrigins.includes(newDeal.origin_id)) {
            console.log('[NewLeadNotifications] Lead pertence à origem autorizada!');
            
            // Mostrar toast de notificação
            toast({
              title: '🚨 Novo Lead!',
              description: `Lead "${newDeal.name || 'Novo'}" chegou em Inside Sales`,
              variant: 'default',
            });

            // Invalidar queries do Kanban para atualizar a lista
            queryClient.invalidateQueries({ queryKey: ['crm-deals'] });
            queryClient.invalidateQueries({ queryKey: ['user-notifications'] });
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