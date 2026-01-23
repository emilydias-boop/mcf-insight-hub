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

      // 2. Fetch R2 meetings with approved attendees for the week
      const { data: slots, error: slotsError } = await supabase
        .from('meeting_slots')
        .select(`
          id,
          closer_id,
          status,
          scheduled_at,
          closer:closers(
            id,
            name,
            color
          ),
          attendees:meeting_slot_attendees(
            id,
            r2_status_id
          )
        `)
        .eq('meeting_type', 'r2')
        .gte('scheduled_at', weekStart.toISOString())
        .lte('scheduled_at', weekEnd.toISOString())
        .not('status', 'in', '("cancelled","rescheduled")');

      if (slotsError) {
        console.error('Error fetching R2 slots:', slotsError);
        return [];
      }

      // 3. Aggregate by closer - count approved attendees
      const closerMap = new Map<string, CloserCarrinhoMetric>();

      slots?.forEach((slot: any) => {
        const closerId = slot.closer_id;
        const closer = slot.closer;
        
        if (!closerId || !closer) return;

        if (!closerMap.has(closerId)) {
          closerMap.set(closerId, {
            closer_id: closerId,
            closer_name: closer.name,
            closer_color: closer.color,
            aprovados: 0,
          });
        }

        const metric = closerMap.get(closerId)!;
        
        // Count approved attendees in this slot
        const attendees = slot.attendees || [];
        attendees.forEach((att: any) => {
          if (aprovadoStatusIds.includes(att.r2_status_id)) {
            metric.aprovados++;
          }
        });
      });

      // Sort by aprovados desc
      return Array.from(closerMap.values())
        .filter(m => m.aprovados > 0)
        .sort((a, b) => b.aprovados - a.aprovados);
    },
    refetchInterval: 30000,
  });
}
