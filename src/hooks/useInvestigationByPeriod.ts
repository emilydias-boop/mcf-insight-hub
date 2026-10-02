import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, eachDayOfInterval } from 'date-fns';

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

export interface InvestigacaoReuniao {
  attendee_id: string;
  dia: string; // YYYY-MM-DD em horário de SP
  scheduled_at: string;
  status: string | null;
  closer_id: string | null;
  closer_name: string | null;
  booked_by: string | null;
  sdr_name: string | null;
}

/** Chama investigacao_reunioes (só R1, sem parceiros, só closers da BU). */
export async function fetchInvestigacaoReunioes(startDate: Date, endDate: Date, bu: string): Promise<InvestigacaoReuniao[]> {
  const { data, error } = await (supabase.rpc as any)('investigacao_reunioes', {
    p_from: format(startDate, 'yyyy-MM-dd'),
    p_to: format(endDate, 'yyyy-MM-dd'),
    p_bu: bu,
  });
  if (error) throw error;
  return (Array.isArray(data) ? data : []) as InvestigacaoReuniao[];
}

export function useInvestigationByPeriod(
  personId: string | null,
  type: 'closer' | 'sdr',
  startDate: Date | null,
  endDate: Date | null,
  bu: string
) {
  return useQuery({
    queryKey: ['investigation-period', personId, type, startDate?.toISOString(), endDate?.toISOString(), bu],
    queryFn: async (): Promise<PeriodData> => {
      if (!personId || !startDate || !endDate) {
        return { daily: [], summary: emptySummary() };
      }

      const isAll = personId === '__all__';
      let rows = await fetchInvestigacaoReunioes(startDate, endDate, bu);

      if (type === 'closer') {
        if (!isAll) rows = rows.filter(r => r.closer_id === personId);
      } else if (isAll) {
        rows = rows.filter(r => !!r.booked_by);
      } else {
        const { data: emp } = await supabase
          .from('employees')
          .select('profile_id')
          .eq('id', personId)
          .single();
        if (!emp?.profile_id) return { daily: [], summary: emptySummary() };
        rows = rows.filter(r => r.booked_by === emp.profile_id);
      }

      const dayMap = new Map<string, DailyMetric>();
      for (const r of rows) {
        const day = r.dia;
        if (!dayMap.has(day)) dayMap.set(day, { date: day, agendadas: 0, realizadas: 0, noShows: 0, contratosPagos: 0 });
        const m = dayMap.get(day)!;
        m.agendadas++;
        if (r.status === 'completed') m.realizadas++;
        if (r.status === 'no_show') m.noShows++;
        if (r.status === 'contract_paid') m.contratosPagos++;
      }

      const allDays = eachDayOfInterval({ start: startDate, end: endDate });
      const daily = allDays.map(day => {
        const key = format(day, 'yyyy-MM-dd');
        return dayMap.get(key) || { date: key, agendadas: 0, realizadas: 0, noShows: 0, contratosPagos: 0 };
      });

      const total = rows.length;
      const realizadas = rows.filter(a => a.status === 'completed').length;
      const noShows = rows.filter(a => a.status === 'no_show').length;
      const contratosPagos = rows.filter(a => a.status === 'contract_paid').length;
      const agendadas = rows.filter(a => ['scheduled', 'invited', 'rescheduled'].includes(a.status || '')).length;

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
