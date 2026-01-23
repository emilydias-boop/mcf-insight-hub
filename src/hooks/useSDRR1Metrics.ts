import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfDay, endOfDay, format } from "date-fns";

export interface SDRR1Metric {
  sdr_id: string;
  sdr_name: string;
  sdr_email: string;
  agendada: number;
  realizada: number;
  noShow: number;
  taxaRealizacao: number;
}

export function useSDRR1Metrics(weekStart: Date, weekEnd: Date) {
  return useQuery({
    queryKey: ['sdr-r1-metrics', format(weekStart, 'yyyy-MM-dd'), format(weekEnd, 'yyyy-MM-dd')],
    queryFn: async (): Promise<SDRR1Metric[]> => {
      // 1. Fetch R1 attendees with booked_by for the week
      const { data: attendees, error: attendeesError } = await supabase
        .from('meeting_slot_attendees')
        .select(`
          id,
          status,
          booked_by,
          meeting_slot:meeting_slots!inner(
            id,
            scheduled_at,
            meeting_type,
            status
          )
        `)
        .eq('meeting_slot.meeting_type', 'r1')
        .gte('meeting_slot.scheduled_at', startOfDay(weekStart).toISOString())
        .lte('meeting_slot.scheduled_at', endOfDay(weekEnd).toISOString())
        .not('meeting_slot.status', 'in', '("cancelled","rescheduled")');

      if (attendeesError) {
        console.error('Error fetching R1 attendees:', attendeesError);
        return [];
      }

      // 2. Get unique booked_by IDs
      const bookedByIds = new Set<string>();
      attendees?.forEach((att: any) => {
        if (att.booked_by) bookedByIds.add(att.booked_by);
      });

      if (bookedByIds.size === 0) {
        return [];
      }

      // 3. Fetch profiles for SDR names
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', Array.from(bookedByIds));

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
        return [];
      }

      const profilesMap = new Map<string, { name: string; email: string }>();
      profiles?.forEach((p: any) => {
        profilesMap.set(p.id, { 
          name: p.full_name || p.email?.split('@')[0] || 'Unknown',
          email: p.email || ''
        });
      });

      // 4. Aggregate by SDR
      const sdrMap = new Map<string, SDRR1Metric>();

      attendees?.forEach((att: any) => {
        const sdrId = att.booked_by;
        if (!sdrId) return;

        const profile = profilesMap.get(sdrId);
        if (!profile) return;

        if (!sdrMap.has(sdrId)) {
          sdrMap.set(sdrId, {
            sdr_id: sdrId,
            sdr_name: profile.name,
            sdr_email: profile.email,
            agendada: 0,
            realizada: 0,
            noShow: 0,
            taxaRealizacao: 0,
          });
        }

        const metric = sdrMap.get(sdrId)!;
        metric.agendada++;
        
        if (att.status === 'completed' || att.status === 'contract_paid') {
          metric.realizada++;
        }
        if (att.status === 'no_show') {
          metric.noShow++;
        }
      });

      // 5. Calculate conversion rates
      const results = Array.from(sdrMap.values()).map(m => ({
        ...m,
        taxaRealizacao: m.agendada > 0 ? (m.realizada / m.agendada) * 100 : 0,
      }));

      // Sort by agendada desc
      return results.sort((a, b) => b.agendada - a.agendada);
    },
    refetchInterval: 30000,
  });
}
