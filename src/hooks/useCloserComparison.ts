import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, endOfDay } from 'date-fns';

export interface ComparisonEntry {
  id: string;
  name: string;
  total: number;
  realizadas: number;
  noShows: number;
  contratosPagos: number;
  taxaConversao: number;
  taxaComparecimento: number;
  taxaNoShow: number;
}

export function useCloserComparison(
  startDate: Date | null,
  endDate: Date | null,
  highlightId: string | null,
  type: 'closer' | 'sdr' = 'closer'
) {
  return useQuery({
    queryKey: ['team-comparison', type, startDate?.toISOString(), endDate?.toISOString()],
    queryFn: async (): Promise<ComparisonEntry[]> => {
      if (!startDate || !endDate) return [];

      const rangeStart = startOfDay(startDate).toISOString();
      const rangeEnd = endOfDay(endDate).toISOString();

      // Get all slots in range
      const { data: slots } = await supabase
        .from('meeting_slots')
        .select('id, closer_id, scheduled_at')
        .gte('scheduled_at', rangeStart)
        .lte('scheduled_at', rangeEnd);

      if (!slots || slots.length === 0) return [];

      const slotIds = slots.map(s => s.id);

      // Batch attendees
      const allAtts: Array<{ status: string | null; is_partner: boolean | null; meeting_slot_id: string; booked_by: string | null }> = [];
      for (let i = 0; i < slotIds.length; i += 200) {
        const chunk = slotIds.slice(i, i + 200);
        const { data: atts } = await supabase
          .from('meeting_slot_attendees')
          .select('status, is_partner, meeting_slot_id, booked_by')
          .in('meeting_slot_id', chunk);
        if (atts) allAtts.push(...atts);
      }

      if (allAtts.length === 0) return [];

      if (type === 'closer') {
        // Group by closer
        const slotCloserMap = Object.fromEntries(slots.map(s => [s.id, s.closer_id]));
        const closerIds = [...new Set(slots.map(s => s.closer_id))];
        const { data: closers } = await supabase
          .from('closers')
          .select('id, name')
          .in('id', closerIds);
        const closerNameMap = Object.fromEntries((closers || []).map(c => [c.id, c.name]));

        const agg = new Map<string, { total: number; realizadas: number; noShows: number; contratosPagos: number }>();

        for (const att of allAtts) {
          if (att.is_partner) continue;
          const cid = slotCloserMap[att.meeting_slot_id];
          if (!cid) continue;
          if (!agg.has(cid)) agg.set(cid, { total: 0, realizadas: 0, noShows: 0, contratosPagos: 0 });
          const m = agg.get(cid)!;
          m.total++;
          if (att.status === 'completed') m.realizadas++;
          if (att.status === 'no_show') m.noShows++;
          if (att.status === 'contract_paid') m.contratosPagos++;
        }

        return buildEntries(agg, closerNameMap);
      } else {
        // Group by SDR (booked_by)
        const sdrAgg = new Map<string, { total: number; realizadas: number; noShows: number; contratosPagos: number }>();

        for (const att of allAtts) {
          if (att.is_partner || !att.booked_by) continue;
          const sid = att.booked_by;
          if (!sdrAgg.has(sid)) sdrAgg.set(sid, { total: 0, realizadas: 0, noShows: 0, contratosPagos: 0 });
          const m = sdrAgg.get(sid)!;
          m.total++;
          if (att.status === 'completed') m.realizadas++;
          if (att.status === 'no_show') m.noShows++;
          if (att.status === 'contract_paid') m.contratosPagos++;
        }

        // Resolve SDR names via profiles -> employees
        const profileIds = [...sdrAgg.keys()];
        const nameMap: Record<string, string> = {};
        if (profileIds.length > 0) {
          for (let i = 0; i < profileIds.length; i += 200) {
            const chunk = profileIds.slice(i, i + 200);
            const { data: emps } = await supabase
              .from('employees')
              .select('profile_id, nome_completo')
              .in('profile_id', chunk);
            if (emps) {
              for (const e of emps) {
                if (e.profile_id) nameMap[e.profile_id] = e.nome_completo || e.profile_id;
              }
            }
          }
        }

        return buildEntries(sdrAgg, nameMap);
      }
    },
    enabled: !!startDate && !!endDate,
  });
}

function buildEntries(
  agg: Map<string, { total: number; realizadas: number; noShows: number; contratosPagos: number }>,
  nameMap: Record<string, string>
): ComparisonEntry[] {
  const entries: ComparisonEntry[] = Array.from(agg.entries()).map(([id, m]) => {
    const atendidas = m.realizadas + m.contratosPagos;
    const agendadas = m.total - (m.total - m.realizadas - m.noShows - m.contratosPagos); // simplify: just total happened
    const totalReal = m.realizadas + m.noShows + m.contratosPagos;
    return {
      id,
      name: nameMap[id] || id,
      ...m,
      taxaConversao: atendidas > 0 ? (m.contratosPagos / atendidas) * 100 : 0,
      taxaComparecimento: totalReal > 0 ? (atendidas / totalReal) * 100 : 0,
      taxaNoShow: totalReal > 0 ? (m.noShows / totalReal) * 100 : 0,
    };
  });

  entries.sort((a, b) => b.contratosPagos - a.contratosPagos);
  return entries;
}
