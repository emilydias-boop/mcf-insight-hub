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

    // SDR sempre tem exatamente 1 origem autorizada (Inside Sales).
    // Usamos filter server-side para que o Realtime entregue APENAS inserts
    // dessa origem — antes, todo INSERT em crm_deals (Consórcio, Incorporador,
    // partners, etc.) era enviado ao cliente e descartado no .includes().
    const originFilter = `origin_id=eq.${authorizedOrigins[0]}`;
    console.log('[NewLeadNotifications] Subscrevendo a novos leads com filtro:', originFilter);

    // Subscrever a novos deals
    const channel = supabase
      .channel('new-leads-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'crm_deals',
          filter: originFilter,
        },
        async (payload) => {
          console.log('[NewLeadNotifications] Novo deal detectado:', payload);
          const newDeal = payload.new as any;

          // Defesa em profundidade: filtro server-side já garante origem correta,
          // mas mantemos guarda caso o filtro falhe silenciosamente.
          if (!newDeal.origin_id || !authorizedOrigins.includes(newDeal.origin_id)) return;

          toast({
            title: '🚨 Novo Lead!',
            description: `Lead "${newDeal.name || 'Novo'}" chegou em Inside Sales`,
            variant: 'default',
          });

          queryClient.invalidateQueries({ queryKey: ['crm-deals'] });
          queryClient.invalidateQueries({ queryKey: ['user-notifications'] });
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