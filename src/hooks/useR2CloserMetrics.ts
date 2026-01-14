import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export interface R2CloserMetric {
  closer_id: string;
  closer_name: string;
  closer_color: string | null;
  r1_agendada: number;
  r1_realizada: number;
  noshow: number;
  contrato_pago: number;
  r2_agendada: number;
}

export function useR2CloserMetrics(startDate: Date, endDate: Date) {
  return useQuery({
    queryKey: ['r2-closer-metrics', format(startDate, 'yyyy-MM-dd'), format(endDate, 'yyyy-MM-dd')],
    queryFn: async () => {
      // Fetch all R2 closers
      const { data: closers, error: closersError } = await supabase
        .from('closers')
        .select('id, name, color')
        .eq('meeting_type', 'r2')
        .eq('is_active', true)
        .order('name');

      if (closersError) throw closersError;

      // Fetch all R2 meetings in the period
      const { data: meetings, error: meetingsError } = await supabase
        .from('meeting_slots')
        .select(`
          id,
          closer_id,
          status,
          scheduled_at,
          attendees:meeting_slot_attendees(
            id,
            status
          )
        `)
        .eq('meeting_type', 'r2')
        .gte('scheduled_at', startDate.toISOString())
        .lte('scheduled_at', endDate.toISOString());

      if (meetingsError) throw meetingsError;

      // Calculate metrics per closer
      const metrics: R2CloserMetric[] = (closers || []).map(closer => {
        const closerMeetings = meetings?.filter(m => m.closer_id === closer.id) || [];
        
        // R2 agendada = total de reuniões agendadas para este closer R2
        const r2_agendada = closerMeetings.length;
        
        // R1 Realizada = reuniões com status 'completed' ou attendee status 'completed'
        const r1_realizada = closerMeetings.filter(m => {
          const attendee = m.attendees?.[0];
          return m.status === 'completed' || attendee?.status === 'completed';
        }).length;
        
        // No-show = reuniões com status 'no_show' ou attendee status 'no_show'
        const noshow = closerMeetings.filter(m => {
          const attendee = m.attendees?.[0];
          return m.status === 'no_show' || attendee?.status === 'no_show';
        }).length;
        
        // R1 Agendada = scheduled + rescheduled
        const r1_agendada = closerMeetings.filter(m => 
          m.status === 'scheduled' || m.status === 'rescheduled'
        ).length;
        
        // Contrato pago = reuniões marcadas como vendidas
        const contrato_pago = closerMeetings.filter(m => {
          const attendee = m.attendees?.[0];
          return attendee?.status === 'sold' || m.status === 'sold';
        }).length;

        return {
          closer_id: closer.id,
          closer_name: closer.name,
          closer_color: closer.color,
          r1_agendada,
          r1_realizada,
          noshow,
          contrato_pago,
          r2_agendada
        };
      });

      return metrics;
    }
  });
}

export function useR2WeeklyMetrics() {
  const now = new Date();
  const weekStart = startOfWeek(now, { locale: ptBR, weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { locale: ptBR, weekStartsOn: 1 });
  
  return useR2CloserMetrics(weekStart, weekEnd);
}

export function useR2MonthlyMetrics() {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  
  return useR2CloserMetrics(monthStart, monthEnd);
}
