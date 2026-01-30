import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { getCustomWeekStart, getCustomWeekEnd } from "@/lib/dateHelpers";

export interface CloserCarrinhoMetric {
  closer_id: string;
  closer_name: string;
  closer_color: string | null;
  aprovados: number;
}

export function useCloserCarrinhoMetrics(weekDate: Date) {
  const weekStart = getCustomWeekStart(weekDate);
  const weekEnd = getCustomWeekEnd(weekDate);

  return useQuery({
    queryKey: ['closer-carrinho-metrics', format(weekStart, 'yyyy-MM-dd'), format(weekEnd, 'yyyy-MM-dd')],
    queryFn: async (): Promise<CloserCarrinhoMetric[]> => {
      // 1. Fetch R2 status options to find "aprovado"
      const { data: statusOptions, error: statusError } = await supabase
        .from('r2_status_options')
        .select('id, name')
        .ilike('name', '%aprov%');

      if (statusError) {
        console.error('Error fetching R2 status options:', statusError);
        return [];
      }

      const aprovadoStatusIds = statusOptions?.map(s => s.id) || [];
      if (aprovadoStatusIds.length === 0) {
        return [];
      }

      // 2. Fetch R2 attendees with "aprovado" status for the week (get deal_id)
      const { data: r2Attendees, error: r2Error } = await supabase
        .from('meeting_slot_attendees')
        .select(`
          id,
          deal_id,
          r2_status_id,
          meeting_slot:meeting_slots!inner(
            id,
            scheduled_at,
            meeting_type,
            status
          )
        `)
        .eq('meeting_slot.meeting_type', 'r2')
        .in('r2_status_id', aprovadoStatusIds)
        .gte('meeting_slot.scheduled_at', weekStart.toISOString())
        .lte('meeting_slot.scheduled_at', weekEnd.toISOString())
        .not('meeting_slot.status', 'in', '("cancelled","rescheduled")');

      if (r2Error) {
        console.error('Error fetching R2 attendees:', r2Error);
        return [];
      }

      // 3. Get unique deal_ids from R2 approved attendees
      const dealIds = new Set<string>();
      r2Attendees?.forEach((att: any) => {
        if (att.deal_id) dealIds.add(att.deal_id);
      });

      if (dealIds.size === 0) {
        return [];
      }

      // 4. Fetch R1 attendees for these deals to get meeting_slot_id
      const { data: r1Attendees, error: r1Error } = await supabase
        .from('meeting_slot_attendees')
        .select(`
          id,
          deal_id,
          meeting_slot_id,
          meeting_slot:meeting_slots!inner(
            id,
            meeting_type,
            closer_id
          )
        `)
        .in('deal_id', Array.from(dealIds))
        .eq('meeting_slot.meeting_type', 'r1');

      if (r1Error) {
        console.error('Error fetching R1 attendees:', r1Error);
        return [];
      }

      // 5. Build map: deal_id -> closer_id (from R1 slot)
      const dealToCloserId = new Map<string, string>();
      r1Attendees?.forEach((att: any) => {
        if (att.deal_id && att.meeting_slot?.closer_id) {
          // Keep the first closer_id found (original R1)
          if (!dealToCloserId.has(att.deal_id)) {
            dealToCloserId.set(att.deal_id, att.meeting_slot.closer_id);
          }
        }
      });

      // 6. Get unique closer IDs
      const closerIds = new Set<string>(dealToCloserId.values());
      if (closerIds.size === 0) {
        return [];
      }

      // 7. Fetch closers info
      const { data: closers, error: closersError } = await supabase
        .from('closers')
        .select('id, name, color')
        .in('id', Array.from(closerIds));

      if (closersError) {
        console.error('Error fetching closers:', closersError);
        return [];
      }

      // Map closer ID to info
      const closerInfoMap = new Map<string, { name: string; color: string | null }>();
      closers?.forEach((c: any) => {
        closerInfoMap.set(c.id, { name: c.name, color: c.color });
      });

      // 8. Aggregate by Closer R1
      const closerMap = new Map<string, CloserCarrinhoMetric>();
      let unassignedCount = 0;

      r2Attendees?.forEach((att: any) => {
        const dealId = att.deal_id;
        if (!dealId) {
          unassignedCount++;
          return;
        }

        const closerId = dealToCloserId.get(dealId);
        if (!closerId) {
          unassignedCount++;
          return;
        }

        const closerInfo = closerInfoMap.get(closerId);
        if (!closerInfo) {
          unassignedCount++;
          return;
        }

        if (!closerMap.has(closerId)) {
          closerMap.set(closerId, {
            closer_id: closerId,
            closer_name: closerInfo.name,
            closer_color: closerInfo.color,
            aprovados: 0,
          });
        }

        const metric = closerMap.get(closerId)!;
        metric.aprovados++;
      });

      // Sort by aprovados desc
      const result = Array.from(closerMap.values())
        .filter(m => m.aprovados > 0)
        .sort((a, b) => b.aprovados - a.aprovados);

      // Add unassigned leads as a special entry
      if (unassignedCount > 0) {
        result.push({
          closer_id: 'unassigned',
          closer_name: 'Sem Closer',
          closer_color: '#6B7280',
          aprovados: unassignedCount,
        });
      }

      return result;
    },
    refetchInterval: 60000, // 1 minuto
  });
}
