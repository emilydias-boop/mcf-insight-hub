import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export type NextActionType = 'ligar' | 'whatsapp' | 'email' | 'reuniao';

interface NextActionData {
  dealId: string;
  actionType: NextActionType | null;
  actionDate: Date | null;
  actionNote: string;
  dealName?: string;
}

const ACTION_LABELS: Record<NextActionType, string> = {
  ligar: 'Ligar',
  whatsapp: 'WhatsApp',
  email: 'E-mail',
  reuniao: 'Reunião'
};

/**
 * Hook para salvar próxima ação de um deal
 */
export const useSaveNextAction = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ dealId, actionType, actionDate, actionNote, dealName }: NextActionData) => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      
      // 1. Atualizar o deal com a próxima ação
      const { data, error } = await supabase
        .from('crm_deals')
        .update({
          next_action_type: actionType,
          next_action_date: actionDate?.toISOString() || null,
          next_action_note: actionNote || null
        })
        .eq('id', dealId)
        .select()
        .single();
      
      if (error) throw error;
      
      // 2. Registrar no histórico (deal_activities)
      if (actionType && actionDate) {
        const actionLabel = ACTION_LABELS[actionType];
        const formattedDate = format(actionDate, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
        
        await supabase.from('deal_activities').insert({
          deal_id: dealId,
          activity_type: 'next_action_scheduled',
          description: `Próxima ação: ${actionLabel} agendada para ${formattedDate}`,
          user_id: userId,
          metadata: {
            action_type: actionType,
            scheduled_date: actionDate.toISOString(),
            note: actionNote || null,
            created_by: userData.user?.email
          }
        });
        
        // 3. Criar notificação (alertas) para o usuário que criou
        if (userId) {
          await supabase.from('alertas').insert({
            user_id: userId,
            tipo: 'proxima_acao',
            titulo: `⏰ ${actionLabel}: ${dealName || 'Deal'}`,
            descricao: `Agendado para ${formattedDate}${actionNote ? ` - ${actionNote}` : ''}`,
            metadata: {
              deal_id: dealId,
              action_type: actionType,
              scheduled_date: actionDate.toISOString()
            }
          });
        }
      }
      
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['crm-deal', variables.dealId] });
      queryClient.invalidateQueries({ queryKey: ['crm-deals'] });
      queryClient.invalidateQueries({ queryKey: ['deal-activities', variables.dealId] });
      queryClient.invalidateQueries({ queryKey: ['alertas'] });
      toast.success('Próxima ação salva com sucesso');
    },
    onError: (error: any) => {
      toast.error(`Erro ao salvar próxima ação: ${error.message}`);
    },
  });
};

/**
 * Hook para adicionar nota ao deal (cria activity do tipo note)
 */
export const useAddDealNote = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ dealId, note }: { dealId: string; note: string }) => {
      const { data: userData } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('deal_activities')
        .insert({
          deal_id: dealId,
          activity_type: 'note',
          description: note,
          user_id: userData.user?.id,
          metadata: {
            author: userData.user?.email,
            timestamp: new Date().toISOString()
          }
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['deal-notes', variables.dealId] });
      queryClient.invalidateQueries({ queryKey: ['deal-activities', variables.dealId] });
      toast.success('Nota adicionada');
    },
    onError: (error: any) => {
      toast.error(`Erro ao adicionar nota: ${error.message}`);
    },
  });
};

/**
 * Hook para buscar notas do deal
 */
export const useDealNotes = (dealId: string) => {
  const queryClient = useQueryClient();
  
  return {
    invalidate: () => {
      queryClient.invalidateQueries({ queryKey: ['deal-activities', dealId] });
    }
  };
};
