import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

export interface PerformanceReportFilters {
  startDate: Date;
  endDate: Date;
  closerId?: string;
}

export interface PerformanceReportRow {
  closerId: string;
  closerName: string;
  closerEmail: string;
  totalAgendadas: number;
  realizadas: number;
  noShows: number;
  contratos: number;
  percentComparecimento: number;
  percentConversao: number;
}

export const usePerformanceReport = (filters: PerformanceReportFilters) => {
  return useQuery({
    queryKey: ['performance-report', filters],
    queryFn: async (): Promise<PerformanceReportRow[]> => {
      const startISO = format(filters.startDate, 'yyyy-MM-dd') + 'T00:00:00';
      const endISO = format(filters.endDate, 'yyyy-MM-dd') + 'T23:59:59';

      // Query meeting_slot_attendees with meeting_slots to get closer performance
      let query = supabase
        .from('meeting_slot_attendees')
        .select(`
          id,
          status,
          meeting_slots!inner (
            id,
            scheduled_at,
            closer_id,
            closers (
              id,
              name,
              email
            )
          )
        `)
        .gte('meeting_slots.scheduled_at', startISO)
        .lte('meeting_slots.scheduled_at', endISO)
        .not('status', 'in', '("canceled","rescheduled")');

      // Filter by specific closer if provided
      if (filters.closerId) {
        query = query.eq('meeting_slots.closer_id', filters.closerId);
      }

      const { data, error } = await query;

      if (error) throw error;
      if (!data) return [];

      // Aggregate by closer
      const closerMap = new Map<string, {
        closerId: string;
        closerName: string;
        closerEmail: string;
        totalAgendadas: number;
        realizadas: number;
        noShows: number;
        contratos: number;
      }>();

      data.forEach((row: any) => {
        const closer = row.meeting_slots?.closers;
        if (!closer) return;

        const closerId = closer.id;
        const status = row.status;

        if (!closerMap.has(closerId)) {
          closerMap.set(closerId, {
            closerId,
            closerName: closer.name || 'N/A',
            closerEmail: closer.email || '',
            totalAgendadas: 0,
            realizadas: 0,
            noShows: 0,
            contratos: 0,
          });
        }

        const entry = closerMap.get(closerId)!;
        entry.totalAgendadas++;

        if (status === 'completed' || status === 'contract_paid') {
          entry.realizadas++;
        }
        if (status === 'no_show') {
          entry.noShows++;
        }
        if (status === 'contract_paid') {
          entry.contratos++;
        }
      });

      // Calculate percentages and return
      return Array.from(closerMap.values()).map(entry => ({
        ...entry,
        percentComparecimento: entry.totalAgendadas > 0 
          ? Math.round((entry.realizadas / entry.totalAgendadas) * 100) 
          : 0,
        percentConversao: entry.realizadas > 0 
          ? Math.round((entry.contratos / entry.realizadas) * 100) 
          : 0,
      })).sort((a, b) => b.contratos - a.contratos);
    },
    enabled: filters.startDate instanceof Date && filters.endDate instanceof Date,
    staleTime: 2 * 60 * 1000,
  });
};
