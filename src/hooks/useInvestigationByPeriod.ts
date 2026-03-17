import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, endOfDay, format, eachDayOfInterval } from 'date-fns';

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
      const isAll = personId === '__all__';

      let attendees: Array<{ status: string | null; scheduled_at: string; is_partner: boolean | null }> = [];

      if (type === 'closer') {
        // Get slots for closer(s) in the range
        let slotsQuery = supabase
          .from('meeting_slots')
          .select('id, scheduled_at')
          .gte('scheduled_at', rangeStart)
          .lte('scheduled_at', rangeEnd);

        if (!isAll) {
          slotsQuery = slotsQuery.eq('closer_id', personId);
        }

        const { data: slots, error } = await slotsQuery;
        if (error) throw error;
        if (!slots || slots.length === 0) return { daily: [], summary: emptySummary() };

        const slotIds = slots.map(s => s.id);
        const slotMap = Object.fromEntries(slots.map(s => [s.id, s.scheduled_at]));

        // Batch in chunks of 200
        const allAtts: typeof attendees = [];
        for (let i = 0; i < slotIds.length; i += 200) {
          const chunk = slotIds.slice(i, i + 200);
          const { data: atts } = await supabase
            .from('meeting_slot_attendees')
            .select('status, is_partner, meeting_slot_id')
            .in('meeting_slot_id', chunk);
          if (atts) {
            for (const a of atts) {
              allAtts.push({
                status: a.status,
                scheduled_at: slotMap[a.meeting_slot_id] || '',
                is_partner: a.is_partner,
              });
            }
          }
        }
        attendees = allAtts;
      } else {
        // SDR path
        if (isAll) {
          // Get ALL slots in range, then attendees with booked_by set
          const { data: slots } = await supabase
            .from('meeting_slots')
            .select('id, scheduled_at')
            .gte('scheduled_at', rangeStart)
            .lte('scheduled_at', rangeEnd);

          if (!slots || slots.length === 0) return { daily: [], summary: emptySummary() };

          const slotIds = slots.map(s => s.id);
          const slotMap = Object.fromEntries(slots.map(s => [s.id, s.scheduled_at]));

          const allAtts: typeof attendees = [];
          for (let i = 0; i < slotIds.length; i += 200) {
            const chunk = slotIds.slice(i, i + 200);
            const { data: atts } = await supabase
              .from('meeting_slot_attendees')
              .select('status, is_partner, meeting_slot_id')
              .in('meeting_slot_id', chunk)
              .not('booked_by', 'is', null);
            if (atts) {
              for (const a of atts) {
                allAtts.push({
                  status: a.status,
                  scheduled_at: slotMap[a.meeting_slot_id] || '',
                  is_partner: a.is_partner,
                });
              }
            }
          }
          attendees = allAtts;
        } else {
          // Individual SDR
          const { data: emp } = await supabase
            .from('employees')
            .select('profile_id')
            .eq('id', personId)
            .single();

          if (!emp?.profile_id) return { daily: [], summary: emptySummary() };

          const { data: atts } = await supabase
            .from('meeting_slot_attendees')
            .select('status, is_partner, meeting_slot_id, booked_at')
            .eq('booked_by', emp.profile_id);

          if (!atts || atts.length === 0) return { daily: [], summary: emptySummary() };

          const slotIds = [...new Set(atts.map(a => a.meeting_slot_id))];
          const allSlots: Array<{ id: string; scheduled_at: string }> = [];
          for (let i = 0; i < slotIds.length; i += 200) {
            const chunk = slotIds.slice(i, i + 200);
            const { data: slots } = await supabase
              .from('meeting_slots')
              .select('id, scheduled_at')
              .in('id', chunk)
              .gte('scheduled_at', rangeStart)
              .lte('scheduled_at', rangeEnd);
            if (slots) allSlots.push(...slots);
          }

          const slotMap = Object.fromEntries(allSlots.map(s => [s.id, s.scheduled_at]));

          attendees = atts
            .filter(a => slotMap[a.meeting_slot_id])
            .map(a => ({
              status: a.status,
              scheduled_at: slotMap[a.meeting_slot_id],
              is_partner: a.is_partner,
            }));
        }
      }

      // Filter out partners and rescheduled attendees
      const nonPartner = attendees.filter(a => !a.is_partner && a.status !== 'rescheduled');

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

      // Fill all days in the range, including days with zero activity
      const allDays = eachDayOfInterval({ start: startDate, end: endDate });
      const daily = allDays.map(day => {
        const key = format(day, 'yyyy-MM-dd');
        return dayMap.get(key) || { date: key, agendadas: 0, realizadas: 0, noShows: 0, contratosPagos: 0 };
      });

      const total = nonPartner.length;
      const realizadas = nonPartner.filter(a => a.status === 'completed').length;
      const noShows = nonPartner.filter(a => a.status === 'no_show').length;
      const contratosPagos = nonPartner.filter(a => a.status === 'contract_paid').length;
      const agendadas = nonPartner.filter(a => ['scheduled', 'invited', 'rescheduled'].includes(a.status || '')).length;

      const atendidas = realizadas + contratosPagos;
      const totalAgendadasReal = total - agendadas;

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
