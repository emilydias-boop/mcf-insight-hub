import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface PendingAction {
  dealId: string;
  dealName: string;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  actionType: string;
  actionDate: string;
  actionNote: string | null;
  isOverdue: boolean;
  isToday: boolean;
  ownerId: string | null;
}

export const usePendingNextActions = () => {
  return useQuery({
    queryKey: ['pending-next-actions'],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const userEmail = userData.user?.email;
      if (!userEmail) return [];

      const { data, error } = await supabase
        .from('crm_deals')
        .select(`
          id, name, next_action_type, next_action_date, next_action_note, owner_id,
          crm_contacts ( name, phone, email )
        `)
        .not('next_action_type', 'is', null)
        .not('next_action_date', 'is', null)
        .eq('owner_id', userEmail)
        .order('next_action_date', { ascending: true });

      if (error) throw error;

      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const todayEnd = new Date(todayStart);
      todayEnd.setDate(todayEnd.getDate() + 1);

      return (data || []).map((deal: any): PendingAction => {
        const actionDate = new Date(deal.next_action_date);
        const contact = deal.crm_contacts;
        return {
          dealId: deal.id,
          dealName: deal.name || contact?.name || 'Deal',
          contactName: contact?.name || null,
          contactPhone: contact?.phone || null,
          contactEmail: contact?.email || null,
          actionType: deal.next_action_type,
          actionDate: deal.next_action_date,
          actionNote: deal.next_action_note || null,
          isOverdue: actionDate < now,
          isToday: actionDate >= todayStart && actionDate < todayEnd,
          ownerId: deal.owner_id,
        };
      });
    },
  });
};

export const useCompleteNextAction = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (dealId: string) => {
      const { data: userData } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('crm_deals')
        .update({
          next_action_type: null,
          next_action_date: null,
          next_action_note: null,
        })
        .eq('id', dealId);

      if (error) throw error;

      // Log activity
      await supabase.from('deal_activities').insert({
        deal_id: dealId,
        activity_type: 'next_action_completed',
        description: 'Próxima ação concluída',
        user_id: userData.user?.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-next-actions'] });
      queryClient.invalidateQueries({ queryKey: ['crm-deals'] });
      toast.success('Ação concluída!');
    },
    onError: (error: any) => {
      toast.error(`Erro ao concluir ação: ${error.message}`);
    },
  });
};
