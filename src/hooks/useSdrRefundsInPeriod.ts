import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

/**
 * Retorna quantos reembolsos (deal_activities refund_mcf_pay/refund_hubla +
 * fallback hubla_transactions.refunded) foram atribuídos a cada SDR no período.
 *
 * Regra de atribuição: SDR que agendou (booked_by) o R1 mais recente do deal
 * reembolsado. Fallback: dono atual do deal (owner_id).
 */
export function useSdrRefundsInPeriod(startDate: Date | null, endDate: Date | null) {
  return useQuery({
    queryKey: ['sdr-refunds-in-period', startDate?.toISOString(), endDate?.toISOString()],
    enabled: !!startDate && !!endDate,
    staleTime: 60_000,
    queryFn: async () => {
      if (!startDate || !endDate) return new Map<string, number>();
      const start = format(startDate, 'yyyy-MM-dd') + 'T00:00:00';
      const end = format(endDate, 'yyyy-MM-dd') + 'T23:59:59';

      // 1) deal_activities de reembolso no período
      const { data: acts } = await supabase
        .from('deal_activities')
        .select('deal_id, created_at')
        .in('activity_type', ['refund_mcf_pay', 'refund_hubla'])
        .gte('created_at', start)
        .lte('created_at', end);

      // 2) fallback: hubla_transactions reembolsadas no período com deal vinculado
      const { data: hubla } = await supabase
        .from('hubla_transactions')
        .select('linked_deal_id, updated_at')
        .eq('sale_status', 'refunded')
        .not('linked_deal_id', 'is', null)
        .gte('updated_at', start)
        .lte('updated_at', end);

      const dealIds = new Set<string>();
      (acts || []).forEach((a: any) => a.deal_id && dealIds.add(a.deal_id));
      (hubla || []).forEach((h: any) => h.linked_deal_id && dealIds.add(h.linked_deal_id));
      const ids = Array.from(dealIds);
      if (ids.length === 0) return new Map<string, number>();

      // 3) buscar R1 mais recente por deal (booked_by = SDR)
      const { data: attendees } = await supabase
        .from('meeting_slot_attendees')
        .select('deal_id, booked_by, meeting_slot:meeting_slots!inner(scheduled_at, meeting_type)')
        .in('deal_id', ids)
        .eq('meeting_slot.meeting_type', 'r1');

      const bookedByDeal = new Map<string, { email: string; ts: number }>();
      (attendees as any[] || []).forEach((att) => {
        const email = (att.booked_by || '').toLowerCase();
        if (!email) return;
        const ts = new Date(att.meeting_slot?.scheduled_at || 0).getTime();
        const prev = bookedByDeal.get(att.deal_id);
        if (!prev || ts > prev.ts) bookedByDeal.set(att.deal_id, { email, ts });
      });

      // 4) fallback: owner_id do deal para os que não tinham booked_by
      const missing = ids.filter((id) => !bookedByDeal.has(id));
      if (missing.length > 0) {
        const { data: deals } = await supabase
          .from('crm_deals')
          .select('id, owner_id')
          .in('id', missing);
        (deals as any[] || []).forEach((d) => {
          const email = (d.owner_id || '').toLowerCase();
          if (email) bookedByDeal.set(d.id, { email, ts: 0 });
        });
      }

      // 5) agregar por SDR
      const byEmail = new Map<string, number>();
      bookedByDeal.forEach(({ email }) => {
        byEmail.set(email, (byEmail.get(email) || 0) + 1);
      });
      return byEmail;
    },
  });
}