import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { GRAction, GRActionType } from '@/types/gr-types';

// Hook para buscar ações de uma entrada
export const useGREntryActions = (entryId?: string) => {
  return useQuery({
    queryKey: ['gr-entry-actions', entryId],
    queryFn: async () => {
      if (!entryId) return [];
      
      const { data, error } = await supabase
        .from('gr_actions')
        .select(`
          *,
          performer:performed_by (
            full_name,
            email
          )
        `)
        .eq('entry_id', entryId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      return (data || []).map((a: any) => ({
        ...a,
        performer_name: a.performer?.full_name || a.performer?.email,
      })) as GRAction[];
    },
    enabled: !!entryId,
  });
};

// Hook para criar ação
export const useCreateGRAction = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async (data: {
      entry_id: string;
      action_type: GRActionType;
      description?: string;
      metadata?: Record<string, any>;
    }) => {
      if (!user?.id) throw new Error('Usuário não autenticado');
      
      const { data: result, error } = await supabase
        .from('gr_actions')
        .insert({
          ...data,
          performed_by: user.id,
        })
        .select()
        .single();
      
      if (error) throw error;
      
      // Atualizar last_contact_at na entrada
      if (['contato_telefonico', 'contato_whatsapp', 'reuniao_realizada'].includes(data.action_type)) {
        await supabase
          .from('gr_wallet_entries')
          .update({ last_contact_at: new Date().toISOString() })
          .eq('id', data.entry_id);
      }
      
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['gr-entry-actions', variables.entry_id] });
      queryClient.invalidateQueries({ queryKey: ['gr-wallet-entries'] });
      toast.success('Ação registrada');
    },
    onError: (error: any) => {
      toast.error(`Erro ao registrar ação: ${error.message}`);
    },
  });
};

// Hook para buscar timeline unificada (histórico completo do cliente)
export const useGREntryTimeline = (entryId?: string, contactEmail?: string) => {
  return useQuery({
    queryKey: ['gr-entry-timeline', entryId, contactEmail],
    queryFn: async () => {
      if (!entryId && !contactEmail) return [];
      
      const timeline: any[] = [];
      let dealId: string | null = null;
      
      // 0. Buscar deal_id da entry
      if (entryId) {
        const { data: entryData } = await supabase
          .from('gr_wallet_entries')
          .select('deal_id')
          .eq('id', entryId)
          .single();
        
        dealId = entryData?.deal_id || null;
      }
      
      // 1. Ações do GR
      if (entryId) {
        const { data: grActions } = await supabase
          .from('gr_actions')
          .select(`
            *,
            performer:performed_by (full_name)
          `)
          .eq('entry_id', entryId)
          .order('created_at', { ascending: false });
        
        (grActions || []).forEach((a: any) => {
          timeline.push({
            type: 'gr_action',
            date: a.created_at,
            title: a.action_type,
            description: a.description,
            performer: a.performer?.full_name,
            metadata: a.metadata,
          });
        });
      }
      
      // 2. Transações Hubla (pagamentos)
      if (contactEmail) {
        const { data: transactions } = await supabase
          .from('hubla_transactions')
          .select('*')
          .eq('customer_email', contactEmail)
          .eq('sale_status', 'completed')
          .order('sale_date', { ascending: false })
          .limit(20);
        
        (transactions || []).forEach((t: any) => {
          timeline.push({
            type: 'payment',
            date: t.sale_date,
            title: 'Pagamento Recebido',
            description: `${t.product_name} - R$ ${t.net_value?.toLocaleString('pt-BR')}`,
            metadata: { product: t.product_name, value: t.net_value },
          });
        });
      }
      
      // 3. Histórico de stages (deal_activities com stage_change)
      if (dealId) {
        const { data: stageChanges } = await supabase
          .from('deal_activities')
          .select('*')
          .eq('deal_id', dealId)
          .in('activity_type', ['stage_change', 'stage_changed'])
          .order('created_at', { ascending: false })
          .limit(50);
        
        (stageChanges || []).forEach((sc: any) => {
          const fromStage = sc.from_stage || sc.metadata?.from_stage || '';
          const toStage = sc.to_stage || sc.metadata?.to_stage || '';
          
          timeline.push({
            type: 'stage_change',
            date: sc.created_at,
            title: 'Mudança de Stage',
            description: fromStage && toStage 
              ? `${fromStage} → ${toStage}` 
              : toStage || sc.description,
            metadata: sc.metadata,
          });
        });
      }
      
      // 4. Outras atividades CRM (deal_activities não-stage) via deal_id
      if (dealId) {
        const { data: otherActivities } = await supabase
          .from('deal_activities')
          .select('*')
          .eq('deal_id', dealId)
          .not('activity_type', 'in', '("stage_change","stage_changed")')
          .order('created_at', { ascending: false })
          .limit(30);
        
        (otherActivities || []).forEach((da: any) => {
          timeline.push({
            type: 'crm_activity',
            date: da.created_at,
            title: da.activity_type,
            description: da.description,
            metadata: da.metadata,
          });
        });
      }
      
      // Ordenar por data descendente
      return timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    },
    enabled: !!entryId || !!contactEmail,
  });
};
