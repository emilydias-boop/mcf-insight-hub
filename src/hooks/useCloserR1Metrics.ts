import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfDay, endOfDay, format } from "date-fns";

export interface CloserR1Metric {
  closer_id: string;
  closer_name: string;
  closer_color: string | null;
  agendada: number;
  realizada: number;
  noShow: number;
  contratoPago: number;
  taxaRealizacao: number;
}

export function useCloserR1Metrics(weekStart: Date, weekEnd: Date) {
  return useQuery({
    queryKey: ['closer-r1-metrics', format(weekStart, 'yyyy-MM-dd'), format(weekEnd, 'yyyy-MM-dd')],
    queryFn: async (): Promise<CloserR1Metric[]> => {
      // 1. Fetch R1 meeting slots for the week
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
            status
          )
        `)
        .eq('meeting_type', 'r1')
        .gte('scheduled_at', startOfDay(weekStart).toISOString())
        .lte('scheduled_at', endOfDay(weekEnd).toISOString())
        .not('status', 'in', '("cancelled","rescheduled")');

      if (slotsError) {
        console.error('Error fetching R1 slots:', slotsError);
        return [];
      }

      // 2. Aggregate by closer
      const closerMap = new Map<string, CloserR1Metric>();

      slots?.forEach((slot: any) => {
        const closerId = slot.closer_id;
        const closer = slot.closer;
        
        if (!closerId || !closer) return;

        if (!closerMap.has(closerId)) {
          closerMap.set(closerId, {
            closer_id: closerId,
            closer_name: closer.name,
            closer_color: closer.color,
            agendada: 0,
            realizada: 0,
            noShow: 0,
            contratoPago: 0,
            taxaRealizacao: 0,
          });
        }

        const metric = closerMap.get(closerId)!;
        
        // Count attendees in this slot
        const attendees = slot.attendees || [];
        attendees.forEach((att: any) => {
          metric.agendada++;
          
          if (att.status === 'completed' || att.status === 'contract_paid') {
            metric.realizada++;
          }
          if (att.status === 'no_show') {
            metric.noShow++;
          }
          if (att.status === 'contract_paid') {
            metric.contratoPago++;
          }
        });
      });

      // 3. Calculate conversion rates
      const results = Array.from(closerMap.values()).map(m => ({
        ...m,
        taxaRealizacao: m.agendada > 0 ? (m.realizada / m.agendada) * 100 : 0,
      }));

      // Sort by agendada desc
      return results.sort((a, b) => b.agendada - a.agendada);
    },
    refetchInterval: 30000,
  });
}
