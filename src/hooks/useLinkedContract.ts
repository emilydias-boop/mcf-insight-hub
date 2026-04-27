import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface LinkedContractInfo {
  id: string;
  hubla_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  customer_document: string | null;
  product_name: string | null;
  product_category: string | null;
  net_value: number | null;
  product_price: number | null;
  sale_date: string;
  linked_at: string | null;
  linked_method: 'auto' | 'manual' | null;
  linked_by_user_id: string | null;
  linked_by_name: string | null;
}

/**
 * Fetch all hubla_transactions linked to a given attendee, with linker name.
 */
export function useLinkedContracts(attendeeId: string | null | undefined) {
  return useQuery({
    queryKey: ['linked-contracts', attendeeId],
    enabled: !!attendeeId,
    queryFn: async (): Promise<LinkedContractInfo[]> => {
      if (!attendeeId) return [];

      const { data: txs, error } = await supabase
        .from('hubla_transactions')
        .select('id, hubla_id, customer_name, customer_email, customer_phone, customer_document, product_name, product_category, net_value, product_price, sale_date, linked_at, linked_method, linked_by_user_id')
        .eq('linked_attendee_id', attendeeId)
        .order('sale_date', { ascending: false });

      if (error) throw error;
      const list = (txs || []) as any[];
      if (list.length === 0) return [];

      // Resolve linker names in one go
      const userIds = Array.from(new Set(list.map(t => t.linked_by_user_id).filter(Boolean)));
      let nameMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', userIds as string[]);
        nameMap = Object.fromEntries((profiles || []).map((p: any) => [p.id, p.full_name]));
      }

      return list.map(t => ({
        ...t,
        linked_by_name: t.linked_by_user_id ? (nameMap[t.linked_by_user_id] || null) : null,
      })) as LinkedContractInfo[];
    },
    staleTime: 10000,
  });
}

/**
 * Unlink a contract: removes linked_attendee_id from the transaction and,
 * if no other linked transactions remain for that attendee, reverts the
 * attendee status from 'contract_paid' back to 'completed'.
 */
export function useUnlinkContract() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ transactionId, attendeeId }: { transactionId: string; attendeeId: string }) => {
      // 1. Unlink the transaction
      const { error: txError } = await supabase
        .from('hubla_transactions')
        .update({
          linked_attendee_id: null,
          linked_method: null,
          linked_at: null,
          linked_by_user_id: null,
        })
        .eq('id', transactionId);
      if (txError) throw txError;

      // 2. Check if any other transactions remain linked
      const { data: remaining } = await supabase
        .from('hubla_transactions')
        .select('id')
        .eq('linked_attendee_id', attendeeId)
        .limit(1);

      // 3. If none remain, revert attendee to completed (prior to contract_paid)
      if (!remaining || remaining.length === 0) {
        const { error: attErr } = await supabase
          .from('meeting_slot_attendees')
          .update({ status: 'completed', contract_paid_at: null })
          .eq('id', attendeeId);
        if (attErr) throw attErr;
      }

      return { transactionId, attendeeId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['linked-contracts'] });
      queryClient.invalidateQueries({ queryKey: ['unlinked-contracts'] });
      queryClient.invalidateQueries({ queryKey: ['agenda-meetings'] });
      queryClient.invalidateQueries({ queryKey: ['r2-pending-leads'] });
      queryClient.invalidateQueries({ queryKey: ['r2-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['r1-metrics'] });
      toast.success('Contrato desvinculado');
    },
    onError: (error: any) => {
      console.error('Error unlinking contract:', error);
      toast.error(error?.message || 'Erro ao desvincular contrato');
    },
  });
}