import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfDay, endOfDay, format } from "date-fns";

export interface R1CloserMetric {
  closer_id: string;
  closer_name: string;
  closer_color: string | null;
  r1_agendada: number;
  r1_realizada: number;
  noshow: number;
  contrato_pago: number;
  r2_agendada: number;
}

export function useR1CloserMetrics(startDate: Date, endDate: Date) {
  return useQuery({
    queryKey: ['r1-closer-metrics', format(startDate, 'yyyy-MM-dd'), format(endDate, 'yyyy-MM-dd')],
    queryFn: async (): Promise<R1CloserMetric[]> => {
      const start = startOfDay(startDate).toISOString();
      const end = endOfDay(endDate).toISOString();

      // Fetch active closers that handle R1 meetings
      const { data: closers, error: closersError } = await supabase
        .from('closers')
        .select('id, name, color, meeting_type')
        .eq('is_active', true);

      if (closersError) throw closersError;

      // Filter closers that handle R1 (meeting_type is null or 'r1')
      const r1Closers = closers?.filter(c => !c.meeting_type || c.meeting_type === 'r1') || [];

      // Fetch R1 meeting slots with attendees in the period
      const { data: meetings, error: meetingsError } = await supabase
        .from('meeting_slots')
        .select(`
          id,
          closer_id,
          meeting_type,
          scheduled_at,
          meeting_slot_attendees (
            id,
            status,
            deal_id
          )
        `)
        .eq('meeting_type', 'r1')
        .gte('scheduled_at', start)
        .lte('scheduled_at', end)
        .not('status', 'eq', 'cancelled');

      if (meetingsError) throw meetingsError;

      // Fetch R2 meetings to count R2 agendadas per closer
      // R2 is attributed to the closer who did the R1 for the same deal
      const { data: r2Meetings, error: r2Error } = await supabase
        .from('meeting_slots')
        .select(`
          id,
          scheduled_at,
          meeting_slot_attendees (
            deal_id
          )
        `)
        .eq('meeting_type', 'r2')
        .gte('scheduled_at', start)
        .lte('scheduled_at', end)
        .not('status', 'eq', 'cancelled');

      if (r2Error) throw r2Error;

      // Build a map of deal_id -> R1 closer_id
      const dealToR1Closer = new Map<string, string>();
      meetings?.forEach(meeting => {
        meeting.meeting_slot_attendees?.forEach(att => {
          if (att.deal_id && meeting.closer_id) {
            dealToR1Closer.set(att.deal_id, meeting.closer_id);
          }
        });
      });

      // Count R2 meetings per R1 closer
      const r2CountByCloser = new Map<string, number>();
      r2Meetings?.forEach(meeting => {
        meeting.meeting_slot_attendees?.forEach(att => {
          if (att.deal_id) {
            const r1CloserId = dealToR1Closer.get(att.deal_id);
            if (r1CloserId) {
              r2CountByCloser.set(r1CloserId, (r2CountByCloser.get(r1CloserId) || 0) + 1);
            }
          }
        });
      });

      // Calculate metrics for each R1 closer
      const metricsMap = new Map<string, R1CloserMetric>();

      // Initialize all R1 closers with zeros
      r1Closers.forEach(closer => {
        metricsMap.set(closer.id, {
          closer_id: closer.id,
          closer_name: closer.name,
          closer_color: closer.color,
          r1_agendada: 0,
          r1_realizada: 0,
          noshow: 0,
          contrato_pago: 0,
          r2_agendada: r2CountByCloser.get(closer.id) || 0,
        });
      });

      // Process meetings
      meetings?.forEach(meeting => {
        const closerId = meeting.closer_id;
        if (!closerId) return;

        let metric = metricsMap.get(closerId);
        if (!metric) {
          // Closer might not be in R1 closers list, but has R1 meetings
          const closerInfo = closers?.find(c => c.id === closerId);
          metric = {
            closer_id: closerId,
            closer_name: closerInfo?.name || 'Desconhecido',
            closer_color: closerInfo?.color || null,
            r1_agendada: 0,
            r1_realizada: 0,
            noshow: 0,
            contrato_pago: 0,
            r2_agendada: r2CountByCloser.get(closerId) || 0,
          };
          metricsMap.set(closerId, metric);
        }

        // Count attendees by status
        meeting.meeting_slot_attendees?.forEach(att => {
          const status = att.status;
          
          // R1 Agendada: all non-cancelled attendees
          if (status !== 'cancelled') {
            metric!.r1_agendada++;
          }
          
          // R1 Realizada: completed
          if (status === 'completed') {
            metric!.r1_realizada++;
          }
          
          // No-show
          if (status === 'no_show') {
            metric!.noshow++;
          }
          
          // Contrato Pago
          if (status === 'contract_paid') {
            metric!.contrato_pago++;
          }
        });
      });

      // Convert to array and sort by r1_agendada desc
      return Array.from(metricsMap.values()).sort((a, b) => b.r1_agendada - a.r1_agendada);
    },
    staleTime: 30000,
  });
}
