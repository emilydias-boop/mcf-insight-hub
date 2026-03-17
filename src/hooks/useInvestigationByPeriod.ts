import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, endOfDay, format } from 'date-fns';

export interface DailyMetric {
  date: string; // yyyy-MM-dd
  agendadas: number;
  realizadas: number;
  noShows: number;
  contratosPagos: number;
}

export interface PeriodSummary {
  total: number;
  realizadas: number;
  noShows: number;
  contratosPagos: number;
  agendadas: number;
  taxaComparecimento: number;
  taxaConversao: number;
  taxaNoShow: number;
}

export interface PeriodData {
  daily: DailyMetric[];
  summary: PeriodSummary;
}

export function useInvestigationByPeriod(
  personId: string | null,
  type: 'closer' | 'sdr',
  startDate: Date | null,
  endDate: Date | null
) {
  return useQuery({
    queryKey: ['investigation-period', personId, type, startDate?.toISOString(), endDate?.toISOString()],
    queryFn: async (): Promise<PeriodData> => {
      if (!personId || !startDate || !endDate) {
        return { daily: [], summary: emptySummary() };
      }

      const rangeStart = startOfDay(startDate).toISOString();
      const rangeEnd = endOfDay(endDate).toISOString();

      let attendees: Array<{ status: string | null; scheduled_at: string; is_partner: boolean | null }> = [];

      if (type === 'closer') {
        // Get slots for this closer in the range
        const { data: slots, error } = await supabase
          .from('meeting_slots')
          .select('id, scheduled_at')
          .eq('closer_id', personId)
          .gte('scheduled_at', rangeStart)
          .lte('scheduled_at', rangeEnd);

        if (error) throw error;
        if (!slots || slots.length === 0) return { daily: [], summary: emptySummary() };

        const slotIds = slots.map(s => s.id);
        const slotMap = Object.fromEntries(slots.map(s => [s.id, s.scheduled_at]));

        // Batch if needed
        const { data: atts } = await supabase
          .from('meeting_slot_attendees')
          .select('status, is_partner, meeting_slot_id')
          .in('meeting_slot_id', slotIds);

        attendees = (atts || []).map(a => ({
          status: a.status,
          scheduled_at: slotMap[a.meeting_slot_id] || '',
          is_partner: a.is_partner,
        }));
      } else {
        // SDR: personId is employee_id, need profile_id
        const { data: emp } = await supabase
          .from('employees')
          .select('profile_id')
          .eq('id', personId)
          .single();

        if (!emp?.profile_id) return { daily: [], summary: emptySummary() };

        // Get attendees booked by this SDR
        const { data: atts } = await supabase
          .from('meeting_slot_attendees')
          .select('status, is_partner, meeting_slot_id, booked_at')
          .eq('booked_by', emp.profile_id);

        if (!atts || atts.length === 0) return { daily: [], summary: emptySummary() };

        // Get slot scheduled_at for filtering by date range
        const slotIds = [...new Set(atts.map(a => a.meeting_slot_id))];
        const { data: slots } = await supabase
          .from('meeting_slots')
          .select('id, scheduled_at')
          .in('id', slotIds)
          .gte('scheduled_at', rangeStart)
          .lte('scheduled_at', rangeEnd);

        const slotMap = Object.fromEntries((slots || []).map(s => [s.id, s.scheduled_at]));

        attendees = atts
          .filter(a => slotMap[a.meeting_slot_id])
          .map(a => ({
            status: a.status,
            scheduled_at: slotMap[a.meeting_slot_id],
            is_partner: a.is_partner,
          }));
      }

      // Filter out partners
      const nonPartner = attendees.filter(a => !a.is_partner);

      // Group by day
      const dayMap = new Map<string, DailyMetric>();

      for (const att of nonPartner) {
        const day = format(new Date(att.scheduled_at), 'yyyy-MM-dd');
        if (!dayMap.has(day)) {
          dayMap.set(day, { date: day, agendadas: 0, realizadas: 0, noShows: 0, contratosPagos: 0 });
        }
        const m = dayMap.get(day)!;
        m.agendadas++;
        if (att.status === 'completed') m.realizadas++;
        if (att.status === 'no_show') m.noShows++;
        if (att.status === 'contract_paid') m.contratosPagos++;
      }

      const daily = Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date));

      const total = nonPartner.length;
      const realizadas = nonPartner.filter(a => a.status === 'completed').length;
      const noShows = nonPartner.filter(a => a.status === 'no_show').length;
      const contratosPagos = nonPartner.filter(a => a.status === 'contract_paid').length;
      const agendadas = nonPartner.filter(a => ['scheduled', 'invited', 'rescheduled'].includes(a.status || '')).length;

      const atendidas = realizadas + contratosPagos;
      const totalAgendadasReal = total - agendadas; // already happened

      return {
        daily,
        summary: {
          total,
          realizadas,
          noShows,
          contratosPagos,
          agendadas,
          taxaComparecimento: totalAgendadasReal > 0 ? (atendidas / totalAgendadasReal) * 100 : 0,
          taxaConversao: atendidas > 0 ? (contratosPagos / atendidas) * 100 : 0,
          taxaNoShow: totalAgendadasReal > 0 ? (noShows / totalAgendadasReal) * 100 : 0,
        },
      };
    },
    enabled: !!personId && !!startDate && !!endDate,
  });
}

function emptySummary(): PeriodSummary {
  return { total: 0, realizadas: 0, noShows: 0, contratosPagos: 0, agendadas: 0, taxaComparecimento: 0, taxaConversao: 0, taxaNoShow: 0 };
}
