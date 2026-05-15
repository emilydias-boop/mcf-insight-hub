import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type R1Bucket = 'all' | 'agendadas' | 'no_show' | 'perdidas';

export interface HistoricoR1Item {
  id: string;
  scheduled_at: string | null;
  status: string | null;
  attendee_name: string | null;
  attendee_phone: string | null;
  notes: string | null;
  closer_notes: string | null;
  is_reschedule: boolean | null;
  contract_paid_at: string | null;
  deal_id: string | null;
  closer_id: string | null;
  closer_name: string | null;
  bucket: 'agendada' | 'realizada' | 'no_show' | 'perdida' | 'paga';
}

const PERDIDA_STATUSES = new Set([
  'cancelled',
  'cancelado',
  'canceled',
  'refunded',
  'reembolsado',
  'lost',
  'perdida',
]);

function bucketFor(status: string | null, contractPaidAt: string | null): HistoricoR1Item['bucket'] {
  if (contractPaidAt) return 'paga';
  const s = (status ?? '').toLowerCase();
  if (s.includes('no_show') || s === 'no-show' || s === 'noshow') return 'no_show';
  if (PERDIDA_STATUSES.has(s)) return 'perdida';
  if (s.includes('realizad') || s === 'completed' || s === 'showed') return 'realizada';
  return 'agendada';
}

export function useMeuHistoricoR1(params: {
  userId: string | null;
  days: number;
  bucket: R1Bucket;
}) {
  return useQuery({
    queryKey: ['meu-historico-r1', params],
    enabled: !!params.userId,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - params.days);

      const { data: attendees, error } = await supabase
        .from('meeting_slot_attendees')
        .select(
          'id,meeting_slot_id,deal_id,attendee_name,attendee_phone,status,notes,closer_notes,is_reschedule,contract_paid_at,booked_at,created_at,booked_by'
        )
        .eq('booked_by', params.userId!)
        .gte('created_at', since.toISOString())
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;

      const slotIds = Array.from(new Set((attendees || []).map((a: any) => a.meeting_slot_id).filter(Boolean)));
      const slotsRes = slotIds.length
        ? await supabase
            .from('meeting_slots')
            .select('id,scheduled_at,closer_id')
            .in('id', slotIds)
        : { data: [], error: null } as any;
      const slotsMap = new Map<string, any>((slotsRes.data || []).map((s: any) => [s.id, s]));

      const closerIds = Array.from(new Set((slotsRes.data || []).map((s: any) => s.closer_id).filter(Boolean)));
      const closersRes = closerIds.length
        ? await supabase.from('profiles').select('id,full_name').in('id', closerIds)
        : { data: [], error: null } as any;
      const closersMap = new Map<string, any>((closersRes.data || []).map((p: any) => [p.id, p]));

      const items: HistoricoR1Item[] = (attendees || []).map((a: any) => {
        const slot = slotsMap.get(a.meeting_slot_id);
        const closer = slot?.closer_id ? closersMap.get(slot.closer_id) : null;
        return {
          id: a.id,
          scheduled_at: slot?.scheduled_at ?? a.booked_at ?? null,
          status: a.status,
          attendee_name: a.attendee_name,
          attendee_phone: a.attendee_phone,
          notes: a.notes,
          closer_notes: a.closer_notes,
          is_reschedule: a.is_reschedule,
          contract_paid_at: a.contract_paid_at,
          deal_id: a.deal_id,
          closer_id: slot?.closer_id ?? null,
          closer_name: closer?.full_name ?? null,
          bucket: bucketFor(a.status, a.contract_paid_at),
        };
      });

      if (params.bucket === 'all') return items;
      if (params.bucket === 'agendadas') return items.filter((i) => i.bucket === 'agendada' || i.bucket === 'realizada' || i.bucket === 'paga');
      if (params.bucket === 'no_show') return items.filter((i) => i.bucket === 'no_show');
      if (params.bucket === 'perdidas') return items.filter((i) => i.bucket === 'perdida');
      return items;
    },
  });
}