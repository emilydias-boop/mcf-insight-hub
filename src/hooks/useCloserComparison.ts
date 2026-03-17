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
}

export function useCloserComparison(
  startDate: Date | null,
  endDate: Date | null,
  highlightId: string | null
) {
  return useQuery({
    queryKey: ['closer-comparison', startDate?.toISOString(), endDate?.toISOString()],
    queryFn: async (): Promise<ComparisonEntry[]> => {
      if (!startDate || !endDate) return [];

      const rangeStart = startOfDay(startDate).toISOString();
      const rangeEnd = endOfDay(endDate).toISOString();

      // Get all slots in range
      const { data: slots } = await supabase
        .from('meeting_slots')
        .select('id, closer_id')
        .gte('scheduled_at', rangeStart)
        .lte('scheduled_at', rangeEnd);

      if (!slots || slots.length === 0) return [];

      const slotIds = slots.map(s => s.id);
      const closerSlotMap = new Map<string, string[]>();
      for (const s of slots) {
        if (!closerSlotMap.has(s.closer_id)) closerSlotMap.set(s.closer_id, []);
        closerSlotMap.get(s.closer_id)!.push(s.id);
      }

      // Get attendees
      const { data: atts } = await supabase
        .from('meeting_slot_attendees')
        .select('status, is_partner, meeting_slot_id')
        .in('meeting_slot_id', slotIds);

      if (!atts) return [];

      // Map slot -> closer
      const slotCloserMap = Object.fromEntries(slots.map(s => [s.id, s.closer_id]));

      // Get closer names
      const closerIds = [...closerSlotMap.keys()];
      const { data: closers } = await supabase
        .from('closers')
        .select('id, name')
        .in('id', closerIds);
      const closerNameMap = Object.fromEntries((closers || []).map(c => [c.id, c.name]));

      // Aggregate per closer
      const agg = new Map<string, { total: number; realizadas: number; noShows: number; contratosPagos: number }>();

      for (const att of atts) {
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

      const entries: ComparisonEntry[] = Array.from(agg.entries()).map(([id, m]) => {
        const atendidas = m.realizadas + m.contratosPagos;
        return {
          id,
          name: closerNameMap[id] || id,
          ...m,
          taxaConversao: atendidas > 0 ? (m.contratosPagos / atendidas) * 100 : 0,
        };
      });

      entries.sort((a, b) => b.contratosPagos - a.contratosPagos);
      return entries;
    },
    enabled: !!startDate && !!endDate,
  });
}
