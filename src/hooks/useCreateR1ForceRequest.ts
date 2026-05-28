import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface R1ForcePayload {
  closerId: string;
  dealId: string;
  contactId: string | null;
  scheduledAt: string;
  durationMinutes: number;
  notes: string | null;
  leadType: string | null;
  sdrEmail: string | null;
  alreadyBuilds: boolean | null;
  parentAttendeeId: string | null;
  bookedAt: string | null;
}

export interface CreateR1ForceRequestInput {
  payload: R1ForcePayload;
  reason: string;
  blockReason?: string;
  blockMessage?: string;
  requesterRole?: 'sdr' | 'closer';
}

/**
 * Cria pedido explícito de liberação para agendar R1 em lead já pago/won.
 * Aprovadores: admin, manager, coordenador + Jessica Bellini (allowlist).
 */
export function useCreateR1ForceRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateR1ForceRequestInput) => {
      const { payload, reason, blockReason, blockMessage, requesterRole = 'sdr' } = input;

      if (!reason || reason.trim().length < 10) {
        throw new Error('Informe o motivo da solicitação (mínimo 10 caracteres).');
      }

      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes?.user?.id;
      if (!uid) throw new Error('Usuário não autenticado.');

      // Detectar BU do deal
      let dealBu: string | null = null;
      const { data: dealOrigin } = await supabase
        .from('crm_deals')
        .select('origin_id')
        .eq('id', payload.dealId)
        .maybeSingle();
      if (dealOrigin?.origin_id) {
        const { data: buMaps } = await supabase
          .from('bu_origin_mapping')
          .select('bu')
          .eq('entity_type', 'origin')
          .eq('entity_id', dealOrigin.origin_id)
          .limit(1);
        dealBu = (buMaps ?? [])[0]?.bu ?? null;
      }

      // Dedup: pedido pendente do mesmo usuário pro mesmo deal
      const { data: existing } = await supabase
        .from('rule_approval_requests' as any)
        .select('id')
        .eq('requested_by', uid)
        .eq('target_deal_id', payload.dealId)
        .eq('rule_key', 'r1_force_paid_lead')
        .eq('status', 'pending')
        .maybeSingle();

      if (existing) {
        return { id: (existing as any).id, deduped: true };
      }

      const { data: inserted, error } = await supabase
        .from('rule_approval_requests' as any)
        .insert({
          bu: dealBu,
          rule_key: 'r1_force_paid_lead',
          requester_role: requesterRole,
          requested_by: uid,
          target_deal_id: payload.dealId,
          status: 'pending',
          payload: {
            source: 'request_r1_approval_dialog',
            block_reason: blockReason ?? null,
            block_message: blockMessage ?? null,
            reason: reason.trim(),
            closer_id: payload.closerId,
            contact_id: payload.contactId,
            scheduled_at: payload.scheduledAt,
            duration_minutes: payload.durationMinutes,
            notes: payload.notes,
            lead_type: payload.leadType,
            sdr_email: payload.sdrEmail,
            already_builds: payload.alreadyBuilds,
            parent_attendee_id: payload.parentAttendeeId,
            booked_at: payload.bookedAt,
          },
        })
        .select('id')
        .single();

      if (error) throw error;
      return { id: (inserted as any).id, deduped: false };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-approval-requests'] });
      queryClient.invalidateQueries({ queryKey: ['approval-requests-pending'] });
      queryClient.invalidateQueries({ queryKey: ['approval-requests-pending-count'] });
      queryClient.invalidateQueries({ queryKey: ['r1-force-requests-by-deal'] });
    },
  });
}