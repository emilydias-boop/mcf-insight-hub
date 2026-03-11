import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { R2PendingLead } from './useR2PendingLeads';

interface MarkSemSucessoParams {
  attendeeId: string;
  tentativas: number;
  observacao: string;
}

/**
 * Mutation to mark a pending R2 lead as "sem_sucesso"
 */
export function useMarkR2SemSucesso() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ attendeeId, tentativas, observacao }: MarkSemSucessoParams) => {
      // Get current custom_fields
      const { data: current } = await supabase
        .from('meeting_slot_attendees')
        .select('custom_fields')
        .eq('id', attendeeId)
        .single();

      const existingFields = (current?.custom_fields as Record<string, unknown>) || {};

      const { error } = await supabase
        .from('meeting_slot_attendees')
        .update({
          status: 'sem_sucesso' as any,
          custom_fields: {
            ...existingFields,
            sem_sucesso_tentativas: tentativas,
            sem_sucesso_observacao: observacao,
            sem_sucesso_at: new Date().toISOString(),
          },
        })
        .eq('id', attendeeId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Lead marcado como Sem Sucesso');
      queryClient.invalidateQueries({ queryKey: ['r2-pending-leads'] });
      queryClient.invalidateQueries({ queryKey: ['r2-sem-sucesso-leads'] });
    },
    onError: (err: Error) => {
      toast.error('Erro ao marcar sem sucesso: ' + err.message);
    },
  });
}

/**
 * Mutation to revert a "sem_sucesso" lead back to "contract_paid"
 */
export function useRevertSemSucesso() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (attendeeId: string) => {
      const { error } = await supabase
        .from('meeting_slot_attendees')
        .update({ status: 'contract_paid' as any })
        .eq('id', attendeeId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Lead retornado para Pendentes');
      queryClient.invalidateQueries({ queryKey: ['r2-pending-leads'] });
      queryClient.invalidateQueries({ queryKey: ['r2-sem-sucesso-leads'] });
    },
    onError: (err: Error) => {
      toast.error('Erro ao reverter: ' + err.message);
    },
  });
}

/**
 * Query to fetch leads marked as "sem_sucesso"
 */
export function useR2SemSucessoLeads() {
  return useQuery({
    queryKey: ['r2-sem-sucesso-leads'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meeting_slot_attendees')
        .select(`
          id,
          attendee_name,
          attendee_phone,
          deal_id,
          status,
          custom_fields,
          contract_paid_at,
          created_at,
          meeting_slot:meeting_slots!inner(
            id,
            scheduled_at,
            closer_id,
            meeting_type,
            status,
            closer:closers(id, name)
          ),
          deal:crm_deals(
            id,
            name,
            contact_id,
            contact:crm_contacts(id, name, phone, email)
          )
        `)
        .eq('status', 'sem_sucesso' as any)
        .eq('meeting_slots.meeting_type', 'r1')
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (!data) return [];

      return (data as any[]).map(a => {
        const deal = Array.isArray(a.deal) ? a.deal[0] : a.deal;
        const slot = Array.isArray(a.meeting_slot) ? a.meeting_slot[0] : a.meeting_slot;
        const closer = slot?.closer ? (Array.isArray(slot.closer) ? slot.closer[0] : slot.closer) : null;

        return {
          ...a,
          contact_id: deal?.contact_id || deal?.contact?.id || null,
          meeting_slot: { ...slot, closer },
          deal,
          contract_paid_at: a.contract_paid_at || slot?.scheduled_at || a.created_at,
        } as R2PendingLead & { custom_fields: Record<string, any> };
      });
    },
    staleTime: 30000,
    refetchInterval: 60000,
  });
}

/**
 * Count of sem_sucesso leads
 */
export function useR2SemSucessoCount() {
  const { data } = useR2SemSucessoLeads();
  return data?.length || 0;
}
