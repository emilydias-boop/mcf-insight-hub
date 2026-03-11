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
 * Mutation to mark a pending R2 lead as "sem_sucesso".
 * Stores metadata as a JSON string in r2_observations and adds an attendee_note.
 */
export function useMarkR2SemSucesso() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ attendeeId, tentativas, observacao }: MarkSemSucessoParams) => {
      const metadata = JSON.stringify({
        sem_sucesso: true,
        tentativas,
        observacao,
        marked_at: new Date().toISOString(),
      });

      const { error } = await supabase
        .from('meeting_slot_attendees')
        .update({
          status: 'sem_sucesso',
          r2_observations: metadata,
        })
        .eq('id', attendeeId);

      if (error) throw error;

      // Also add an attendee_note for audit trail
      if (observacao) {
        await supabase.from('attendee_notes').insert({
          attendee_id: attendeeId,
          note: `Sem Sucesso (${tentativas} tentativa${tentativas !== 1 ? 's' : ''}): ${observacao}`,
          note_type: 'sem_sucesso',
        });
      }
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
        .update({ status: 'contract_paid' })
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

export interface R2SemSucessoLead extends R2PendingLead {
  sem_sucesso_tentativas: number;
  sem_sucesso_observacao: string;
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
          r2_observations,
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
        .eq('status', 'sem_sucesso')
        .eq('meeting_slots.meeting_type', 'r1')
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (!data) return [];

      return (data as any[]).map(a => {
        const deal = Array.isArray(a.deal) ? a.deal[0] : a.deal;
        const slot = Array.isArray(a.meeting_slot) ? a.meeting_slot[0] : a.meeting_slot;
        const closer = slot?.closer ? (Array.isArray(slot.closer) ? slot.closer[0] : slot.closer) : null;

        // Parse metadata from r2_observations
        let tentativas = 0;
        let observacao = '';
        try {
          const meta = JSON.parse(a.r2_observations || '{}');
          if (meta.sem_sucesso) {
            tentativas = meta.tentativas || 0;
            observacao = meta.observacao || '';
          }
        } catch {
          // not JSON, ignore
        }

        return {
          ...a,
          contact_id: deal?.contact_id || deal?.contact?.id || null,
          meeting_slot: { ...slot, closer },
          deal,
          contract_paid_at: a.contract_paid_at || slot?.scheduled_at || a.created_at,
          sem_sucesso_tentativas: tentativas,
          sem_sucesso_observacao: observacao,
        } as R2SemSucessoLead;
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
